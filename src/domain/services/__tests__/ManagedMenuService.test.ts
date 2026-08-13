import {
  describe, it, expect, vi, beforeEach, afterEach,
} from 'vitest';
import { syncManagedSquareMenu } from '../ManagedMenuService';
import {
  BUSINESS_ID,
  CAT_A_ID,
  CAT_A_NAME,
  CAT_A_PRODUCT_ORDER,
  CAT_B_ID,
  CAT_B_NAME,
  CODEPOINT_CATEGORY_IDS,
  DELETED_SQUARE_MENU_ID,
  DUPLICATE_SQUARE_MENU_IDS,
  EXISTING_SQUARE_MENU_ID,
  MISSING_CATEGORY_ID,
  ORDERED_CATEGORY_ID,
  ORDERED_CATEGORY_NAME,
  ORDERED_GROUP_ID,
  ORDERED_KEYS,
  TIE_CATEGORY_IDS,
  baseFixture,
  menuCategoriesOnly,
  noQualifyingCategories,
  orderedCategoriesOnly,
  withCodepointCategories,
  withDeletedMenuGroup,
  withDeletedSquareMenu,
  withDuplicateMirrors,
  withExistingSquareMenu,
  withManagedGroupForCatA,
  withOrderedSquareMenu,
  withSoftDeletedMirrorCategory,
  withTieCategories,
  withTwoSquareMenus,
} from './managedMenuFixture';
import type { FixtureDoc, FixtureSet } from './managedMenuFixture';
import {
  mockDb,
  mockTransaction,
  transactionSets,
  docWrites,
  registerCollection,
  getOrCreateCollectionRef,
  resetMockFirestore,
} from './helpers/mockFirestore';

// Mock firebase-admin/firestore — rebuildMenus resolves its Firestore handle through it.
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => mockDb,
  FieldValue: { delete: () => '$$FIELD_DELETE$$' },
}));

// Literal collection paths, matching MenuRebuildService.test.ts.
const MENUS_PATH = `businesses/${BUSINESS_ID}/public/surfaces/menus`;
const MENU_GROUPS_PATH = `businesses/${BUSINESS_ID}/public/surfaces/menuGroups`;
const COLLECTIONS_PATH = `businesses/${BUSINESS_ID}/public/surfaces/collections`;
const PRODUCTS_PATH = `businesses/${BUSINESS_ID}/public/catalog/products`;
const CATEGORIES_PATH = `businesses/${BUSINESS_ID}/public/catalog/categories`;
const OPTION_SETS_PATH = `businesses/${BUSINESS_ID}/public/catalog/optionSets`;
const OPTIONS_PATH = `businesses/${BUSINESS_ID}/public/catalog/options`;

vi.mock('../../../persistence/firestore/PathResolver', () => ({
  PathResolver: {
    menusCollection: (_bid: string) => getOrCreateCollectionRef(MENUS_PATH),
    menuGroupsCollection: (_bid: string) => getOrCreateCollectionRef(MENU_GROUPS_PATH),
    collectionsCollection: (_bid: string) => getOrCreateCollectionRef(COLLECTIONS_PATH),
    productsCollection: (_bid: string) => getOrCreateCollectionRef(PRODUCTS_PATH),
    categoriesCollection: (_bid: string) => getOrCreateCollectionRef(CATEGORIES_PATH),
    optionSetsCollection: (_bid: string) => getOrCreateCollectionRef(OPTION_SETS_PATH),
    optionsCollection: (_bid: string) => getOrCreateCollectionRef(OPTIONS_PATH),
  },
}));

/**
 * The flag set every test runs under. `pruneMenuAssetsOnRebuild` is on (rebuildMenus' own #132
 * default); `syncSquareMenuCategories` is DELIBERATELY ABSENT, so the flag-agnostic contract of
 * #88 — this service never reads its own enablement flag, callers gate — is proven by
 * construction across the whole suite rather than by a single assertion.
 */
const FLAGS_WITHOUT_SQUARE_MENU_FLAG = { pruneMenuAssetsOnRebuild: true };

const { mockGetFlags } = vi.hoisted(() => ({ mockGetFlags: vi.fn() }));
vi.mock('../FeatureFlagService', () => ({ getFlags: mockGetFlags }));

/**
 * `rebuildMenus` is spied but NOT stubbed: the spy delegates to the real implementation. That is
 * what lets this one suite assert both the wiring ("called once with the right scope") and the
 * materialization acceptance criterion end-to-end — a stub would prove neither.
 */
const { rebuildMenusSpy, realRebuildMenus } = vi.hoisted(() => ({
  rebuildMenusSpy: vi.fn(),
  realRebuildMenus: {
    // Replaced by the real implementation inside the module factory below; the throwing default
    // makes a mis-wired factory fail loudly instead of silently skipping materialization.
    current: async (): Promise<void> => {
      throw new Error('rebuildMenus was never captured from the real module');
    },
  } as { current: (businessId: string, scope?: unknown) => Promise<void> },
}));
vi.mock('../MenuRebuildService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../MenuRebuildService')>();
  realRebuildMenus.current = actual.rebuildMenus;
  return { ...actual, rebuildMenus: rebuildMenusSpy };
});

/**
 * Shared call-order ledger. `docWritesBefore` is the length of the `docWrites` ledger at the
 * moment `rebuildMenus` was invoked, so "write X happened before the rebuild" is simply
 * "index of X < docWritesBefore". Ordering is load-bearing twice over: the Square Menu doc must
 * exist before the rebuild (MenuRebuildService.ts:134 filters scoped ids against a bulk read and
 * silently no-ops otherwise), and group docs must exist before the menu references them.
 */
const rebuildCalls: Array<{ businessId: string; scope: unknown; docWritesBefore: number }> = [];

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

let warnSpy: ReturnType<typeof vi.spyOn>;

function registerFixture(set: FixtureSet) {
  registerCollection(CATEGORIES_PATH, set.categories);
  registerCollection(PRODUCTS_PATH, set.products);
  registerCollection(MENU_GROUPS_PATH, set.menuGroups);
  registerCollection(MENUS_PATH, set.menus);
  registerCollection(COLLECTIONS_PATH, []);
}

function writesOn(collectionPath: string) {
  return docWrites.filter((w) => w.path.startsWith(`${collectionPath}/`));
}

function writesFor(collectionPath: string, docId: string) {
  return docWrites.filter((w) => w.path === `${collectionPath}/${docId}`);
}

function groupCreates() {
  return writesOn(MENU_GROUPS_PATH).filter((w) => w.op === 'set');
}

async function readDoc(collectionPath: string, docId: string) {
  const snap = await getOrCreateCollectionRef(collectionPath).doc(docId).get();
  return snap.data();
}

async function docExists(collectionPath: string, docId: string) {
  const snap = await getOrCreateCollectionRef(collectionPath).doc(docId).get();
  return snap.exists;
}

/** The payloads `rebuildMenus` transactionally wrote for a menu, oldest first. */
function materializedWrites(menuId: string) {
  return transactionSets.filter((s) => s.ref._docId === menuId).map((s) => s.data);
}

function requireFixtureDoc(docs: FixtureDoc[], id: string): FixtureDoc {
  const doc = docs.find((d) => d.id === id);
  if (!doc) throw new Error(`fixture document ${id} is missing`);
  return doc;
}

/** The single write in `writes` that carries `mirrorCategoryId === categoryId`. */
function writeForCategory(writes: typeof docWrites, categoryId: string) {
  const match = writes.filter((w) => w.data.mirrorCategoryId === categoryId);
  expect(match).toHaveLength(1);
  return match[0];
}

/** The id of the single CREATED group write whose `mirrorCategoryId` is `categoryId`. */
function createdGroupIdFor(categoryId: string): string {
  const match = groupCreates().filter((w) => w.data.mirrorCategoryId === categoryId);
  expect(match).toHaveLength(1);
  return match[0].id;
}

/** #100: shorthand for the ordering world's mirror-group ids — `G.c` reads as "Charlie's group". */
const G = ORDERED_GROUP_ID;

/**
 * #100: the Square Menu doc AS STORED after the run — the three fields that must agree with each
 * other and with the returned `managedGroupIds`.
 */
async function storedAssembly(menuId: string) {
  const doc = await readDoc(MENUS_PATH, menuId);
  return {
    menuAssetDisplayOrder: doc.menuAssetDisplayOrder,
    groupDisplayOrder: doc.groupDisplayOrder,
    assetKeys: Object.keys(doc.menuAssets),
  };
}

/**
 * #100 acceptance criterion, asserted once here and used by every TC11 test: the stored
 * `menuAssetDisplayOrder`, the stored `groupDisplayOrder`, the stored `menuAssets` KEY ORDER and
 * the returned `managedGroupIds` are all one and the same sequence. On the create path #88 already
 * pins this (test:246); asserting it here pins it on the REUSE path too, which is where the
 * observed-order merge runs.
 */
async function expectConsistentAssembly(
  menuId: string,
  result: { managedGroupIds: string[] },
  expected: string[],
) {
  const stored = await storedAssembly(menuId);
  expect(result.managedGroupIds).toEqual(expected);
  expect(stored.menuAssetDisplayOrder).toEqual(expected);
  expect(stored.groupDisplayOrder).toEqual(expected);
  expect(stored.assetKeys).toEqual(expected);
}

/**
 * #100: the sequence the operator dragged the Square Menu's assets into — Charlie, Alpha, Bravo,
 * deliberately NOT the alphabetical order. Every world below that seeds an operator reorder seeds
 * this one, so the observed order and the expected order can never drift apart.
 */
const OPERATOR_ORDER = [G.c, G.a, G.b];

/**
 * #100: the canonical operator-reorder world — Alpha, Bravo and Charlie mirrored onto an existing
 * Square Menu whose `menuAssetDisplayOrder` is `OPERATOR_ORDER`. `groupDisplayOrder` is left at the
 * pre-reorder sequence on purpose: Remy's `useReorderMenuAssets` merge-writes
 * `menuAssetDisplayOrder` alone, so that is the state a real reorder leaves behind.
 */
function reorderedSquareMenuWorld(): FixtureSet {
  return withOrderedSquareMenu({
    categoryKeys: ['a', 'b', 'c'],
    existingMenuAssetDisplayOrder: [...OPERATOR_ORDER],
  });
}

beforeEach(() => {
  resetMockFirestore();

  // resetMockFirestore() calls vi.clearAllMocks(); re-arm everything that carries behaviour.
  mockGetFlags.mockResolvedValue(FLAGS_WITHOUT_SQUARE_MENU_FLAG);

  rebuildCalls.length = 0;
  rebuildMenusSpy.mockImplementation(async (businessId: string, scope?: unknown) => {
    rebuildCalls.push({ businessId, scope, docWritesBefore: docWrites.length });
    return realRebuildMenus.current(businessId, scope);
  });

  // The service warns on every run that changes something; silence it and assert on the spy.
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

  mockTransaction.get.mockImplementation(async (ref: { _collectionPath: string; _docId: string }) => {
    const collRef = getOrCreateCollectionRef(ref._collectionPath);
    const snap = await collRef.get();
    const doc = snap.docs.find((d: { id: string }) => d.id === ref._docId);
    return {
      id: ref._docId,
      exists: !!doc,
      data: () => doc?.data() ?? undefined,
    };
  });

  registerFixture(baseFixture());
});

afterEach(() => {
  warnSpy.mockRestore();
});

describe('ManagedMenuService', () => {
  // ─── TC1: create path ──────────────────────────────────────────────

  describe('TC1 — create path', () => {
    beforeEach(() => {
      registerFixture(menuCategoriesOnly());
    });

    it('creates exactly one managedBy:\'square\' Menu named "Square Menu"', async () => {
      const result = await syncManagedSquareMenu(BUSINESS_ID);

      const writes = writesOn(MENUS_PATH);
      expect(writes).toHaveLength(1);
      expect(writes[0].op).toBe('set');
      expect(writes[0].id).toBe(result.menuId);
      expect(writes[0].data.name).toBe('Square Menu');
      expect(writes[0].data.displayName).toBe('Square Menu');
      expect(writes[0].data.managedBy).toBe('square');
      expect(writes[0].data.isDeleted).toBe(false);
      expect(writes[0].data.created).toMatch(ISO_RE);
      expect(writes[0].data.updated).toMatch(ISO_RE);
      // The id lives in the document path only; the converter strips it from the payload.
      expect(writes[0].data).not.toHaveProperty('Id');
    });

    it('creates one managed MenuGroup per menu category', async () => {
      await syncManagedSquareMenu(BUSINESS_ID);

      const writes = writesOn(MENU_GROUPS_PATH);
      expect(writes).toHaveLength(2);
      expect(writes.every((w) => w.op === 'set')).toBe(true);
      expect(writes.map((w) => w.data.mirrorCategoryId).sort()).toEqual([CAT_A_ID, CAT_B_ID]);

      const catAWrite = writeForCategory(writes, CAT_A_ID);
      expect(catAWrite.data.name).toBe(CAT_A_NAME);
      expect(catAWrite.data.displayName).toBe(CAT_A_NAME);
      expect(catAWrite.data.managedBy).toBe('square');
      // Products flow in from the mirror category at materialization time (#79), never copied.
      expect(catAWrite.data.productDisplayOrder).toEqual([]);
      expect(catAWrite.data.isDeleted).toBe(false);
      expect(catAWrite.data.created).toMatch(ISO_RE);
      expect(catAWrite.data).not.toHaveProperty('Id');
    });

    it('writes menuAssets, groupDisplayOrder and menuAssetDisplayOrder as identical sequences', async () => {
      const result = await syncManagedSquareMenu(BUSINESS_ID);

      const { data } = writesOn(MENUS_PATH)[0];
      expect(result.managedGroupIds).toHaveLength(2);
      expect(data.groupDisplayOrder).toEqual(result.managedGroupIds);
      expect(data.menuAssetDisplayOrder).toEqual(result.managedGroupIds);
      expect(Object.keys(data.menuAssets)).toEqual(result.managedGroupIds);
      for (const asset of Object.values(data.menuAssets)) {
        expect(asset).toEqual({ assetType: 'group' });
      }
    });

    it('orders groups alphabetically by category name', async () => {
      const result = await syncManagedSquareMenu(BUSINESS_ID);

      expect(CAT_A_NAME < CAT_B_NAME).toBe(true);
      expect(result.managedGroupIds).toEqual([
        createdGroupIdFor(CAT_A_ID),
        createdGroupIdFor(CAT_B_ID),
      ]);
    });

    it('returns { menuId, managedGroupIds } matching the written assembly order', async () => {
      const result = await syncManagedSquareMenu(BUSINESS_ID);

      const menuWrite = writesOn(MENUS_PATH)[0];
      expect(result.menuId).toBe(menuWrite.id);
      expect(result.managedGroupIds).toEqual(menuWrite.data.menuAssetDisplayOrder);
    });
  });

  // ─── TC2: reconcile path (convert in place) ────────────────────────

  describe('TC2 — reconcile: convert in place', () => {
    it('converts a matching unmanaged group in place, same doc id', async () => {
      const result = await syncManagedSquareMenu(BUSINESS_ID);

      const writes = writesFor(MENU_GROUPS_PATH, 'mgUnmanaged');
      expect(writes).toHaveLength(1);
      expect(writes[0].op).toBe('update');
      // Narrow payload: a converter round-trip would clobber gateway-owned fields.
      expect(Object.keys(writes[0].data).sort()).toEqual(['managedBy', 'updated']);
      expect(writes[0].data.managedBy).toBe('square');
      expect(writes[0].data.updated).toMatch(ISO_RE);
      expect(result.managedGroupIds).toContain('mgUnmanaged');
    });

    it('does not create a duplicate group for a converted category', async () => {
      await syncManagedSquareMenu(BUSINESS_ID);

      // The only create is for catB, which had no candidate at all.
      expect(groupCreates().map((w) => w.data.mirrorCategoryId)).toEqual([CAT_B_ID]);
    });

    it('preserves mirrorCategoryId, name and productDisplayOrder on conversion', async () => {
      await syncManagedSquareMenu(BUSINESS_ID);

      const stored = await readDoc(MENU_GROUPS_PATH, 'mgUnmanaged');
      const pristine = requireFixtureDoc(baseFixture().menuGroups, 'mgUnmanaged').data;
      const { managedBy: _storedManagedBy, updated: _storedUpdated, ...storedRest } = stored;
      const {
        managedBy: _pristineManagedBy, updated: _pristineUpdated, ...pristineRest
      } = pristine;
      expect(storedRest).toEqual(pristineRest);
      expect(stored.mirrorCategoryId).toBe(CAT_A_ID);
      expect(stored.name).toBe(CAT_A_NAME);
      expect(stored.productDisplayOrder).toEqual(['pa1']);
    });

    it('leaves an already-managed group untouched', async () => {
      registerFixture(withManagedGroupForCatA());

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      expect(writesFor(MENU_GROUPS_PATH, 'mgManagedA')).toHaveLength(0);
      expect(result.managedGroupIds).toContain('mgManagedA');
    });

    it('never matches a group whose mirrorCategoryId is absent', async () => {
      const result = await syncManagedSquareMenu(BUSINESS_ID);

      // mgLegacyNoMirror is named "Beverages", exactly like catB — matching is by id only.
      expect(writesFor(MENU_GROUPS_PATH, 'mgLegacyNoMirror')).toHaveLength(0);
      expect(result.managedGroupIds).not.toContain('mgLegacyNoMirror');
      expect(createdGroupIdFor(CAT_B_ID)).not.toBe('mgLegacyNoMirror');
    });
  });

  // ─── TC3: prune path (demote in place) ─────────────────────────────

  describe('TC3 — prune: demote in place', () => {
    it('demotes a managed group in place: same doc id, managedBy null, mirrorCategoryId retained', async () => {
      const fixture = withManagedGroupForCatA();
      requireFixtureDoc(fixture.categories, CAT_A_ID).data.categoryType = 'regular';
      registerFixture(fixture);

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      const writes = writesFor(MENU_GROUPS_PATH, 'mgManagedA');
      expect(writes).toHaveLength(1);
      expect(writes[0].op).toBe('update');
      expect(Object.keys(writes[0].data).sort()).toEqual(['managedBy', 'updated']);
      expect(writes[0].data.managedBy).toBeNull();

      const stored = await readDoc(MENU_GROUPS_PATH, 'mgManagedA');
      expect(stored.managedBy).toBeNull();
      expect(stored.mirrorCategoryId).toBe(CAT_A_ID);
      expect(result.managedGroupIds).not.toContain('mgManagedA');
    });

    it('never deletes a group doc', async () => {
      await syncManagedSquareMenu(BUSINESS_ID);

      expect(docWrites.every((w) => w.op === 'set' || w.op === 'update')).toBe(true);
      expect(await docExists(MENU_GROUPS_PATH, 'mgOrphanManaged')).toBe(true);
    });

    it('drops the demoted group from all three assembly fields', async () => {
      const result = await syncManagedSquareMenu(BUSINESS_ID);

      const { data } = writesOn(MENUS_PATH)[0];
      expect(result.managedGroupIds).not.toContain('mgOrphanManaged');
      expect(data.menuAssetDisplayOrder).not.toContain('mgOrphanManaged');
      expect(data.groupDisplayOrder).not.toContain('mgOrphanManaged');
      expect(Object.keys(data.menuAssets)).not.toContain('mgOrphanManaged');
    });

    it('leaves the classic menu\'s reference to the demoted group intact', async () => {
      await syncManagedSquareMenu(BUSINESS_ID);

      expect(writesFor(MENUS_PATH, 'classicMenu')).toHaveLength(0);
      const stored = await readDoc(MENUS_PATH, 'classicMenu');
      expect(Object.keys(stored.menuAssets)).toContain('mgOrphanManaged');
      expect(stored.menuAssetDisplayOrder).toContain('mgOrphanManaged');
    });

    it('re-promotes the very same doc when the category becomes a menu category again', async () => {
      const fixture = withManagedGroupForCatA();
      const catA = requireFixtureDoc(fixture.categories, CAT_A_ID);
      catA.data.categoryType = 'regular';
      registerFixture(fixture);

      const first = await syncManagedSquareMenu(BUSINESS_ID);
      expect(first.managedGroupIds).not.toContain('mgManagedA');
      expect((await readDoc(MENU_GROUPS_PATH, 'mgManagedA')).managedBy).toBeNull();

      // registerCollection stores the fixture's own doc data object, so mutating it here is the
      // same as an operator flipping the category back in Firestore between runs.
      catA.data.categoryType = 'menu';
      docWrites.length = 0;

      const second = await syncManagedSquareMenu(BUSINESS_ID);

      expect(second.menuId).toBe(first.menuId);
      expect(second.managedGroupIds).toContain('mgManagedA');
      const stored = await readDoc(MENU_GROUPS_PATH, 'mgManagedA');
      expect(stored.managedBy).toBe('square');
      expect(stored.mirrorCategoryId).toBe(CAT_A_ID);
      // No duplicate group was minted for catA on re-promotion.
      expect(groupCreates().filter((w) => w.data.mirrorCategoryId === CAT_A_ID)).toHaveLength(0);
      // The reuse path updates the menu with exactly the assembly plus `updated`.
      const menuWrites = writesOn(MENUS_PATH);
      expect(menuWrites).toHaveLength(1);
      expect(menuWrites[0].op).toBe('update');
      expect(Object.keys(menuWrites[0].data).sort()).toEqual([
        'groupDisplayOrder', 'menuAssetDisplayOrder', 'menuAssets', 'updated',
      ]);
    });

    it('demotes when the mirror category is soft-deleted', async () => {
      registerFixture(withSoftDeletedMirrorCategory());

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      const writes = writesFor(MENU_GROUPS_PATH, 'mgSoftDeleted');
      expect(writes).toHaveLength(1);
      expect(writes[0].data.managedBy).toBeNull();
      expect(result.managedGroupIds).not.toContain('mgSoftDeleted');
      expect(await docExists(MENU_GROUPS_PATH, 'mgSoftDeleted')).toBe(true);
    });

    it('demotes when the mirror category document no longer exists', async () => {
      expect(await docExists(CATEGORIES_PATH, MISSING_CATEGORY_ID)).toBe(false);

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      const writes = writesFor(MENU_GROUPS_PATH, 'mgOrphanManaged');
      expect(writes).toHaveLength(1);
      expect(writes[0].op).toBe('update');
      expect(writes[0].data.managedBy).toBeNull();
      expect((await readDoc(MENU_GROUPS_PATH, 'mgOrphanManaged')).mirrorCategoryId)
        .toBe(MISSING_CATEGORY_ID);
      expect(result.managedGroupIds).not.toContain('mgOrphanManaged');
    });
  });

  // ─── TC4: idempotency / no churn ───────────────────────────────────

  describe('TC4 — idempotency / no churn', () => {
    it('performs zero document writes on a second run', async () => {
      await syncManagedSquareMenu(BUSINESS_ID);
      const writesAfterFirstRun = docWrites.length;
      expect(writesAfterFirstRun).toBeGreaterThan(0);
      expect(warnSpy).toHaveBeenCalledWith(
        '[ManagedMenuService] reconciled Square Menu',
        expect.objectContaining({ businessId: BUSINESS_ID }),
      );
      warnSpy.mockClear();

      await syncManagedSquareMenu(BUSINESS_ID);

      expect(docWrites.length).toBe(writesAfterFirstRun);
      // The no-change path is deliberately silent: this runs on every catalog sync.
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('returns an identical result object on a second run', async () => {
      const first = await syncManagedSquareMenu(BUSINESS_ID);
      const second = await syncManagedSquareMenu(BUSINESS_ID);

      expect(second).toEqual(first);
    });

    it('leaves the Square Menu doc byte-identical after a second run', async () => {
      const { menuId } = await syncManagedSquareMenu(BUSINESS_ID);
      const before = JSON.stringify(await readDoc(MENUS_PATH, menuId));

      await syncManagedSquareMenu(BUSINESS_ID);

      expect(JSON.stringify(await readDoc(MENUS_PATH, menuId))).toBe(before);
    });

    it('rebuilds a payload deep-equal to the first on a second run', async () => {
      const { menuId } = await syncManagedSquareMenu(BUSINESS_ID);
      await syncManagedSquareMenu(BUSINESS_ID);

      const payloads = materializedWrites(menuId);
      expect(payloads).toHaveLength(2);
      expect(payloads[1]).toEqual(payloads[0]);
    });

    it('performs zero document writes on a second run after an operator reorder', async () => {
      registerFixture(reorderedSquareMenuWorld());

      // Run 1 heals the stale `groupDisplayOrder`, so it necessarily writes.
      await syncManagedSquareMenu(BUSINESS_ID);
      expect(writesFor(MENUS_PATH, EXISTING_SQUARE_MENU_ID)).toHaveLength(1);
      docWrites.length = 0;
      warnSpy.mockClear();

      await syncManagedSquareMenu(BUSINESS_ID);

      // The merge is a FIXED POINT: fed its own output back with an unchanged desired set it
      // returns the same array, `assemblyEquals` matches, and the reconciler stays silent.
      expect(docWrites).toHaveLength(0);
      expect(warnSpy).not.toHaveBeenCalled();
      // The mock's `mockTransaction.set` never writes back into the doc stores, so the closest
      // available proof that the rebuild is also at a fixed point is its two payloads.
      const payloads = materializedWrites(EXISTING_SQUARE_MENU_ID);
      expect(payloads).toHaveLength(2);
      expect(payloads[1]).toEqual(payloads[0]);
    });

    it('leaves the reordered Square Menu doc byte-identical after a second run', async () => {
      registerFixture(reorderedSquareMenuWorld());
      await syncManagedSquareMenu(BUSINESS_ID);
      const before = JSON.stringify(await readDoc(MENUS_PATH, EXISTING_SQUARE_MENU_ID));

      const second = await syncManagedSquareMenu(BUSINESS_ID);

      expect(JSON.stringify(await readDoc(MENUS_PATH, EXISTING_SQUARE_MENU_ID))).toBe(before);
      expect(second.managedGroupIds).toEqual(OPERATOR_ORDER);
    });
  });

  // ─── TC5: materialization ──────────────────────────────────────────

  describe('TC5 — materialization', () => {
    it('materializes the mirror category\'s productDisplayOrder with no dangling products', async () => {
      const { menuId } = await syncManagedSquareMenu(BUSINESS_ID);

      const payloads = materializedWrites(menuId);
      expect(payloads).toHaveLength(1);
      const group = payloads[0].groups.mgUnmanaged;
      expect(group).toBeDefined();
      // The group's own productDisplayOrder is ['pa1']; the mirror category's is the truth.
      expect(group.productDisplayOrder).toEqual(CAT_A_PRODUCT_ORDER);
      expect(Object.keys(group.products).sort()).toEqual([...CAT_A_PRODUCT_ORDER].sort());
      for (const pid of group.productDisplayOrder) {
        expect(group.products[pid]).toBeDefined();
      }
    });

    it('materializes managed groups carrying managedBy \'square\' and their mirrorCategoryId', async () => {
      const result = await syncManagedSquareMenu(BUSINESS_ID);

      const payload = materializedWrites(result.menuId)[0];
      expect(Object.keys(payload.groups).sort()).toEqual([...result.managedGroupIds].sort());
      for (const gid of result.managedGroupIds) {
        expect(payload.groups[gid].managedBy).toBe('square');
        expect(payload.groups[gid].mirrorCategoryId).toBeTruthy();
      }
      expect(payload.groups[createdGroupIdFor(CAT_B_ID)].mirrorCategoryId).toBe(CAT_B_ID);
    });
  });

  // ─── TC6: empty / legacy / missing inputs ──────────────────────────

  describe('TC6 — empty, legacy and missing inputs', () => {
    it('creates the Menu even when zero categories qualify', async () => {
      registerFixture(noQualifyingCategories());

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      expect(result.menuId).toBeTruthy();
      expect(result.managedGroupIds).toEqual([]);
      expect(writesOn(MENU_GROUPS_PATH)).toHaveLength(0);
      const menuWrites = writesOn(MENUS_PATH);
      expect(menuWrites).toHaveLength(1);
      expect(menuWrites[0].data.menuAssets).toEqual({});
      expect(menuWrites[0].data.groupDisplayOrder).toEqual([]);
      expect(menuWrites[0].data.menuAssetDisplayOrder).toEqual([]);
    });

    it('ignores legacy categories that have no categoryType field', async () => {
      registerFixture(menuCategoriesOnly());

      await syncManagedSquareMenu(BUSINESS_ID);

      expect(groupCreates().map((w) => w.data.mirrorCategoryId)).not.toContain('catLegacy');
    });

    it('never mirrors kitchen categories', async () => {
      registerFixture(menuCategoriesOnly());

      await syncManagedSquareMenu(BUSINESS_ID);

      expect(groupCreates().map((w) => w.data.mirrorCategoryId)).not.toContain('catKitchen');
    });

    it('never mirrors regular categories', async () => {
      registerFixture(menuCategoriesOnly());

      await syncManagedSquareMenu(BUSINESS_ID);

      expect(groupCreates().map((w) => w.data.mirrorCategoryId)).not.toContain('catRegular');
    });

    it('ignores isDeleted MenuGroups when matching and creates a fresh group instead', async () => {
      registerFixture(withDeletedMenuGroup());

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      expect(writesFor(MENU_GROUPS_PATH, 'mgDeletedMirror')).toHaveLength(0);
      expect(result.managedGroupIds).not.toContain('mgDeletedMirror');
      expect(createdGroupIdFor(CAT_A_ID)).not.toBe('mgDeletedMirror');
    });
  });

  // ─── TC7: error paths ──────────────────────────────────────────────

  describe('TC7 — error paths', () => {
    it('throws when more than one non-deleted managed Menu exists', async () => {
      registerFixture(withTwoSquareMenus());

      const promise = syncManagedSquareMenu(BUSINESS_ID);

      await expect(promise).rejects.toThrow(/\[ManagedMenuService\]/);
      await expect(promise).rejects.toThrow(
        new RegExp(`${DUPLICATE_SQUARE_MENU_IDS[0]}, ${DUPLICATE_SQUARE_MENU_IDS[1]}`),
      );
    });

    it('writes nothing and does not rebuild when the invariant is violated', async () => {
      registerFixture(withTwoSquareMenus());

      await expect(syncManagedSquareMenu(BUSINESS_ID)).rejects.toThrow();

      // Fail-fast placement: the business is left completely untouched, not half-reconciled.
      expect(docWrites).toHaveLength(0);
      expect(rebuildMenusSpy).not.toHaveBeenCalled();
      expect(transactionSets).toHaveLength(0);
    });

    it('ignores an isDeleted managed Menu and creates a new one', async () => {
      registerFixture(withDeletedSquareMenu());

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      expect(result.menuId).not.toBe(DELETED_SQUARE_MENU_ID);
      const menuWrites = writesOn(MENUS_PATH);
      expect(menuWrites).toHaveLength(1);
      expect(menuWrites[0].op).toBe('set');
      expect(menuWrites[0].id).toBe(result.menuId);
    });
  });

  // ─── TC8: duplicate mirrors and ordering boundaries ────────────────

  describe('TC8 — duplicates and ordering boundaries', () => {
    it('prefers the already-managed group when two groups mirror the same category', async () => {
      registerFixture(withDuplicateMirrors(null, 'square'));

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      // dupB wins on managed-first even though dupA has the lower doc id.
      expect(result.managedGroupIds).toEqual(['dupB']);
      expect(writesFor(MENU_GROUPS_PATH, 'dupB')).toHaveLength(0);
      expect(writesFor(MENU_GROUPS_PATH, 'dupA')).toHaveLength(0);
      expect(groupCreates()).toHaveLength(0);
      expect(warnSpy).toHaveBeenCalledWith(
        '[ManagedMenuService] duplicate mirrorCategoryId groups',
        { businessId: BUSINESS_ID, categoryIds: [CAT_A_ID] },
      );
    });

    it('falls back to the lowest doc id when neither duplicate is managed', async () => {
      registerFixture(withDuplicateMirrors(null, null));

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      expect(result.managedGroupIds).toEqual(['dupA']);
      expect(writesFor(MENU_GROUPS_PATH, 'dupA')).toHaveLength(1);
      expect(writesFor(MENU_GROUPS_PATH, 'dupA')[0].data.managedBy).toBe('square');
      // The losing group is operator-owned and already unmanaged: never written to.
      expect(writesFor(MENU_GROUPS_PATH, 'dupB')).toHaveLength(0);
    });

    it('demotes the losing duplicate when both are managed', async () => {
      registerFixture(withDuplicateMirrors('square', 'square'));

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      expect(result.managedGroupIds).toEqual(['dupA']);
      expect(writesFor(MENU_GROUPS_PATH, 'dupA')).toHaveLength(0);
      const loserWrites = writesFor(MENU_GROUPS_PATH, 'dupB');
      expect(loserWrites).toHaveLength(1);
      expect(loserWrites[0].op).toBe('update');
      expect(loserWrites[0].data.managedBy).toBeNull();
      expect(await docExists(MENU_GROUPS_PATH, 'dupB')).toBe(true);
    });

    it('tie-breaks equal category names by category Id', async () => {
      registerFixture(withTieCategories());

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      expect(result.managedGroupIds).toEqual([
        createdGroupIdFor(TIE_CATEGORY_IDS[0]),
        createdGroupIdFor(TIE_CATEGORY_IDS[1]),
      ]);
    });

    it('orders by codepoint, not by locale', async () => {
      registerFixture(withCodepointCategories());

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      // 'Zebra' (U+005A) sorts before 'apple' (U+0061) by codepoint; localeCompare would invert
      // this, and its answer depends on the runtime's ICU data — that is the trap being guarded.
      expect('Zebra'.localeCompare('apple')).toBeGreaterThan(0);
      expect(result.managedGroupIds).toEqual([
        createdGroupIdFor(CODEPOINT_CATEGORY_IDS.zebra),
        createdGroupIdFor(CODEPOINT_CATEGORY_IDS.apple),
      ]);
    });
  });

  // ─── TC9: flag-agnostic contract and rebuild wiring ────────────────

  describe('TC9 — flag-agnostic contract and rebuild wiring', () => {
    it('runs with syncSquareMenuCategories undefined', async () => {
      expect(FLAGS_WITHOUT_SQUARE_MENU_FLAG).not.toHaveProperty('syncSquareMenuCategories');
      registerFixture(menuCategoriesOnly());

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      expect(result.managedGroupIds).toHaveLength(2);
      expect(writesOn(MENU_GROUPS_PATH)).toHaveLength(2);
      expect(writesOn(MENUS_PATH)).toHaveLength(1);
    });

    it('calls rebuildMenus exactly once, scoped to the managed menu', async () => {
      registerFixture(withExistingSquareMenu());

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      expect(result.menuId).toBe(EXISTING_SQUARE_MENU_ID);
      expect(rebuildMenusSpy).toHaveBeenCalledTimes(1);
      expect(rebuildMenusSpy).toHaveBeenCalledWith(BUSINESS_ID, {
        menuIds: [EXISTING_SQUARE_MENU_ID],
      });
    });

    it('calls rebuildMenus even when nothing changed', async () => {
      await syncManagedSquareMenu(BUSINESS_ID);
      const writesAfterFirstRun = docWrites.length;

      await syncManagedSquareMenu(BUSINESS_ID);

      expect(docWrites.length).toBe(writesAfterFirstRun);
      expect(rebuildMenusSpy).toHaveBeenCalledTimes(2);
    });
  });

  // ─── TC10: write / rebuild sequencing ──────────────────────────────

  describe('TC10 — sequencing', () => {
    it('writes the Square Menu document before invoking rebuildMenus', async () => {
      const result = await syncManagedSquareMenu(BUSINESS_ID);

      const menuWriteIndex = docWrites.findIndex(
        (w) => w.path === `${MENUS_PATH}/${result.menuId}`,
      );
      expect(menuWriteIndex).toBeGreaterThanOrEqual(0);
      expect(rebuildCalls).toHaveLength(1);
      // rebuildMenus filters its scoped ids against a bulk read of the menus collection
      // (MenuRebuildService.ts:134): a menu written afterwards would be a silent no-op.
      expect(menuWriteIndex).toBeLessThan(rebuildCalls[0].docWritesBefore);
    });

    it('writes managed group docs before the menu assembly', async () => {
      const result = await syncManagedSquareMenu(BUSINESS_ID);

      const menuWriteIndex = docWrites.findIndex(
        (w) => w.path === `${MENUS_PATH}/${result.menuId}`,
      );
      const groupWriteIndexes = docWrites
        .map((w, index) => ({ w, index }))
        .filter(({ w }) => w.path.startsWith(`${MENU_GROUPS_PATH}/`))
        .map(({ index }) => index);

      expect(groupWriteIndexes.length).toBeGreaterThan(0);
      // A menu referencing a group doc that does not exist yet would be pruned as a dangling ref
      // on the next rebuild, making the group flap in and out on alternating runs.
      for (const index of groupWriteIndexes) {
        expect(index).toBeLessThan(menuWriteIndex);
      }
    });
  });

  // ─── TC11: #100 operator-set order preservation ────────────────────

  /**
   * #100 / remy#349. Membership and sequence have different owners: this reconciler owns which
   * group ids are on the Square Menu, the OPERATOR owns their relative order. Every test here goes
   * through the exported `syncManagedSquareMenu` — `computeAssemblyOrder` stays module-private, as
   * #88's suite established — and every one ends on `expectConsistentAssembly`, so the
   * "three fields plus the return value are one sequence" invariant is re-proved on the reuse path
   * in every one of the states below.
   */
  describe('TC11 — #100: operator-set order preservation', () => {
    it('preserves an operator-set menuAssetDisplayOrder across a sync', async () => {
      registerFixture(reorderedSquareMenuWorld());

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      // NOT the alphabetical [Alpha, Bravo, Charlie] #88 would have re-derived.
      expect(OPERATOR_ORDER).not.toEqual([G.a, G.b, G.c]);
      await expectConsistentAssembly(EXISTING_SQUARE_MENU_ID, result, OPERATOR_ORDER);
    });

    it('heals a groupDisplayOrder left stale by an operator reorder', async () => {
      registerFixture(reorderedSquareMenuWorld());
      const beforeRun = await readDoc(MENUS_PATH, EXISTING_SQUARE_MENU_ID);
      // The premise: Remy merge-wrote one field, so the doc arrives self-inconsistent.
      expect(beforeRun.groupDisplayOrder).toEqual([G.a, G.b, G.c]);
      expect(beforeRun.menuAssetDisplayOrder).toEqual(OPERATOR_ORDER);

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      const menuWrites = writesFor(MENUS_PATH, EXISTING_SQUARE_MENU_ID);
      expect(menuWrites).toHaveLength(1);
      expect(menuWrites[0].op).toBe('update');
      expect(Object.keys(menuWrites[0].data).sort()).toEqual([
        'groupDisplayOrder', 'menuAssetDisplayOrder', 'menuAssets', 'updated',
      ]);
      // Healing means `groupDisplayOrder` is re-derived FROM the operator order, never the reverse.
      expect(menuWrites[0].data.groupDisplayOrder).toEqual(OPERATOR_ORDER);
      await expectConsistentAssembly(EXISTING_SQUARE_MENU_ID, result, OPERATOR_ORDER);
    });

    it('returns managedGroupIds in the preserved operator order', async () => {
      registerFixture(reorderedSquareMenuWorld());

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      // The documented return contract — "in Square-Menu assembly order" — on the REUSE path;
      // test:269 only covers the create path.
      expect(result.menuId).toBe(EXISTING_SQUARE_MENU_ID);
      expect(result.managedGroupIds).toEqual(OPERATOR_ORDER);
      await expectConsistentAssembly(EXISTING_SQUARE_MENU_ID, result, OPERATOR_ORDER);
    });

    it('appends a newly created group at the end of the operator order', async () => {
      registerFixture(withOrderedSquareMenu({
        categoryKeys: ['a', 'b', 'c', 'd'],
        groupKeys: ['a', 'b', 'c'],
        existingMenuAssetDisplayOrder: [...OPERATOR_ORDER],
      }));

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      // Delta's group is minted this run, so its id only exists in the run's own output.
      const newDelta = createdGroupIdFor(ORDERED_CATEGORY_ID.d);
      await expectConsistentAssembly(EXISTING_SQUARE_MENU_ID, result, [...OPERATOR_ORDER, newDelta]);
    });

    it('sorts multiple newcomers among themselves without re-sorting the existing order', async () => {
      registerFixture(withOrderedSquareMenu({
        categoryKeys: ['a', 'b', 'c', 'd'],
        groupKeys: ['a', 'c'],
        existingMenuAssetDisplayOrder: [G.c, G.a],
      }));

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      // Bravo and Delta sort alphabetically AMONG THEMSELVES and land after Charlie, Alpha — a
      // global re-sort would have produced Alpha, Bravo, Charlie, Delta instead.
      const newBravo = createdGroupIdFor(ORDERED_CATEGORY_ID.b);
      const newDelta = createdGroupIdFor(ORDERED_CATEGORY_ID.d);
      await expectConsistentAssembly(
        EXISTING_SQUARE_MENU_ID,
        result,
        [G.c, G.a, newBravo, newDelta],
      );
    });

    it('drops a demoted group without re-alphabetizing the rest', async () => {
      registerFixture(withOrderedSquareMenu({
        categoryKeys: ['b', 'c', 'd'],
        groupKeys: ['a', 'b', 'c', 'd'],
        existingMenuAssetDisplayOrder: [G.c, G.a, G.b, G.d],
      }));

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      // Alpha's category is gone, so its group is demoted in place — never deleted.
      const demotedWrites = writesFor(MENU_GROUPS_PATH, G.a);
      expect(demotedWrites).toHaveLength(1);
      expect(demotedWrites[0].op).toBe('update');
      expect(demotedWrites[0].data.managedBy).toBeNull();
      expect(await docExists(MENU_GROUPS_PATH, G.a)).toBe(true);
      // The survivors keep the operator's relative order; alphabetical would be Bravo, Charlie, Delta.
      await expectConsistentAssembly(EXISTING_SQUARE_MENU_ID, result, [G.c, G.b, G.d]);
    });

    it('appends a re-promoted group at the end rather than restoring its old slot', async () => {
      const fixture = withOrderedSquareMenu({
        categoryKeys: ORDERED_KEYS,
        existingMenuAssetDisplayOrder: [G.c, G.a, G.b, G.d],
      });
      const alpha = requireFixtureDoc(fixture.categories, ORDERED_CATEGORY_ID.a);
      alpha.data.categoryType = 'regular';
      registerFixture(fixture);

      const first = await syncManagedSquareMenu(BUSINESS_ID);
      expect(first.managedGroupIds).toEqual([G.c, G.b, G.d]);

      // Same trick as test:383 — registerCollection stores the fixture's own data object, so this
      // is an operator flipping the category back in Firestore between runs.
      alpha.data.categoryType = 'menu';
      docWrites.length = 0;

      const second = await syncManagedSquareMenu(BUSINESS_ID);

      // INTENTIONAL behaviour change (#100): a returning group is indistinguishable from a new one
      // — the reconciler keeps no memory of removed positions — so it appends rather than
      // reclaiming its original second slot.
      expect(writesFor(MENU_GROUPS_PATH, G.a)[0].data.managedBy).toBe('square');
      await expectConsistentAssembly(EXISTING_SQUARE_MENU_ID, second, [G.c, G.b, G.d, G.a]);
    });

    it('orders alphabetically when there is no existing Square Menu', async () => {
      registerFixture(orderedCategoriesOnly());

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      // The fixture's premise: group ids sort in the REVERSE of the category names, so an
      // implementation that sorted by groupId would return Delta…Alpha here.
      const names = ORDERED_KEYS.map((k) => ORDERED_CATEGORY_NAME[k]);
      expect(names).toEqual([...names].sort());
      const groupIds = ORDERED_KEYS.map((k) => G[k]);
      expect(groupIds).toEqual([...groupIds].sort().reverse());

      const expected = ORDERED_KEYS.map((k) => createdGroupIdFor(ORDERED_CATEGORY_ID[k]));
      await expectConsistentAssembly(result.menuId, result, expected);
    });

    it('orders alphabetically when the existing menuAssetDisplayOrder is empty', async () => {
      registerFixture(withOrderedSquareMenu({
        categoryKeys: ORDERED_KEYS,
        groupKeys: [],
      }));

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      const expected = ORDERED_KEYS.map((k) => createdGroupIdFor(ORDERED_CATEGORY_ID[k]));
      await expectConsistentAssembly(EXISTING_SQUARE_MENU_ID, result, expected);
    });

    it('orders alphabetically when menuAssetDisplayOrder is missing from the doc', async () => {
      registerFixture(withOrderedSquareMenu({
        categoryKeys: ORDERED_KEYS,
        groupKeys: [],
        omitMenuAssetDisplayOrder: true,
      }));
      // A Menu doc written before the field existed: the key is ABSENT, not empty.
      expect(await readDoc(MENUS_PATH, EXISTING_SQUARE_MENU_ID))
        .not.toHaveProperty('menuAssetDisplayOrder');

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      const expected = ORDERED_KEYS.map((k) => createdGroupIdFor(ORDERED_CATEGORY_ID[k]));
      await expectConsistentAssembly(EXISTING_SQUARE_MENU_ID, result, expected);
    });

    // Firestore data written by another process: `unknown` is the honest type, and none of these
    // may throw — a corrupt order field must heal, not break every future catalog sync.
    it.each<[string, unknown]>([
      ['null', null],
      ['a comma-joined string', `${G.c},${G.a}`],
      ['a number', 42],
      ['an object', {}],
    ])('ignores a non-array menuAssetDisplayOrder (%s)', async (_label, raw) => {
      registerFixture(withOrderedSquareMenu({
        categoryKeys: ORDERED_KEYS,
        existingMenuAssetDisplayOrder: raw,
      }));

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      await expectConsistentAssembly(
        EXISTING_SQUARE_MENU_ID,
        result,
        ORDERED_KEYS.map((k) => G[k]),
      );
    });

    it('ignores non-string entries in menuAssetDisplayOrder', async () => {
      registerFixture(withOrderedSquareMenu({
        categoryKeys: ['a', 'b', 'c'],
        existingMenuAssetDisplayOrder: [42, null, G.c, {}, G.a],
      }));

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      // The two readable ids keep their observed order; Bravo is left over and appends.
      await expectConsistentAssembly(EXISTING_SQUARE_MENU_ID, result, [G.c, G.a, G.b]);
    });

    it('emits a duplicated id exactly once', async () => {
      registerFixture(withOrderedSquareMenu({
        categoryKeys: ['a', 'b', 'c'],
        existingMenuAssetDisplayOrder: [G.c, G.c, G.a, G.b],
      }));

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      // The invariant-breaking case: `menuAssets` is a MAP, so a doubled id would make the order
      // array longer than the asset key set and desynchronize the three fields for good.
      const stored = await storedAssembly(EXISTING_SQUARE_MENU_ID);
      expect(stored.assetKeys).toHaveLength(stored.menuAssetDisplayOrder.length);
      await expectConsistentAssembly(EXISTING_SQUARE_MENU_ID, result, [G.c, G.a, G.b]);
    });

    it('ignores ids that are not in the managed group set', async () => {
      registerFixture(withOrderedSquareMenu({
        categoryKeys: ['a', 'b', 'c'],
        // A deleted asset and an operator group that never belonged on the Square Menu.
        existingMenuAssetDisplayOrder: ['ghostAsset', G.c, 'mgClassic', G.a, G.b],
      }));

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      await expectConsistentAssembly(EXISTING_SQUARE_MENU_ID, result, [G.c, G.a, G.b]);
    });

    it('handles a single managed group', async () => {
      registerFixture(withOrderedSquareMenu({
        categoryKeys: ['a'],
        existingMenuAssetDisplayOrder: [G.a],
      }));

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      // A one-element order is already its own fixed point, so the no-churn guard writes nothing.
      expect(docWrites).toHaveLength(0);
      await expectConsistentAssembly(EXISTING_SQUARE_MENU_ID, result, [G.a]);
    });

    it('produces an empty assembly when every group is demoted', async () => {
      registerFixture(withOrderedSquareMenu({
        categoryKeys: [],
        groupKeys: ['a', 'b', 'c'],
        existingMenuAssetDisplayOrder: [G.c, G.a, G.b],
      }));

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      for (const key of ['a', 'b', 'c'] as const) {
        expect(writesFor(MENU_GROUPS_PATH, G[key])[0].data.managedBy).toBeNull();
      }
      expect((await readDoc(MENUS_PATH, EXISTING_SQUARE_MENU_ID)).menuAssets).toEqual({});
      await expectConsistentAssembly(EXISTING_SQUARE_MENU_ID, result, []);
    });

    it('treats every group as a newcomer when the order holds no managed ids', async () => {
      registerFixture(withOrderedSquareMenu({
        categoryKeys: ORDERED_KEYS,
        existingMenuAssetDisplayOrder: ['ghost1', 'ghost2'],
      }));

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      // Nothing survives the intersection, so the merge degenerates to #88's default order.
      await expectConsistentAssembly(
        EXISTING_SQUARE_MENU_ID,
        result,
        ORDERED_KEYS.map((k) => G[k]),
      );
    });
  });
});
