/**
 * #207 — contract tests for the exported rebuild-relevant read-sets.
 *
 * The drift guard is the point of this file. `RebuildRelevance` derives its key lists from
 * `ProductMeta` / `MenuProductMeta` / `MenuGroupMeta` through `Record<keyof T, true>` witnesses,
 * so a field added to one of those interfaces already fails to compile. That covers three of the
 * four declarations. The fourth is the materializer itself, which reads fields that appear in no
 * interface at all — `isDeleted` is the existing example — and no type can catch that.
 *
 * So the guard here is behavioural: for every field a Product or MenuGroup document can carry,
 * mutate it, run a real rebuild, and assert that "the output moved" and "the field is in the
 * exported set" are the same statement. A materializer that starts reading an eighth menuGroup
 * field, or a seventh menu-product field, turns that equality false and this file goes red.
 */
import {
  describe, it, expect, vi,
} from 'vitest';
import {
  PRODUCT_REBUILD_FIELDS,
  MENU_GROUP_REBUILD_FIELDS,
  REBUILD_FIELDS,
  affectsRebuild,
  affectsProductRebuild,
  affectsMenuGroupRebuild,
} from '../RebuildRelevance';
import type { RebuildKind } from '../RebuildRelevance';
import { rebuildMenus } from '../MenuRebuildService';
import { createProduct, productMeta } from '../../catalog/Product';
import type { Product } from '../../catalog/Product';
import { createMenuGroup } from '../../surfaces/MenuGroup';
import {
  BUSINESS_ID,
  menus,
  menuGroups,
  products,
  collections,
  categories,
} from './rebuildFixture';
import {
  mockDb,
  mockTransaction,
  transactionSets,
  registerCollection,
  getOrCreateCollectionRef,
  resetMockFirestore,
} from './helpers/mockFirestore';

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => mockDb,
  FieldValue: { delete: () => '$$FIELD_DELETE$$' },
}));

// MenuRebuildService reads the pruneMenuAssetsOnRebuild kill switch through getFlags(), which
// memoizes a Firestore read in module state (#132). Mock it outright, as the sibling suite does.
const { mockGetFlags } = vi.hoisted(() => ({ mockGetFlags: vi.fn() }));
vi.mock('../FeatureFlagService', () => ({ getFlags: mockGetFlags }));

const MENUS_PATH = `businesses/${BUSINESS_ID}/public/surfaces/menus`;
const MENU_GROUPS_PATH = `businesses/${BUSINESS_ID}/public/surfaces/menuGroups`;
const COLLECTIONS_PATH = `businesses/${BUSINESS_ID}/public/surfaces/collections`;
const PRODUCTS_PATH = `businesses/${BUSINESS_ID}/public/catalog/products`;
const CATEGORIES_PATH = `businesses/${BUSINESS_ID}/public/catalog/categories`;
const OPTION_SETS_PATH = `businesses/${BUSINESS_ID}/public/catalog/optionSets`;
const OPTIONS_PATH = `businesses/${BUSINESS_ID}/public/catalog/options`;

vi.mock('../../../persistence/firestore/PathResolver', () => ({
  PathResolver: {
    menusCollection: () => getOrCreateCollectionRef(MENUS_PATH),
    menuGroupsCollection: () => getOrCreateCollectionRef(MENU_GROUPS_PATH),
    collectionsCollection: () => getOrCreateCollectionRef(COLLECTIONS_PATH),
    productsCollection: () => getOrCreateCollectionRef(PRODUCTS_PATH),
    categoriesCollection: () => getOrCreateCollectionRef(CATEGORIES_PATH),
    optionSetsCollection: () => getOrCreateCollectionRef(OPTION_SETS_PATH),
    optionsCollection: () => getOrCreateCollectionRef(OPTIONS_PATH),
  },
}));

// ─── Mutation harness ────────────────────────────────────────────────

/**
 * Fixture group that every menu in the fixture references and that mirrors nothing — a mirrored
 * group takes its product list from the mirror category, which would mask a productDisplayOrder
 * mutation. Its product appears in all four menus, so any materialized change is observable.
 */
const SUBJECT_GROUP_ID = '0YRxtglWpkDyxcW8WCTD';
const SUBJECT_PRODUCT_ID = 'ozil5WuJ4qeSGhwcusPS';

const MUTATION_MARKER = '~207';

/**
 * Produces a value distinguishable from `value` whatever its type. `null` and `undefined` become
 * a concrete string: a document that gains a field it never had is exactly the legacy-doc write
 * this guard needs to observe.
 */
function mutateValue(value: unknown): unknown {
  if (typeof value === 'string') return `${value}${MUTATION_MARKER}`;
  if (typeof value === 'number') return value + 1;
  if (typeof value === 'boolean') return !value;
  if (Array.isArray(value)) return [...value, MUTATION_MARKER];
  if (typeof value === 'object' && value !== null) {
    return { ...(value as Record<string, unknown>), [MUTATION_MARKER]: true };
  }
  return MUTATION_MARKER;
}

type FixtureDocs = Array<{ id: string; data: Record<string, unknown> }>;

/** Shallow copy is sufficient — a mutation replaces a top-level key, it never edits in place. */
function cloneDocs(docs: FixtureDocs): FixtureDocs {
  return docs.map((doc) => ({ id: doc.id, data: { ...doc.data } }));
}

interface RebuildOutput {
  /** Order-stable serialization of every menu's materialized `groups` section. */
  signature: string;
  /** The materialized groups of the first menu written, for key-set assertions. */
  groups: Record<string, Record<string, unknown>>;
}

async function rebuildWith(mutation?: {
  collection: 'products' | 'menuGroups';
  id: string;
  field: string;
}): Promise<RebuildOutput> {
  resetMockFirestore();
  // resetMockFirestore() clears mock implementations, so restore the flag after it (#132).
  mockGetFlags.mockResolvedValue({ pruneMenuAssetsOnRebuild: true });

  const productDocs = cloneDocs(products as FixtureDocs);
  const groupDocs = cloneDocs(menuGroups as FixtureDocs);
  if (mutation) {
    const pool = mutation.collection === 'products' ? productDocs : groupDocs;
    const target = pool.find((doc) => doc.id === mutation.id);
    if (!target) throw new Error(`fixture doc ${mutation.id} missing from ${mutation.collection}`);
    target.data[mutation.field] = mutateValue(target.data[mutation.field]);
  }

  registerCollection(MENUS_PATH, menus);
  registerCollection(MENU_GROUPS_PATH, groupDocs);
  registerCollection(COLLECTIONS_PATH, collections);
  registerCollection(PRODUCTS_PATH, productDocs);
  registerCollection(CATEGORIES_PATH, categories);

  mockTransaction.get.mockImplementation(async (ref: { _collectionPath: string; _docId: string }) => {
    const snap = await getOrCreateCollectionRef(ref._collectionPath).get();
    const doc = snap.docs.find((d: { id: string }) => d.id === ref._docId);
    return { id: ref._docId, exists: !!doc, data: () => doc?.data() ?? undefined };
  });

  await rebuildMenus(BUSINESS_ID);

  const written = transactionSets
    .map((write) => ({ id: String(write.ref._docId), groups: write.data.groups }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return {
    signature: JSON.stringify(written),
    groups: written[0]?.groups ?? {},
  };
}

let cachedBaseline: RebuildOutput | undefined;
async function baseline(): Promise<RebuildOutput> {
  if (!cachedBaseline) cachedBaseline = await rebuildWith();
  return cachedBaseline;
}

/**
 * Fully populated Product used to observe the tier-1 projection. Mutating a field on the created
 * entity rather than re-running `createProduct` keeps the observation clean — the factory clamps
 * `minPrice` to `maxPrice`, which would swallow a `minPrice` mutation.
 */
const BASE_PRODUCT = createProduct({
  name: 'Drift Guard',
  caption: 'caption',
  description: 'description',
  imageUrls: ['https://example.test/1.jpg'],
  imageGsls: ['gs://bucket/1.jpg'],
  minPrice: 100,
  maxPrice: 200,
  variationCount: 2,
  isActive: true,
  dietaryPreferences: ['vegan'],
  allergens: ['peanut'],
  calorieCount: 300,
});

function tier1Moves(field: string): boolean {
  const source = BASE_PRODUCT as unknown as Record<string, unknown>;
  const mutated = { ...source, [field]: mutateValue(source[field]) } as unknown as Product;
  return JSON.stringify(productMeta(mutated)) !== JSON.stringify(productMeta(BASE_PRODUCT));
}

function unionSorted(...groups: readonly (readonly string[])[]): string[] {
  return [...new Set(groups.flat())].sort();
}

/** Every key a Product doc can carry, plus every key the exported set claims. */
const PRODUCT_FIELDS_UNDER_TEST = unionSorted(
  Object.keys(BASE_PRODUCT),
  PRODUCT_REBUILD_FIELDS,
);

/**
 * `MenuGroup` the entity does not declare `imageGsls`, but `MenuGroupMeta` does and
 * `materializeGroups` reads it — so the entity's own keys are not a superset of the read-set.
 * Union both directions or the guard would never test the one field that lives only in the
 * projection.
 */
const MENU_GROUP_FIELDS_UNDER_TEST = unionSorted(
  Object.keys(createMenuGroup({ name: 'Drift Guard' })),
  MENU_GROUP_REBUILD_FIELDS,
);

// ─── The exported sets ───────────────────────────────────────────────

describe('RebuildRelevance — exported sets', () => {
  it('PRODUCT_REBUILD_FIELDS is the union of both product projections plus isDeleted', () => {
    expect([...PRODUCT_REBUILD_FIELDS]).toEqual([
      'allergens',
      'calorieCount',
      'description',
      'dietaryPreferences',
      'imageGsls',
      'imageUrls',
      'isActive',
      'isDeleted',
      'maxPrice',
      'minPrice',
      'name',
      'variationCount',
    ]);
  });

  it('MENU_GROUP_REBUILD_FIELDS is every field materializeGroups reads plus isDeleted', () => {
    expect([...MENU_GROUP_REBUILD_FIELDS]).toEqual([
      'displayName',
      'imageGsls',
      'isDeleted',
      'managedBy',
      'mirrorCategoryId',
      'name',
      'productDisplayOrder',
    ]);
  });

  it('excludes the menuGroup products map the cascade itself stamps', () => {
    expect(MENU_GROUP_REBUILD_FIELDS).not.toContain('products');
  });

  it('REBUILD_FIELDS dispatches to the same arrays', () => {
    expect(REBUILD_FIELDS.product).toBe(PRODUCT_REBUILD_FIELDS);
    expect(REBUILD_FIELDS.menuGroup).toBe(MENU_GROUP_REBUILD_FIELDS);
  });

  it('exports frozen arrays so a consumer cannot mutate the contract', () => {
    expect(Object.isFrozen(PRODUCT_REBUILD_FIELDS)).toBe(true);
    expect(Object.isFrozen(MENU_GROUP_REBUILD_FIELDS)).toBe(true);
  });
});

// ─── Drift guard ─────────────────────────────────────────────────────

describe('RebuildRelevance — drift guard', () => {
  it('PRODUCT_REBUILD_FIELDS covers every key productMeta() emits', () => {
    expect(PRODUCT_REBUILD_FIELDS).toEqual(
      expect.arrayContaining(Object.keys(productMeta(BASE_PRODUCT))),
    );
  });

  it('PRODUCT_REBUILD_FIELDS covers every key a materialized menu product entry carries', async () => {
    const { groups } = await baseline();
    const entries = Object.values(groups)
      .flatMap((group) => Object.values((group.products ?? {}) as Record<string, unknown>));
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(PRODUCT_REBUILD_FIELDS).toEqual(
        expect.arrayContaining(Object.keys(entry as Record<string, unknown>)),
      );
    }
  });

  it('MENU_GROUP_REBUILD_FIELDS covers every materialized group key except the stamped map', async () => {
    const { groups } = await baseline();
    const materializedGroups = Object.values(groups);
    expect(materializedGroups.length).toBeGreaterThan(0);
    for (const group of materializedGroups) {
      const keys = Object.keys(group).filter((key) => key !== 'products');
      expect(MENU_GROUP_REBUILD_FIELDS).toEqual(expect.arrayContaining(keys));
    }
  });

  it.each(PRODUCT_FIELDS_UNDER_TEST)(
    'product field %s moves an output exactly when it is in PRODUCT_REBUILD_FIELDS',
    async (field) => {
      const tier2Moves = (await rebuildWith({
        collection: 'products',
        id: SUBJECT_PRODUCT_ID,
        field,
      })).signature !== (await baseline()).signature;

      expect(tier1Moves(field) || tier2Moves)
        .toBe((PRODUCT_REBUILD_FIELDS as readonly string[]).includes(field));
    },
  );

  it.each(MENU_GROUP_FIELDS_UNDER_TEST)(
    'menuGroup field %s moves a materialized menu exactly when it is in MENU_GROUP_REBUILD_FIELDS',
    async (field) => {
      const moved = (await rebuildWith({
        collection: 'menuGroups',
        id: SUBJECT_GROUP_ID,
        field,
      })).signature !== (await baseline()).signature;

      expect(moved).toBe((MENU_GROUP_REBUILD_FIELDS as readonly string[]).includes(field));
    },
  );
});

// ─── Predicates ──────────────────────────────────────────────────────

describe('affectsProductRebuild', () => {
  const before = {
    name: 'Chicken 65', isActive: true, minPrice: 800, imageGsls: ['gs://a', 'gs://b'], caption: 'old',
  };

  it('ignores a field outside the read-set', () => {
    expect(affectsProductRebuild(before, { ...before, caption: 'new' })).toBe(false);
  });

  it('reports a tier-1-only field', () => {
    expect(affectsProductRebuild(before, { ...before, maxPrice: 900 })).toBe(true);
  });

  it('reports a tier-2-only field', () => {
    expect(affectsProductRebuild(before, { ...before, description: 'now with rice' })).toBe(true);
  });

  it('reports the isDeleted gate, which is in neither projection', () => {
    expect(affectsProductRebuild({ ...before, isDeleted: false }, { ...before, isDeleted: true }))
      .toBe(true);
  });

  it('reports a create and a delete', () => {
    expect(affectsProductRebuild(undefined, before)).toBe(true);
    expect(affectsProductRebuild(before, undefined)).toBe(true);
  });

  it('reports nothing when neither side exists', () => {
    expect(affectsProductRebuild(undefined, undefined)).toBe(false);
    expect(affectsProductRebuild(null, null)).toBe(false);
  });

  it('treats an absent field and an explicit undefined as the same value', () => {
    // The everyday legacy-doc shape: calorieCount, allergens and dietaryPreferences all postdate
    // the documents that carry them, so most prod products simply have no such key.
    expect(affectsProductRebuild({ name: 'x' }, { name: 'x', calorieCount: undefined })).toBe(false);
  });

  it('reports an absent field that becomes an explicit null', () => {
    // Deliberately conservative: the materializers coalesce, so this is usually a no-op rebuild,
    // but a missed rebuild leaves a stale menu on a kiosk and a redundant one costs a write.
    expect(affectsProductRebuild({ name: 'x' }, { name: 'x', allergens: null })).toBe(true);
  });

  it('compares arrays element-wise and order-sensitively', () => {
    expect(affectsProductRebuild(before, { ...before, imageGsls: ['gs://a', 'gs://b'] })).toBe(false);
    expect(affectsProductRebuild(before, { ...before, imageGsls: ['gs://b', 'gs://a'] })).toBe(true);
    expect(affectsProductRebuild(before, { ...before, imageGsls: ['gs://a'] })).toBe(true);
  });

  it('compares a map-valued field structurally rather than by identity', () => {
    // Raw Firestore reads mint a fresh object per snapshot, so identity comparison would report a
    // phantom change on any legacy field that turns out to hold a map.
    expect(affectsProductRebuild({ allergens: { a: 1 } }, { allergens: { a: 1 } })).toBe(false);
    expect(affectsProductRebuild({ allergens: { a: 1 } }, { allergens: { a: 2 } })).toBe(true);
  });
});

describe('affectsMenuGroupRebuild', () => {
  const before = { name: 'All Items', displayName: 'All Items', productDisplayOrder: ['p1', 'p2'] };

  it('reports a reordered productDisplayOrder', () => {
    expect(affectsMenuGroupRebuild(before, { ...before, productDisplayOrder: ['p2', 'p1'] }))
      .toBe(true);
  });

  it('ignores the products map the cascade stamps', () => {
    // Gating on it would make every product cascade enqueue a redundant menuGroup cascade.
    expect(affectsMenuGroupRebuild(
      { ...before, products: { p1: { name: 'old' } } },
      { ...before, products: { p1: { name: 'new' } } },
    )).toBe(false);
  });

  it('ignores productOrdinals, which materializeGroups never reads', () => {
    expect(affectsMenuGroupRebuild({ ...before, productOrdinals: { p1: 1 } }, { ...before, productOrdinals: { p1: 2 } }))
      .toBe(false);
  });

  it('reports managedBy and mirrorCategoryId', () => {
    expect(affectsMenuGroupRebuild(before, { ...before, managedBy: 'square' })).toBe(true);
    expect(affectsMenuGroupRebuild(before, { ...before, mirrorCategoryId: 'cat2' })).toBe(true);
  });
});

describe('affectsRebuild', () => {
  it('dispatches by kind', () => {
    expect(affectsRebuild('product', { description: 'a' }, { description: 'b' })).toBe(true);
    // description is tier-2-only for products and not a menuGroup field at all.
    expect(affectsRebuild('menuGroup', { description: 'a' }, { description: 'b' })).toBe(false);
  });

  it('throws on a kind no read-set is declared for', () => {
    expect(() => affectsRebuild('option' as RebuildKind, {}, {})).toThrow(/unknown kind/);
  });
});
