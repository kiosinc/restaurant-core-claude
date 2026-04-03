import { getFirestore } from 'firebase-admin/firestore';
import { PathResolver } from '../../persistence/firestore/PathResolver';
import type { MenuAsset, MenuProductMeta, MenuCollectionMeta } from '../surfaces/Menu';
import type { MenuGroupMeta } from '../surfaces/MenuGroup';

export interface RebuildScope {
  menuIds?: string[];
  changedProductIds?: string[];
  changedCollectionIds?: string[];
}

interface DocData {
  id: string;
  data: FirebaseFirestore.DocumentData;
}

interface MaterializedMenuDoc {
  name: string;
  displayName: string | null;
  coverImageGsl: string | null;
  coverBackgroundImageGsl: string | null;
  coverVideoGsl: string | null;
  logoImageGsl: string | null;
  gratuityRates: number[];
  managedBy: string | null;
  created: FirebaseFirestore.Timestamp;
  updated: FirebaseFirestore.Timestamp;
  isDeleted: boolean;
  groups: Record<string, MenuGroupMeta>;
  groupDisplayOrder: string[];
  collections: Record<string, MenuCollectionMeta>;
  menuAssets: Record<string, MenuAsset>;
  menuAssetDisplayOrder: string[];
  version?: string;
}

/** Filters out empty-string IDs from a Firestore productDisplayOrder array. */
function validProductIds(displayOrder: unknown): string[] {
  return ((displayOrder as string[] | undefined) ?? []).filter((pid: string) => pid);
}

function extractAssetIdsByType(
  menuAssets: Record<string, MenuAsset>,
  type: MenuAsset['assetType'],
): string[] {
  return Object.entries(menuAssets)
    .filter(([, asset]) => asset.assetType === type)
    .map(([id]) => id);
}

const MAX_REBUILD_RETRIES = 3;

export async function rebuildMenus(businessId: string, scope?: RebuildScope): Promise<void> {
  const db = getFirestore();
  const menusRef = PathResolver.menusCollection(businessId);

  // Read all menus
  const menuSnapshot = await menusRef.get();
  const allMenus: DocData[] = menuSnapshot.docs.map((d) => ({ id: d.id, data: d.data() }));

  // Resolve which menus to rebuild
  const menuIdsToRebuild = await resolveMenuIds(db, businessId, allMenus, scope);
  if (menuIdsToRebuild.size === 0) return;

  const menusToRebuild = allMenus.filter((m) => menuIdsToRebuild.has(m.id));

  await Promise.all(menusToRebuild.map((menu) => rebuildSingleMenu(db, businessId, menu)));
}

async function resolveMenuIds(
  db: FirebaseFirestore.Firestore,
  businessId: string,
  allMenus: DocData[],
  scope?: RebuildScope,
): Promise<Set<string>> {
  if (!scope) {
    return new Set(allMenus.map((m) => m.id));
  }

  const result = new Set<string>();

  if (scope.menuIds) {
    for (const id of scope.menuIds) result.add(id);
  }

  if (scope.changedProductIds) {
    const changedSet = new Set(scope.changedProductIds);

    // Build a map of menuId -> groupIds from menuAssets
    const menuGroupMap = new Map<string, string[]>();
    const allGroupIds = new Set<string>();
    for (const menu of allMenus) {
      const assets: Record<string, MenuAsset> = menu.data.menuAssets ?? {};
      const groupIds = extractAssetIdsByType(assets, 'group');
      for (const gid of groupIds) allGroupIds.add(gid);
      menuGroupMap.set(menu.id, groupIds);
    }

    // Batch-read all referenced MenuGroup docs
    const menuGroupsRef = PathResolver.menuGroupsCollection(businessId);
    const groupDocs = await batchGetDocs(db, menuGroupsRef, [...allGroupIds]);
    const groupProductMap = new Map<string, string[]>();
    for (const g of groupDocs) {
      groupProductMap.set(g.id, validProductIds(g.data.productDisplayOrder));
    }

    // Check containment
    for (const menu of allMenus) {
      const groupIds = menuGroupMap.get(menu.id) ?? [];
      for (const gid of groupIds) {
        const pids = groupProductMap.get(gid) ?? [];
        if (pids.some((pid: string) => changedSet.has(pid))) {
          result.add(menu.id);
          break;
        }
      }
    }
  }

  if (scope.changedCollectionIds) {
    const changedSet = new Set(scope.changedCollectionIds);
    for (const menu of allMenus) {
      const assets: Record<string, MenuAsset> = menu.data.menuAssets ?? {};
      const colIds = extractAssetIdsByType(assets, 'collection');
      if (colIds.some((id) => changedSet.has(id))) {
        result.add(menu.id);
      }
    }
  }

  return result;
}

function materializeGroups(
  menuGroups: DocData[],
  productMap: Map<string, DocData>,
  categoryMap: Map<string, DocData>,
): Record<string, MenuGroupMeta> {
  const result: Record<string, MenuGroupMeta> = {};
  for (const group of menuGroups) {
    if (group.data.isDeleted) continue;

    let productDisplayOrder = validProductIds(group.data.productDisplayOrder);
    const mirrorCatId = group.data.mirrorCategoryId;
    if (mirrorCatId) {
      const cat = categoryMap.get(mirrorCatId);
      if (cat && !cat.data.isDeleted) {
        productDisplayOrder = validProductIds(cat.data.productDisplayOrder);
      }
    }

    const groupProducts: Record<string, MenuProductMeta> = {};
    for (const pid of productDisplayOrder) {
      const product = productMap.get(pid);
      if (!product || product.data.isDeleted) continue;
      groupProducts[pid] = {
        isActive: product.data.isActive ?? false,
        name: product.data.name ?? '',
        imageGsls: product.data.imageGsls ?? [],
        minPrice: product.data.minPrice ?? 0,
        variationCount: product.data.variationCount ?? 0,
        description: product.data.description ?? '',
      };
    }

    result[group.id] = {
      displayName: group.data.displayName ?? null,
      name: group.data.name ?? '',
      imageGsls: group.data.imageGsls ?? [],
      productDisplayOrder,
      mirrorCategoryId: group.data.mirrorCategoryId ?? null,
      products: groupProducts,
    };
  }
  return result;
}

function materializeCollections(
  collections: DocData[],
): Record<string, MenuCollectionMeta> {
  const result: Record<string, MenuCollectionMeta> = {};
  for (const col of collections) {
    if (col.data.isDeleted) continue;
    result[col.id] = {
      name: col.data.name ?? '',
      displayName: col.data.displayName ?? '',
      imageGsls: col.data.imageGsls ?? [],
      videoGsls: col.data.videoGsls ?? [],
      isUserInteractionEnabled: col.data.isUserInteractionEnabled ?? false,
      type: col.data.type ?? '',
      hyperlink: col.data.hyperlink ?? '',
    };
  }
  return result;
}

function menuAssetsEqual(
  a: Record<string, MenuAsset>,
  b: Record<string, MenuAsset>,
): boolean {
  const keysA = Object.keys(a).sort();
  const keysB = Object.keys(b).sort();
  if (keysA.length !== keysB.length) return false;
  for (let i = 0; i < keysA.length; i++) {
    if (keysA[i] !== keysB[i]) return false;
    const assetA = a[keysA[i]];
    const assetB = b[keysB[i]];
    if (assetA.assetType !== assetB.assetType) return false;
    const configA = assetA.configuration;
    const configB = assetB.configuration;
    if (configA === undefined && configB === undefined) continue;
    if (configA === undefined || configB === undefined) return false;
    if (JSON.stringify(configA) !== JSON.stringify(configB)) return false;
  }
  return true;
}

type AttemptResult = {
  success: true;
} | {
  success: false;
  freshData: FirebaseFirestore.DocumentData;
};

async function attemptRebuild(
  db: FirebaseFirestore.Firestore,
  businessId: string,
  menu: DocData,
): Promise<AttemptResult> {
  // Phase A: Bulk reads (outside transaction)
  const menuAssets: Record<string, MenuAsset> = menu.data.menuAssets ?? {};

  const groupIds = extractAssetIdsByType(menuAssets, 'group');
  const collectionIds = extractAssetIdsByType(menuAssets, 'collection');

  // Batch-read MenuGroups and Collections
  const menuGroupsRef = PathResolver.menuGroupsCollection(businessId);
  const collectionsRef = PathResolver.collectionsCollection(businessId);
  const [menuGroups, collections] = await Promise.all([
    batchGetDocs(db, menuGroupsRef, groupIds),
    batchGetDocs(db, collectionsRef, collectionIds),
  ]);

  // Collect all product IDs from non-deleted groups
  const allProductIds = new Set<string>();
  const mirrorCategoryIds = new Set<string>();
  for (const group of menuGroups) {
    if (group.data.isDeleted) continue;
    const displayOrder = validProductIds(group.data.productDisplayOrder);
    for (const pid of displayOrder) allProductIds.add(pid);
    if (group.data.mirrorCategoryId) mirrorCategoryIds.add(group.data.mirrorCategoryId);
  }

  // Batch-read Products and Categories
  const productsRef = PathResolver.productsCollection(businessId);
  const categoriesRef = PathResolver.categoriesCollection(businessId);
  const [products, categories] = await Promise.all([
    batchGetDocs(db, productsRef, [...allProductIds]),
    batchGetDocs(db, categoriesRef, [...mirrorCategoryIds]),
  ]);
  const productMap = new Map(products.map((p) => [p.id, p]));
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const materializedGroups = materializeGroups(menuGroups, productMap, categoryMap);
  const materializedCollections = materializeCollections(collections);

  // Phase B: Atomic write (inside transaction)
  const menuDocRef = PathResolver.menusCollection(businessId).doc(menu.id);
  let freshData: FirebaseFirestore.DocumentData | undefined;

  await db.runTransaction(async (t) => {
    const freshMenuSnap = await t.get(menuDocRef);
    const existingData = freshMenuSnap.data() ?? {};

    // Detect TOCTOU divergence: menuAssets changed between bulk read and transaction
    const freshMenuAssets: Record<string, MenuAsset> = existingData.menuAssets ?? {};
    if (!menuAssetsEqual(menuAssets, freshMenuAssets)) {
      freshData = existingData;
      return; // Skip write; transaction commits as read-only
    }

    const merged: MaterializedMenuDoc = {
      // Preserve structural fields
      name: existingData.name ?? '',
      displayName: existingData.displayName ?? null,
      coverImageGsl: existingData.coverImageGsl ?? null,
      coverBackgroundImageGsl: existingData.coverBackgroundImageGsl ?? null,
      coverVideoGsl: existingData.coverVideoGsl ?? null,
      logoImageGsl: existingData.logoImageGsl ?? null,
      gratuityRates: existingData.gratuityRates ?? [],
      managedBy: existingData.managedBy ?? null,
      created: existingData.created,
      updated: existingData.updated,
      isDeleted: existingData.isDeleted ?? false,

      // Materialized sections
      groups: materializedGroups,
      groupDisplayOrder: existingData.groupDisplayOrder ?? [],
      collections: materializedCollections,
      menuAssets: existingData.menuAssets ?? {},
      menuAssetDisplayOrder: existingData.menuAssetDisplayOrder ?? [],
      version: existingData.version ?? menu.data.version,
    };

    t.set(menuDocRef, merged);
  });

  if (freshData) {
    return { success: false, freshData };
  }
  return { success: true };
}

async function rebuildSingleMenu(
  db: FirebaseFirestore.Firestore,
  businessId: string,
  menu: DocData,
): Promise<void> {
  let currentMenu = menu;

  for (let attempt = 1; attempt <= MAX_REBUILD_RETRIES; attempt++) {
    const result = await attemptRebuild(db, businessId, currentMenu);
    if (result.success) return;

    console.warn(
      `[MenuRebuildService] TOCTOU retry for menu ${currentMenu.id}, attempt ${attempt}/${MAX_REBUILD_RETRIES}`,
    );

    currentMenu = { id: currentMenu.id, data: result.freshData };
  }

  throw new Error(
    `[MenuRebuildService] Failed to rebuild menu ${menu.id} after ${MAX_REBUILD_RETRIES} retries: menuAssets kept changing`,
  );
}

async function batchGetDocs(
  db: FirebaseFirestore.Firestore,
  collectionRef: FirebaseFirestore.CollectionReference,
  ids: string[],
): Promise<DocData[]> {
  const validIds = ids.filter((id) => id);
  if (validIds.length === 0) return [];

  const refs = validIds.map((id) => collectionRef.doc(id));
  const snapshots = await db.getAll(...refs);

  return snapshots
    .filter((snap) => snap.exists)
    .map((snap) => ({ id: snap.id, data: snap.data()! }));
}

export async function resolveChangedProducts(businessId: string, syncTraceId: string): Promise<string[]> {
  const productsRef = PathResolver.productsCollection(businessId);
  const optionSetsRef = PathResolver.optionSetsCollection(businessId);
  const optionsRef = PathResolver.optionsCollection(businessId);

  const [productSnap, optionSetSnap, optionSnap] = await Promise.all([
    productsRef.where('syncTraceId', '==', syncTraceId).select().get(),
    optionSetsRef.where('syncTraceId', '==', syncTraceId).select().get(),
    optionsRef.where('syncTraceId', '==', syncTraceId).select().get(),
  ]);

  const changedProductIds = new Set(productSnap.docs.map((d) => d.id));
  const changedOptionSetIds = new Set(optionSetSnap.docs.map((d) => d.id));
  const changedOptionIds = new Set(optionSnap.docs.map((d) => d.id));

  // Walk up: options → optionSets
  if (changedOptionIds.size > 0) {
    const allOptionSetsSnap = await optionSetsRef.select('options').get();
    for (const doc of allOptionSetsSnap.docs) {
      const options = doc.data().options ?? {};
      for (const optionId of Object.keys(options)) {
        if (changedOptionIds.has(optionId)) {
          changedOptionSetIds.add(doc.id);
          break;
        }
      }
    }
  }

  // Walk up: optionSets → products
  if (changedOptionSetIds.size > 0) {
    const allProductsSnap = await productsRef.select('optionSets').get();
    for (const doc of allProductsSnap.docs) {
      const optionSets = doc.data().optionSets ?? {};
      for (const osId of Object.keys(optionSets)) {
        if (changedOptionSetIds.has(osId)) {
          changedProductIds.add(doc.id);
          break;
        }
      }
    }
  }

  return [...changedProductIds];
}
