import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rebuildMenus, resolveChangedProducts, resolveChangedCategories } from '../MenuRebuildService';
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

// Mock firebase-admin/firestore
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => mockDb,
  FieldValue: { delete: () => '$$FIELD_DELETE$$' },
}));

// #132: MenuRebuildService reads the pruneMenuAssetsOnRebuild kill switch via getFlags().
// helpers/mockFirestore's doc refs have no .get(), so the real FeatureFlagService cannot run
// here — and every test needs to toggle the flag anyway.
const { mockGetFlags } = vi.hoisted(() => ({ mockGetFlags: vi.fn() }));
vi.mock('../FeatureFlagService', () => ({ getFlags: mockGetFlags }));

// Build the PathResolver collection path mappings
const MENUS_PATH = `businesses/${BUSINESS_ID}/public/surfaces/menus`;
const MENU_GROUPS_PATH = `businesses/${BUSINESS_ID}/public/surfaces/menuGroups`;
const COLLECTIONS_PATH = `businesses/${BUSINESS_ID}/public/surfaces/collections`;
const PRODUCTS_PATH = `businesses/${BUSINESS_ID}/public/catalog/products`;
const CATEGORIES_PATH = `businesses/${BUSINESS_ID}/public/catalog/categories`;
const OPTION_SETS_PATH = `businesses/${BUSINESS_ID}/public/catalog/optionSets`;
const OPTIONS_PATH = `businesses/${BUSINESS_ID}/public/catalog/options`;

// Mock PathResolver to return our collection refs
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

// ─── Setup ───────────────────────────────────────────────────────────

beforeEach(() => {
  resetMockFirestore();

  // #132: resetMockFirestore() calls vi.clearAllMocks(), which drops the mock's resolved
  // value — restore the default (flag on) after it.
  mockGetFlags.mockResolvedValue({ pruneMenuAssetsOnRebuild: true });

  // Register fixture data
  registerCollection(MENUS_PATH, menus);
  registerCollection(MENU_GROUPS_PATH, menuGroups);
  registerCollection(COLLECTIONS_PATH, collections);
  registerCollection(PRODUCTS_PATH, products);
  registerCollection(CATEGORIES_PATH, categories);

  // Setup transaction.get to read from menu store
  mockTransaction.get.mockImplementation(async (ref: any) => {
    const store = new Map<string, any>();
    // Re-read from registered collections by searching all stores
    const path = ref._collectionPath;
    const id = ref._docId;
    // Use registerCollection's internal store via getOrCreateCollectionRef
    // We need to access the data directly
    const collRef = getOrCreateCollectionRef(path);
    const snap = await collRef.get();
    const doc = snap.docs.find((d: any) => d.id === id);
    return {
      id,
      exists: !!doc,
      data: () => doc?.data() ?? undefined,
    };
  });
});

// ─── TC1: Full rebuild exact match ──────────────────────────────────

describe('MenuRebuildService', () => {
  describe('TC1 — Full rebuild exact match', () => {
    it('rebuilds all 4 menus', async () => {
      await rebuildMenus(BUSINESS_ID);
      expect(transactionSets).toHaveLength(4);
    });

    it('preserves structural fields on each menu', async () => {
      await rebuildMenus(BUSINESS_ID);

      const menu1Data = transactionSets.find((s) => s.ref._docId === 'CcUqgkBxEnk1qYaNZ3K2')?.data;
      expect(menu1Data).toBeDefined();
      expect(menu1Data.name).toBe('Main Menu');
      expect(menu1Data.displayName).toBe('Main Menu');
      expect(menu1Data.coverImageGsl).toBe('gs://main-cover.jpg');
      expect(menu1Data.logoImageGsl).toBe('gs://logo.png');
      expect(menu1Data.gratuityRates).toEqual([15, 18, 20]);
      expect(menu1Data.managedBy).toBe('square');
      expect(menu1Data.isDeleted).toBe(false);
      expect(menu1Data.version).toBe('2.0');
    });

    it('each group has required fields: displayName, name, imageGsls, productDisplayOrder, mirrorCategoryId, managedBy', async () => {
      await rebuildMenus(BUSINESS_ID);

      for (const set of transactionSets) {
        const groups: Record<string, any> = set.data.groups;
        for (const [gid, group] of Object.entries(groups)) {
          expect(group).toHaveProperty('displayName');
          expect(group).toHaveProperty('name');
          expect(group).toHaveProperty('imageGsls');
          expect(Array.isArray((group as any).imageGsls)).toBe(true);
          expect(group).toHaveProperty('productDisplayOrder');
          expect(group).toHaveProperty('mirrorCategoryId');
          expect(group).toHaveProperty('managedBy');
        }
      }
    });

    it('each product entry has exactly 6 fields', async () => {
      await rebuildMenus(BUSINESS_ID);

      const expectedFields = ['isActive', 'name', 'imageGsls', 'minPrice', 'variationCount', 'description'];

      for (const set of transactionSets) {
        const groups: Record<string, any> = set.data.groups;
        for (const [, group] of Object.entries(groups)) {
          const prods: Record<string, any> = (group as any).products ?? {};
          for (const [pid, prod] of Object.entries(prods)) {
            const keys = Object.keys(prod as any);
            expect(keys.sort()).toEqual(expectedFields.sort());
          }
        }
      }
    });

    it('minPrice values match source Product docs', async () => {
      await rebuildMenus(BUSINESS_ID);

      const menu1Data = transactionSets.find((s) => s.ref._docId === 'CcUqgkBxEnk1qYaNZ3K2')?.data;
      const allItemsGroup = menu1Data.groups['0YRxtglWpkDyxcW8WCTD'];
      // ozil5WuJ4qeSGhwcusPS should have minPrice: 10 from source Product doc
      expect(allItemsGroup.products.ozil5WuJ4qeSGhwcusPS.minPrice).toBe(10);
    });

    it('collections have 7 fields', async () => {
      await rebuildMenus(BUSINESS_ID);

      const expectedFields = ['name', 'displayName', 'imageGsls', 'videoGsls', 'isUserInteractionEnabled', 'type', 'hyperlink'];

      for (const set of transactionSets) {
        const cols: Record<string, any> = set.data.collections ?? {};
        for (const [, col] of Object.entries(cols)) {
          const keys = Object.keys(col as any);
          expect(keys.sort()).toEqual(expectedFields.sort());
        }
      }
    });
  });

  // ─── TC2: Scoped rebuild — product in all menus ───────────────────

  describe('TC2 — Scoped rebuild: product in all menus', () => {
    it('rebuilds all 4 menus when ozil5WuJ4qeSGhwcusPS changes', async () => {
      await rebuildMenus(BUSINESS_ID, {
        changedProductIds: ['ozil5WuJ4qeSGhwcusPS'],
      });
      expect(transactionSets).toHaveLength(4);
      const menuIds = transactionSets.map((s) => s.ref._docId).sort();
      expect(menuIds).toEqual(['CcUqgkBxEnk1qYaNZ3K2', 'LShRjmDOXBNL7yVSD65V', 'TdGQqmNhA3AjNeoyYrQn', 'menu4'].sort());
    });

    it('product appears in group 0YRxtglWpkDyxcW8WCTD productDisplayOrder', async () => {
      await rebuildMenus(BUSINESS_ID, {
        changedProductIds: ['ozil5WuJ4qeSGhwcusPS'],
      });

      for (const set of transactionSets) {
        const group = set.data.groups['0YRxtglWpkDyxcW8WCTD'];
        expect(group).toBeDefined();
        expect(group.productDisplayOrder).toContain('ozil5WuJ4qeSGhwcusPS');
        expect(group.products.ozil5WuJ4qeSGhwcusPS).toBeDefined();
      }
    });
  });

  // ─── TC3: Scoped rebuild — product in 1 menu ─────────────────────

  describe('TC3 — Scoped rebuild: product in 1 menu', () => {
    it('rebuilds only menu TdGQqmNhA3AjNeoyYrQn', async () => {
      await rebuildMenus(BUSINESS_ID, {
        changedProductIds: ['hE0hUoKxy0KgplK5pfF8'],
      });
      expect(transactionSets).toHaveLength(1);
      expect(transactionSets[0].ref._docId).toBe('TdGQqmNhA3AjNeoyYrQn');
    });

    it('other 3 menus are untouched', async () => {
      await rebuildMenus(BUSINESS_ID, {
        changedProductIds: ['hE0hUoKxy0KgplK5pfF8'],
      });
      const touchedIds = transactionSets.map((s) => s.ref._docId);
      expect(touchedIds).not.toContain('CcUqgkBxEnk1qYaNZ3K2');
      expect(touchedIds).not.toContain('LShRjmDOXBNL7yVSD65V');
      expect(touchedIds).not.toContain('menu4');
    });
  });

  // ─── TC4: Scoped rebuild — collection ─────────────────────────────

  describe('TC4 — Scoped rebuild: collection', () => {
    it('rebuilds only 2 menus with collection I6XLVNjKrBAcBEmqQV0q', async () => {
      await rebuildMenus(BUSINESS_ID, {
        changedCollectionIds: ['I6XLVNjKrBAcBEmqQV0q'],
      });
      expect(transactionSets).toHaveLength(2);
      const menuIds = transactionSets.map((s) => s.ref._docId).sort();
      expect(menuIds).toEqual(['CcUqgkBxEnk1qYaNZ3K2', 'LShRjmDOXBNL7yVSD65V'].sort());
    });

    it('collection metadata has 7 fields matching source', async () => {
      await rebuildMenus(BUSINESS_ID, {
        changedCollectionIds: ['I6XLVNjKrBAcBEmqQV0q'],
      });

      for (const set of transactionSets) {
        const col = set.data.collections.I6XLVNjKrBAcBEmqQV0q;
        expect(col).toBeDefined();
        expect(col.displayName).toBe('signup ');
        expect(col.name).toBe('signup ');
        expect(col.type).toBe('loyaltySignup');
        expect(col.hyperlink).toBe('://rewards');
        expect(col.isUserInteractionEnabled).toBe(false);
        expect(col.imageGsls).toEqual([]);
        expect(col.videoGsls).toEqual([]);
      }
    });
  });

  // ─── TC10: Collection metadata shape ──────────────────────────────

  describe('TC10 — Collection metadata shape', () => {
    it('produces 7-field metadata for signup collection', async () => {
      await rebuildMenus(BUSINESS_ID);

      const menu1 = transactionSets.find((s) => s.ref._docId === 'CcUqgkBxEnk1qYaNZ3K2')?.data;
      const col = menu1.collections.I6XLVNjKrBAcBEmqQV0q;
      expect(col).toBeDefined();
      expect(Object.keys(col)).toHaveLength(7);
      expect(col.displayName).toBe('signup ');
      expect(col.name).toBe('signup ');
      expect(col.type).toBe('loyaltySignup');
      expect(col.hyperlink).toBe('://rewards');
      expect(col.imageGsls).toEqual([]);
      expect(col.videoGsls).toEqual([]);
      expect(col.isUserInteractionEnabled).toBe(false);
    });
  });

  // ─── TC11: Mirrored group preserves ordering ─────────────────────

  describe('TC11 — Mirrored group preserves ordering', () => {
    it('uses category productDisplayOrder for mirrored group', async () => {
      await rebuildMenus(BUSINESS_ID);

      const menu1 = transactionSets.find((s) => s.ref._docId === 'CcUqgkBxEnk1qYaNZ3K2')?.data;
      const mirroredGroup = menu1.groups.lWWo8L7WmEiEJuZgf3dM;
      expect(mirroredGroup).toBeDefined();
      expect(mirroredGroup.mirrorCategoryId).toBe('dKlTguVV2yNCVFJjH2sH');

      const categoryOrder = ['mirP1', 'mirP2', 'mirP3', 'mirP4', 'mirP5', 'mirP6', 'mirP7', 'mirP8', 'mirP9'];
      expect(mirroredGroup.productDisplayOrder).toEqual(categoryOrder);
    });

    it('mirrored group has 9 products with correct data', async () => {
      await rebuildMenus(BUSINESS_ID);

      const menu1 = transactionSets.find((s) => s.ref._docId === 'CcUqgkBxEnk1qYaNZ3K2')?.data;
      const mirroredGroup = menu1.groups.lWWo8L7WmEiEJuZgf3dM;
      const productIds = Object.keys(mirroredGroup.products);
      expect(productIds).toHaveLength(9);

      // Each product has 6 fields
      for (const pid of productIds) {
        const prod = mirroredGroup.products[pid];
        expect(Object.keys(prod).sort()).toEqual(
          ['isActive', 'name', 'imageGsls', 'minPrice', 'variationCount', 'description'].sort(),
        );
      }
    });
  });

  // ─── TC12: managedBy on materialized groups ──────────────────────

  describe('TC12 — managedBy on materialized groups', () => {
    it("copies managedBy 'square' from the source MenuGroup into Menu.groups[id]", async () => {
      await rebuildMenus(BUSINESS_ID);

      const menu1 = transactionSets.find((s) => s.ref._docId === 'CcUqgkBxEnk1qYaNZ3K2')?.data;
      expect(menu1.groups.lWWo8L7WmEiEJuZgf3dM.managedBy).toBe('square');
    });

    // Covers both unmanaged shapes: an explicit null on the source doc, and a
    // legacy doc predating the field. Both resolve through the same `?? null`.
    it('materializes managedBy null for unmanaged and legacy groups', async () => {
      await rebuildMenus(BUSINESS_ID);

      const menu1 = transactionSets.find((s) => s.ref._docId === 'CcUqgkBxEnk1qYaNZ3K2')?.data;
      expect(menu1.groups['0YRxtglWpkDyxcW8WCTD'].managedBy).toBeNull();
      expect(menu1.groups.mg4.managedBy).toBeNull();
    });

    // managedBy is optional on MenuGroupMeta only because menuGroupMeta() projects a
    // narrower subset; the rebuild path must always write a concrete value. Two things
    // depend on that: kios-commons-types mirrors the field as non-optional, and a
    // Firestore write of `undefined` throws.
    it('every materialized group has a concrete managedBy key (never undefined)', async () => {
      await rebuildMenus(BUSINESS_ID);

      let groupCount = 0;
      for (const set of transactionSets) {
        const groups: Record<string, { managedBy?: unknown }> = set.data.groups;
        for (const [, group] of Object.entries(groups)) {
          groupCount++;
          const { managedBy } = group;
          expect(managedBy === null || typeof managedBy === 'string').toBe(true);
        }
      }
      expect(groupCount).toBeGreaterThan(0);
    });
  });

  // ─── TC: Scoped rebuild — changedMenuGroupIds ────────────────────

  describe('changedMenuGroupIds', () => {
    it('rebuilds only the menu containing SKoGd62OfNyZqMXqsKSX', async () => {
      await rebuildMenus(BUSINESS_ID, {
        changedMenuGroupIds: ['SKoGd62OfNyZqMXqsKSX'],
      });
      expect(transactionSets).toHaveLength(1);
      expect(transactionSets[0].ref._docId).toBe('TdGQqmNhA3AjNeoyYrQn');
    });

    it('does not rebuild menus without the changed menuGroup', async () => {
      await rebuildMenus(BUSINESS_ID, {
        changedMenuGroupIds: ['SKoGd62OfNyZqMXqsKSX'],
      });
      const menuIds = transactionSets.map((s) => s.ref._docId);
      expect(menuIds).not.toContain('CcUqgkBxEnk1qYaNZ3K2');
      expect(menuIds).not.toContain('LShRjmDOXBNL7yVSD65V');
      expect(menuIds).not.toContain('menu4');
    });

    it('unions with changedProductIds', async () => {
      await rebuildMenus(BUSINESS_ID, {
        changedMenuGroupIds: ['SKoGd62OfNyZqMXqsKSX'], // only in TdGQqmNhA3AjNeoyYrQn
        changedProductIds: ['hE0hUoKxy0KgplK5pfF8'], // also only in TdGQqmNhA3AjNeoyYrQn
      });
      expect(transactionSets).toHaveLength(1);
      expect(transactionSets[0].ref._docId).toBe('TdGQqmNhA3AjNeoyYrQn');
    });

    it('no-ops when empty array', async () => {
      await rebuildMenus(BUSINESS_ID, {
        changedMenuGroupIds: [],
      });
      // Empty scope with no other fields => no menus selected
      expect(transactionSets).toHaveLength(0);
    });
  });

  // ─── Part A — changedCategoryIds (#79) ────────────────────────────

  describe('Part A — changedCategoryIds', () => {
    const MIRROR_CATEGORY = 'dKlTguVV2yNCVFJjH2sH';
    const MIRROR_MENU = 'CcUqgkBxEnk1qYaNZ3K2'; // only menu containing the mirror group

    it('rebuilds the mirror menu when its mirrorCategoryId is in changedCategoryIds', async () => {
      await rebuildMenus(BUSINESS_ID, {
        changedCategoryIds: [MIRROR_CATEGORY],
      });
      expect(transactionSets).toHaveLength(1);
      expect(transactionSets[0].ref._docId).toBe(MIRROR_MENU);
    });

    it('does not rebuild menus without a group mirroring the changed category', async () => {
      await rebuildMenus(BUSINESS_ID, {
        changedCategoryIds: [MIRROR_CATEGORY],
      });
      const menuIds = transactionSets.map((s) => s.ref._docId);
      expect(menuIds).not.toContain('LShRjmDOXBNL7yVSD65V');
      expect(menuIds).not.toContain('TdGQqmNhA3AjNeoyYrQn');
      expect(menuIds).not.toContain('menu4');
    });

    it('no-ops on empty changedCategoryIds', async () => {
      await rebuildMenus(BUSINESS_ID, {
        changedCategoryIds: [],
      });
      expect(transactionSets).toHaveLength(0);
    });

    it('no-ops on unknown changedCategoryIds', async () => {
      await rebuildMenus(BUSINESS_ID, {
        changedCategoryIds: ['no-such-category'],
      });
      expect(transactionSets).toHaveLength(0);
    });

    it('unions changedCategoryIds with changedProductIds (2 menus)', async () => {
      await rebuildMenus(BUSINESS_ID, {
        changedCategoryIds: [MIRROR_CATEGORY], // → CcUqgkBxEnk1qYaNZ3K2
        changedProductIds: ['hE0hUoKxy0KgplK5pfF8'], // → TdGQqmNhA3AjNeoyYrQn
      });
      expect(transactionSets).toHaveLength(2);
      const menuIds = transactionSets.map((s) => s.ref._docId).sort();
      expect(menuIds).toEqual(['CcUqgkBxEnk1qYaNZ3K2', 'TdGQqmNhA3AjNeoyYrQn'].sort());
    });

    it('selects mirror menu when a changedProductId lives only in the mirror category, not the stale group snapshot', async () => {
      // Mirror group's own productDisplayOrder is stale (missing mirP9);
      // category still lists mirP9. A change to mirP9 must still select the menu.
      registerCollection(MENU_GROUPS_PATH, menuGroups.map((g) => (
        g.id === 'lWWo8L7WmEiEJuZgf3dM'
          ? {
            ...g,
            data: {
              ...g.data,
              // stale: missing mirP9 (lives only on the category)
              productDisplayOrder: ['mirP1', 'mirP2', 'mirP3', 'mirP4', 'mirP5', 'mirP6', 'mirP7', 'mirP8'],
            },
          }
          : g
      )));

      await rebuildMenus(BUSINESS_ID, {
        changedProductIds: ['mirP9'],
      });

      const menuIds = transactionSets.map((s) => s.ref._docId);
      expect(menuIds).toContain(MIRROR_MENU);
    });
  });

  // ─── Part B — mirror prefetch superset / no danglers (#79) ────────

  describe('Part B — mirror prefetch superset (no danglers)', () => {
    const MIRROR_GROUP = 'lWWo8L7WmEiEJuZgf3dM';
    const MIRROR_MENU = 'CcUqgkBxEnk1qYaNZ3K2';
    const FULL_CATEGORY_ORDER = ['mirP1', 'mirP2', 'mirP3', 'mirP4', 'mirP5', 'mirP6', 'mirP7', 'mirP8', 'mirP9'];

    function getMirrorGroup() {
      const menu = transactionSets.find((s) => s.ref._docId === MIRROR_MENU)?.data;
      return menu.groups[MIRROR_GROUP];
    }

    it('materializes category products absent from the stale group snapshot', async () => {
      // Group snapshot is stale (only 3 products); category has all 9.
      registerCollection(MENU_GROUPS_PATH, menuGroups.map((g) => (
        g.id === MIRROR_GROUP
          ? { ...g, data: { ...g.data, productDisplayOrder: ['mirP1', 'mirP2', 'mirP3'] } }
          : g
      )));

      await rebuildMenus(BUSINESS_ID, { menuIds: [MIRROR_MENU] });

      const group = getMirrorGroup();
      expect(group.productDisplayOrder).toEqual(FULL_CATEGORY_ORDER);
      // Every entry has a products[pid] (no danglers)
      for (const pid of group.productDisplayOrder) {
        expect(group.products[pid]).toBeDefined();
      }
      expect(Object.keys(group.products).sort()).toEqual(FULL_CATEGORY_ORDER.slice().sort());
    });

    it('materializes a product newly added to the mirrored category', async () => {
      // Category gains mirP10; group snapshot does not know about it.
      registerCollection(CATEGORIES_PATH, categories.map((c) => (
        c.id === 'dKlTguVV2yNCVFJjH2sH'
          ? { ...c, data: { ...c.data, productDisplayOrder: [...FULL_CATEGORY_ORDER, 'mirP10'] } }
          : c
      )));
      registerCollection(PRODUCTS_PATH, [
        ...products,
        { id: 'mirP10', data: { name: 'Mirror Product 10', isActive: true, imageGsls: [], minPrice: 1000, maxPrice: 1000, variationCount: 1, description: 'Mirror Product 10 description', isDeleted: false } },
      ]);

      await rebuildMenus(BUSINESS_ID, { menuIds: [MIRROR_MENU] });

      const group = getMirrorGroup();
      expect(group.productDisplayOrder).toContain('mirP10');
      expect(group.products.mirP10).toBeDefined();
      expect(group.products.mirP10.minPrice).toBe(1000);
    });

    it('drops a product removed from the mirrored category', async () => {
      // Category loses mirP9.
      registerCollection(CATEGORIES_PATH, categories.map((c) => (
        c.id === 'dKlTguVV2yNCVFJjH2sH'
          ? { ...c, data: { ...c.data, productDisplayOrder: FULL_CATEGORY_ORDER.slice(0, 8) } }
          : c
      )));

      await rebuildMenus(BUSINESS_ID, { menuIds: [MIRROR_MENU] });

      const group = getMirrorGroup();
      expect(group.productDisplayOrder).not.toContain('mirP9');
      expect(group.products.mirP9).toBeUndefined();
    });

    it('every productDisplayOrder entry has a products entry across all rebuilt menus (invariant)', async () => {
      // Stale group snapshot to force reliance on the category-derived prefetch.
      registerCollection(MENU_GROUPS_PATH, menuGroups.map((g) => (
        g.id === MIRROR_GROUP
          ? { ...g, data: { ...g.data, productDisplayOrder: [] } }
          : g
      )));

      await rebuildMenus(BUSINESS_ID);

      for (const set of transactionSets) {
        const groups: Record<string, any> = set.data.groups;
        for (const group of Object.values(groups)) {
          for (const pid of (group as any).productDisplayOrder as string[]) {
            expect((group as any).products[pid]).toBeDefined();
          }
        }
      }
    });
  });

  // ─── resolveChangedCategories (#79) ───────────────────────────────

  describe('resolveChangedCategories', () => {
    it('returns categories matching the syncTraceId', async () => {
      registerCollection(CATEGORIES_PATH, [
        { id: 'cat-a', data: { syncTraceId: 'trace-1' } },
        { id: 'cat-b', data: { syncTraceId: 'trace-1' } },
        { id: 'cat-c', data: { syncTraceId: 'other' } },
      ]);

      const result = await resolveChangedCategories(BUSINESS_ID, 'trace-1');
      expect(result.sort()).toEqual(['cat-a', 'cat-b']);
    });

    it('returns empty when none match', async () => {
      registerCollection(CATEGORIES_PATH, [
        { id: 'cat-a', data: { syncTraceId: 'other' } },
      ]);

      const result = await resolveChangedCategories(BUSINESS_ID, 'no-match');
      expect(result).toEqual([]);
    });
  });

  // ─── resolveChangedProducts ───────────────────────────────────────

  describe('resolveChangedProducts', () => {
    it('returns directly changed products', async () => {
      registerCollection(PRODUCTS_PATH, [
        { id: 'prod-1', data: { syncTraceId: 'trace-1', optionSets: {} } },
        { id: 'prod-2', data: { syncTraceId: 'trace-1', optionSets: {} } },
        { id: 'prod-3', data: { syncTraceId: 'other', optionSets: {} } },
      ]);
      registerCollection(OPTION_SETS_PATH, []);
      registerCollection(OPTIONS_PATH, []);

      const result = await resolveChangedProducts(BUSINESS_ID, 'trace-1');
      expect(result.sort()).toEqual(['prod-1', 'prod-2']);
    });

    it('walks up from options to optionSets to products', async () => {
      registerCollection(PRODUCTS_PATH, [
        { id: 'prod-1', data: { syncTraceId: 'other', optionSets: { 'os-1': {} } } },
      ]);
      registerCollection(OPTION_SETS_PATH, [
        { id: 'os-1', data: { syncTraceId: 'other', options: { 'opt-1': {} } } },
      ]);
      registerCollection(OPTIONS_PATH, [
        { id: 'opt-1', data: { syncTraceId: 'trace-1' } },
      ]);

      const result = await resolveChangedProducts(BUSINESS_ID, 'trace-1');
      expect(result).toContain('prod-1');
    });

    it('returns empty array when no matches', async () => {
      registerCollection(PRODUCTS_PATH, [
        { id: 'prod-1', data: { syncTraceId: 'other', optionSets: {} } },
      ]);
      registerCollection(OPTION_SETS_PATH, []);
      registerCollection(OPTIONS_PATH, []);

      const result = await resolveChangedProducts(BUSINESS_ID, 'no-match');
      expect(result).toEqual([]);
    });
  });

  // ─── Edge cases ───────────────────────────────────────────────────

  describe('edge cases', () => {
    it('no-op when no menus exist', async () => {
      registerCollection(MENUS_PATH, []);
      await rebuildMenus(BUSINESS_ID);
      expect(transactionSets).toHaveLength(0);
    });

    it('skips deleted groups', async () => {
      registerCollection(MENU_GROUPS_PATH, [
        { id: 'g1', data: { name: 'Deleted Group', displayName: 'X', imageGsls: [], productDisplayOrder: ['p3'], mirrorCategoryId: null, isDeleted: true } },
      ]);
      registerCollection(MENUS_PATH, [{
        id: 'm1',
        data: {
          name: 'Test', displayName: null, coverImageGsl: null, coverBackgroundImageGsl: null,
          coverVideoGsl: null, logoImageGsl: null, gratuityRates: [], managedBy: null,
          isDeleted: false, created: new Date(), updated: new Date(), version: '1.0',
          groupDisplayOrder: ['g1'],
          groups: { g1: { name: 'Deleted Group', displayName: 'X' } },
          menuAssets: { g1: { assetType: 'group' } },
          menuAssetDisplayOrder: ['g1'],
        },
      }]);

      await rebuildMenus(BUSINESS_ID);
      expect(transactionSets).toHaveLength(1);
      expect(transactionSets[0].data.groups).toEqual({});
      // #132: the deleted group's asset ref and display-order entries go with it
      expect(transactionSets[0].data.menuAssets).toEqual({});
      expect(transactionSets[0].data.menuAssetDisplayOrder).toEqual([]);
      expect(transactionSets[0].data.groupDisplayOrder).toEqual([]);
    });

    it('includes menu group added without legacy assetId field', async () => {
      registerCollection(MENU_GROUPS_PATH, [
        ...menuGroups,
        {
          id: 'new-group',
          data: {
            name: 'New Group', displayName: 'New', isDeleted: false,
            productDisplayOrder: ['ozil5WuJ4qeSGhwcusPS'],
            imageGsls: [], mirrorCategoryId: null,
          },
        },
      ]);
      registerCollection(MENUS_PATH, [
        ...menus,
        {
          id: 'testMenu',
          data: {
            name: 'Test', displayName: null, coverImageGsl: null, coverBackgroundImageGsl: null,
            coverVideoGsl: null, logoImageGsl: null, gratuityRates: [], managedBy: null,
            isDeleted: false, created: new Date(), updated: new Date(), version: '1.0',
            groupDisplayOrder: ['new-group'],
            groups: { 'new-group': { name: 'New Group', displayName: 'New' } },
            menuAssets: { 'new-group': { assetType: 'group' } },
            menuAssetDisplayOrder: ['new-group'],
          },
        },
      ]);

      await rebuildMenus(BUSINESS_ID, { menuIds: ['testMenu'] });
      expect(transactionSets).toHaveLength(1);
      expect(transactionSets[0].data.groups['new-group']).toBeDefined();
      expect(transactionSets[0].data.groups['new-group'].name).toBe('New Group');
    });

    it('scope union: combining changedProductIds and changedCollectionIds', async () => {
      await rebuildMenus(BUSINESS_ID, {
        changedProductIds: ['hE0hUoKxy0KgplK5pfF8'], // only in TdGQqmNhA3AjNeoyYrQn
        changedCollectionIds: ['I6XLVNjKrBAcBEmqQV0q'], // in CcUqgkBxEnk1qYaNZ3K2 and LShRjmDOXBNL7yVSD65V
      });
      expect(transactionSets).toHaveLength(3);
      const menuIds = transactionSets.map((s) => s.ref._docId).sort();
      expect(menuIds).toEqual(['CcUqgkBxEnk1qYaNZ3K2', 'LShRjmDOXBNL7yVSD65V', 'TdGQqmNhA3AjNeoyYrQn'].sort());
    });
  });

  // ─── #132 — prunes dangling menuAssets refs ─────────────────────────

  describe('#132 — prunes dangling menuAssets refs', () => {
    const PRUNE_MENU = 'prune-menu';
    const LIVE_GROUP = '0YRxtglWpkDyxcW8WCTD';
    const LIVE_GROUP_2 = 'mg4';
    const LIVE_COLLECTION = 'I6XLVNjKrBAcBEmqQV0q';

    type AssetMap = Record<string, { assetType: string }>;
    interface MenuAssetOverrides {
      menuAssets: AssetMap;
      menuAssetDisplayOrder?: string[];
      groupDisplayOrder?: string[];
    }

    // Pruning is expected in most of these tests; keep its console.warn out of the test output
    // while still making it assertable (T7/T8).
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    /**
     * Builds one menu doc with the given asset/display-order shape and structural defaults.
     * Display-order fields are omitted entirely when not supplied, so a caller can exercise
     * the legacy "field absent from the doc" shape.
     */
    function makePruneMenuDoc(overrides: MenuAssetOverrides) {
      const data: Record<string, unknown> = {
        name: 'Prune Menu',
        displayName: 'Prune',
        coverImageGsl: null,
        coverBackgroundImageGsl: null,
        coverVideoGsl: null,
        logoImageGsl: null,
        gratuityRates: [],
        managedBy: null,
        isDeleted: false,
        created: new Date('2024-01-01'),
        updated: new Date('2024-06-01'),
        version: '2.0',
        groups: {},
        collections: {},
        menuAssets: overrides.menuAssets,
      };
      if (overrides.menuAssetDisplayOrder !== undefined) {
        data.menuAssetDisplayOrder = overrides.menuAssetDisplayOrder;
      }
      if (overrides.groupDisplayOrder !== undefined) {
        data.groupDisplayOrder = overrides.groupDisplayOrder;
      }
      return { id: PRUNE_MENU, data };
    }

    function registerMenuWithAssets(overrides: MenuAssetOverrides) {
      registerCollection(MENUS_PATH, [makePruneMenuDoc(overrides)]);
    }

    function written() {
      return transactionSets.find((s) => s.ref._docId === PRUNE_MENU)?.data;
    }

    // T1
    it('prunes a group-typed asset whose menuGroup doc does not exist from menuAssets, menuAssetDisplayOrder and groupDisplayOrder', async () => {
      registerMenuWithAssets({
        menuAssets: {
          [LIVE_GROUP]: { assetType: 'group' },
          ghost: { assetType: 'group' },
          [LIVE_GROUP_2]: { assetType: 'group' },
        },
        menuAssetDisplayOrder: [LIVE_GROUP, 'ghost', LIVE_GROUP_2],
        groupDisplayOrder: ['ghost', LIVE_GROUP, LIVE_GROUP_2],
      });

      await rebuildMenus(BUSINESS_ID);

      const data = written();
      expect(Object.keys(data.menuAssets).sort()).toEqual([LIVE_GROUP, LIVE_GROUP_2].sort());
      expect(data.menuAssetDisplayOrder).toEqual([LIVE_GROUP, LIVE_GROUP_2]);
      expect(data.groupDisplayOrder).toEqual([LIVE_GROUP, LIVE_GROUP_2]);
    });

    // T2
    it('prunes a collection-typed asset whose collection doc does not exist', async () => {
      registerMenuWithAssets({
        menuAssets: {
          [LIVE_GROUP]: { assetType: 'group' },
          [LIVE_COLLECTION]: { assetType: 'collection' },
          ghostCol: { assetType: 'collection' },
        },
        menuAssetDisplayOrder: [LIVE_GROUP, 'ghostCol', LIVE_COLLECTION],
        groupDisplayOrder: [LIVE_GROUP],
      });

      await rebuildMenus(BUSINESS_ID);

      const data = written();
      expect(Object.keys(data.menuAssets).sort()).toEqual([LIVE_GROUP, LIVE_COLLECTION].sort());
      expect(data.menuAssetDisplayOrder).toEqual([LIVE_GROUP, LIVE_COLLECTION]);
      // groupDisplayOrder never contained the collection id, so it is untouched
      expect(data.groupDisplayOrder).toEqual([LIVE_GROUP]);
    });

    // T3
    it('prunes a group whose doc exists but is isDeleted, same as a missing doc', async () => {
      registerCollection(MENU_GROUPS_PATH, [
        ...menuGroups,
        {
          id: 'deletedGroup',
          data: {
            name: 'Deleted Group',
            displayName: 'Deleted',
            imageGsls: [],
            productDisplayOrder: [],
            mirrorCategoryId: null,
            isDeleted: true,
          },
        },
      ]);
      registerMenuWithAssets({
        menuAssets: {
          [LIVE_GROUP]: { assetType: 'group' },
          deletedGroup: { assetType: 'group' },
        },
        menuAssetDisplayOrder: [LIVE_GROUP, 'deletedGroup'],
        groupDisplayOrder: [LIVE_GROUP, 'deletedGroup'],
      });

      await rebuildMenus(BUSINESS_ID);

      const data = written();
      expect(Object.keys(data.menuAssets)).toEqual([LIVE_GROUP]);
      expect(data.menuAssetDisplayOrder).toEqual([LIVE_GROUP]);
      expect(data.groupDisplayOrder).toEqual([LIVE_GROUP]);
    });

    // T4
    it('preserves menuAssets, menuAssetDisplayOrder and groupDisplayOrder verbatim when pruneMenuAssetsOnRebuild is false', async () => {
      mockGetFlags.mockResolvedValue({ pruneMenuAssetsOnRebuild: false });

      const menuAssets = {
        [LIVE_GROUP]: { assetType: 'group' },
        ghost: { assetType: 'group' },
        [LIVE_GROUP_2]: { assetType: 'group' },
      };
      registerMenuWithAssets({
        menuAssets,
        menuAssetDisplayOrder: [LIVE_GROUP, 'ghost', LIVE_GROUP_2],
        groupDisplayOrder: ['ghost', LIVE_GROUP, LIVE_GROUP_2],
      });

      await rebuildMenus(BUSINESS_ID);

      const data = written();
      expect(data.menuAssets).toEqual(menuAssets);
      expect(data.menuAssetDisplayOrder).toEqual([LIVE_GROUP, 'ghost', LIVE_GROUP_2]);
      expect(data.groupDisplayOrder).toEqual(['ghost', LIVE_GROUP, LIVE_GROUP_2]);
    });

    // T5 (R1)
    it('preserves product- and htmlText-typed assets whose ids have no backing group or collection doc', async () => {
      registerMenuWithAssets({
        menuAssets: {
          p_only: { assetType: 'product' },
          html1: { assetType: 'htmlText' },
          ghost: { assetType: 'group' },
        },
        menuAssetDisplayOrder: ['p_only', 'ghost', 'html1'],
        groupDisplayOrder: ['ghost'],
      });

      await rebuildMenus(BUSINESS_ID);

      const data = written();
      expect(Object.keys(data.menuAssets).sort()).toEqual(['html1', 'p_only']);
      expect(data.menuAssetDisplayOrder).toEqual(['p_only', 'html1']);
      expect(data.groupDisplayOrder).toEqual([]);
    });

    // T6 (R2)
    it('leaves groupDisplayOrder untouched for legacy menus with an empty menuAssets map', async () => {
      registerMenuWithAssets({
        menuAssets: {},
        menuAssetDisplayOrder: [],
        groupDisplayOrder: [LIVE_GROUP, LIVE_GROUP_2],
      });

      await rebuildMenus(BUSINESS_ID);

      const data = written();
      expect(data.groupDisplayOrder).toEqual([LIVE_GROUP, LIVE_GROUP_2]);
      expect(data.menuAssets).toEqual({});
      expect(data.menuAssetDisplayOrder).toEqual([]);
    });

    // T7
    it('logs the pruned ids with businessId and menuId', async () => {
      registerMenuWithAssets({
        menuAssets: {
          [LIVE_GROUP]: { assetType: 'group' },
          ghost: { assetType: 'group' },
        },
        menuAssetDisplayOrder: [LIVE_GROUP, 'ghost'],
        groupDisplayOrder: [LIVE_GROUP, 'ghost'],
      });

      await rebuildMenus(BUSINESS_ID);

      expect(warnSpy).toHaveBeenCalledWith(
        '[MenuRebuildService] pruned dangling asset refs',
        { businessId: BUSINESS_ID, menuId: PRUNE_MENU, prunedIds: ['ghost'] },
      );
    });

    // T8
    it('does not log when nothing was pruned', async () => {
      await rebuildMenus(BUSINESS_ID);

      expect(warnSpy).not.toHaveBeenCalledWith(
        '[MenuRebuildService] pruned dangling asset refs',
        expect.anything(),
      );
    });

    // T9
    it('rebuilds clean fixture menus with menuAssets, menuAssetDisplayOrder and groupDisplayOrder byte-identical to the source docs', async () => {
      await rebuildMenus(BUSINESS_ID);

      expect(transactionSets).toHaveLength(menus.length);
      for (const source of menus) {
        const data = transactionSets.find((s) => s.ref._docId === source.id)?.data;
        expect(data).toBeDefined();
        expect(data.menuAssets).toEqual(source.data.menuAssets);
        expect(data.menuAssetDisplayOrder).toEqual(source.data.menuAssetDisplayOrder);
        expect(data.groupDisplayOrder).toEqual(source.data.groupDisplayOrder);
      }
    });

    // T10
    it('removes every group and collection asset when none of the backing docs exist', async () => {
      registerMenuWithAssets({
        menuAssets: {
          ghost1: { assetType: 'group' },
          ghost2: { assetType: 'group' },
          ghostCol: { assetType: 'collection' },
        },
        menuAssetDisplayOrder: ['ghost1', 'ghostCol', 'ghost2'],
        groupDisplayOrder: ['ghost1', 'ghost2'],
      });

      await rebuildMenus(BUSINESS_ID);

      const data = written();
      expect(data.menuAssets).toEqual({});
      expect(data.menuAssetDisplayOrder).toEqual([]);
      expect(data.groupDisplayOrder).toEqual([]);
    });

    // T11
    it('is a no-op for a menu with empty menuAssets and empty display orders', async () => {
      registerMenuWithAssets({
        menuAssets: {},
        menuAssetDisplayOrder: [],
        groupDisplayOrder: [],
      });

      await rebuildMenus(BUSINESS_ID);

      const data = written();
      expect(data.menuAssets).toEqual({});
      expect(data.menuAssetDisplayOrder).toEqual([]);
      expect(data.groupDisplayOrder).toEqual([]);
    });

    // T12
    it('handles a menu doc missing menuAssetDisplayOrder and groupDisplayOrder entirely', async () => {
      registerMenuWithAssets({
        menuAssets: {
          [LIVE_GROUP]: { assetType: 'group' },
          ghost: { assetType: 'group' },
        },
      });

      await rebuildMenus(BUSINESS_ID);

      const data = written();
      expect(Object.keys(data.menuAssets)).toEqual([LIVE_GROUP]);
      expect(data.menuAssetDisplayOrder).toEqual([]);
      expect(data.groupDisplayOrder).toEqual([]);
    });

    // T13
    it('keeps every group/collection menuAssets key present in the written groups or collections map', async () => {
      registerCollection(MENUS_PATH, [
        ...menus,
        makePruneMenuDoc({
          menuAssets: {
            [LIVE_GROUP]: { assetType: 'group' },
            ghost: { assetType: 'group' },
            ghostCol: { assetType: 'collection' },
            [LIVE_COLLECTION]: { assetType: 'collection' },
          },
          menuAssetDisplayOrder: [LIVE_GROUP, 'ghost', 'ghostCol', LIVE_COLLECTION],
          groupDisplayOrder: [LIVE_GROUP, 'ghost'],
        }),
      ]);

      await rebuildMenus(BUSINESS_ID);

      expect(transactionSets).toHaveLength(menus.length + 1);
      for (const set of transactionSets) {
        const assets: AssetMap = set.data.menuAssets;
        for (const [id, asset] of Object.entries(assets)) {
          if (asset.assetType === 'group') {
            expect(set.data.groups[id]).toBeDefined();
          } else if (asset.assetType === 'collection') {
            expect(set.data.collections[id]).toBeDefined();
          }
        }
      }
    });

    // E3
    it('propagates a feature-flag read failure instead of pruning or preserving silently', async () => {
      mockGetFlags.mockRejectedValue(new Error('flag read failed'));
      registerMenuWithAssets({
        menuAssets: { [LIVE_GROUP]: { assetType: 'group' } },
        menuAssetDisplayOrder: [LIVE_GROUP],
        groupDisplayOrder: [LIVE_GROUP],
      });

      await expect(rebuildMenus(BUSINESS_ID)).rejects.toThrow('flag read failed');
      expect(transactionSets).toHaveLength(0);
    });
  });

  // ─── TOCTOU race condition (issue #50) ──────────────────────────────

  describe('TOCTOU race condition (issue #50)', () => {
    /**
     * Helper: register a single menu and its dependencies for TOCTOU tests.
     * Returns the menu data for assertions.
     */
    function setupSingleMenu(overrides?: {
      bulkMenuAssets?: Record<string, any>;
      bulkMenuAssetDisplayOrder?: string[];
      bulkVersion?: string;
    }) {
      const menuAssets = overrides?.bulkMenuAssets ?? {
        '0YRxtglWpkDyxcW8WCTD': { assetType: 'group' },
      };
      const menuAssetDisplayOrder = overrides?.bulkMenuAssetDisplayOrder ?? ['0YRxtglWpkDyxcW8WCTD'];
      const version = overrides?.bulkVersion ?? '1.0';

      const menuData = {
        name: 'Test Menu',
        displayName: 'Test',
        coverImageGsl: null,
        coverBackgroundImageGsl: null,
        coverVideoGsl: null,
        logoImageGsl: null,
        gratuityRates: [],
        managedBy: null,
        isDeleted: false,
        created: new Date(),
        updated: new Date(),
        version,
        groupDisplayOrder: ['0YRxtglWpkDyxcW8WCTD'],
        groups: { '0YRxtglWpkDyxcW8WCTD': { name: 'All Items', displayName: 'All Items' } },
        menuAssets,
        menuAssetDisplayOrder,
      };

      registerCollection(MENUS_PATH, [{ id: 'toctou-menu', data: menuData }]);
      registerCollection(MENU_GROUPS_PATH, menuGroups);
      registerCollection(COLLECTIONS_PATH, collections);
      registerCollection(PRODUCTS_PATH, products);
      registerCollection(CATEGORIES_PATH, categories);

      return menuData;
    }

    it('uses fresh menuAssets and menuAssetDisplayOrder from transaction read (no race)', async () => {
      const bulkData = setupSingleMenu();

      // Transaction returns data with different menuAssetDisplayOrder ordering (but same assets)
      const freshOrder = ['0YRxtglWpkDyxcW8WCTD'];
      // Same keys, just different displayOrder to prove we use fresh values
      const freshDisplayOrder = ['0YRxtglWpkDyxcW8WCTD'];

      mockTransaction.get.mockImplementation(async () => ({
        id: 'toctou-menu',
        exists: true,
        data: () => ({
          ...bulkData,
          menuAssetDisplayOrder: freshDisplayOrder,
        }),
      }));

      await rebuildMenus(BUSINESS_ID, { menuIds: ['toctou-menu'] });

      expect(transactionSets).toHaveLength(1);
      const written = transactionSets[0].data;
      // Should use the fresh menuAssetDisplayOrder from existingData
      expect(written.menuAssetDisplayOrder).toEqual(freshDisplayOrder);
      // menuAssets should come from existingData
      expect(written.menuAssets).toEqual(bulkData.menuAssets);
    });

    it('retries rebuild when menuAssets change between bulk read and transaction', async () => {
      const bulkData = setupSingleMenu();

      let runTransactionCallCount = 0;

      // Override runTransaction to track calls and vary transaction.get behavior
      mockDb.runTransaction.mockImplementation(async (fn: (t: any) => Promise<void>) => {
        runTransactionCallCount++;
        if (runTransactionCallCount === 1) {
          // First attempt: transaction returns different menuAssets (extra asset)
          mockTransaction.get.mockResolvedValueOnce({
            id: 'toctou-menu',
            exists: true,
            data: () => ({
              ...bulkData,
              menuAssets: {
                '0YRxtglWpkDyxcW8WCTD': { assetType: 'group' as const },
                'newAsset': { assetType: 'collection' as const },
              },
              menuAssetDisplayOrder: ['0YRxtglWpkDyxcW8WCTD', 'newAsset'],
            }),
          });
        } else {
          // Second attempt: consistent data (includes newAsset which is now in the bulk read too)
          mockTransaction.get.mockResolvedValueOnce({
            id: 'toctou-menu',
            exists: true,
            data: () => ({
              ...bulkData,
              menuAssets: {
                '0YRxtglWpkDyxcW8WCTD': { assetType: 'group' as const },
                'newAsset': { assetType: 'collection' as const },
              },
              menuAssetDisplayOrder: ['0YRxtglWpkDyxcW8WCTD', 'newAsset'],
            }),
          });
        }
        await fn(mockTransaction);
      });

      await rebuildMenus(BUSINESS_ID, { menuIds: ['toctou-menu'] });

      // runTransaction should have been called twice (once per attempt)
      expect(mockDb.runTransaction).toHaveBeenCalledTimes(2);
      // Only the second attempt should have written
      expect(transactionSets).toHaveLength(1);
    });

    // #132 / T14
    it('aborts and retries when menuAssets change between bulk read and transaction while pruning is active', async () => {
      const bulkData = setupSingleMenu();

      // 'newAsset' is a collection id with no backing collection doc — the retry attempt must
      // write the FRESH asset set with that dangling id pruned.
      const freshMenuAssets = {
        '0YRxtglWpkDyxcW8WCTD': { assetType: 'group' as const },
        newAsset: { assetType: 'collection' as const },
      };

      mockDb.runTransaction.mockImplementation(async (fn: (t: any) => Promise<void>) => {
        mockTransaction.get.mockResolvedValueOnce({
          id: 'toctou-menu',
          exists: true,
          data: () => ({
            ...bulkData,
            menuAssets: freshMenuAssets,
            menuAssetDisplayOrder: ['0YRxtglWpkDyxcW8WCTD', 'newAsset'],
            groupDisplayOrder: ['0YRxtglWpkDyxcW8WCTD', 'newAsset'],
          }),
        });
        await fn(mockTransaction);
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      await rebuildMenus(BUSINESS_ID, { menuIds: ['toctou-menu'] });

      warnSpy.mockRestore();

      // First attempt aborts on divergence; second attempt re-reads with the fresh assets.
      expect(mockDb.runTransaction).toHaveBeenCalledTimes(2);
      expect(transactionSets).toHaveLength(1);

      const written = transactionSets[0].data;
      expect(written.menuAssets).toEqual({ '0YRxtglWpkDyxcW8WCTD': { assetType: 'group' } });
      expect(written.menuAssetDisplayOrder).toEqual(['0YRxtglWpkDyxcW8WCTD']);
      expect(written.groupDisplayOrder).toEqual(['0YRxtglWpkDyxcW8WCTD']);
    });

    it('writes fresh version from transaction, not stale snapshot version', async () => {
      setupSingleMenu({ bulkVersion: '1.0' });

      mockTransaction.get.mockImplementation(async () => ({
        id: 'toctou-menu',
        exists: true,
        data: () => ({
          name: 'Test Menu',
          displayName: 'Test',
          coverImageGsl: null,
          coverBackgroundImageGsl: null,
          coverVideoGsl: null,
          logoImageGsl: null,
          gratuityRates: [],
          managedBy: null,
          isDeleted: false,
          created: new Date(),
          updated: new Date(),
          version: '2.0',
          groupDisplayOrder: ['0YRxtglWpkDyxcW8WCTD'],
          menuAssets: { '0YRxtglWpkDyxcW8WCTD': { assetType: 'group' } },
          menuAssetDisplayOrder: ['0YRxtglWpkDyxcW8WCTD'],
        }),
      }));

      await rebuildMenus(BUSINESS_ID, { menuIds: ['toctou-menu'] });

      expect(transactionSets).toHaveLength(1);
      expect(transactionSets[0].data.version).toBe('2.0');
    });

    it('throws after exceeding max retries', async () => {
      setupSingleMenu();

      let callCount = 0;

      // Every transaction returns different menuAssets
      mockDb.runTransaction.mockImplementation(async (fn: (t: any) => Promise<void>) => {
        callCount++;
        mockTransaction.get.mockResolvedValueOnce({
          id: 'toctou-menu',
          exists: true,
          data: () => ({
            name: 'Test Menu',
            displayName: 'Test',
            coverImageGsl: null,
            coverBackgroundImageGsl: null,
            coverVideoGsl: null,
            logoImageGsl: null,
            gratuityRates: [],
            managedBy: null,
            isDeleted: false,
            created: new Date(),
            updated: new Date(),
            version: '1.0',
            groupDisplayOrder: ['0YRxtglWpkDyxcW8WCTD'],
            menuAssets: {
              '0YRxtglWpkDyxcW8WCTD': { assetType: 'group' },
              [`divergent-${callCount}`]: { assetType: 'collection' },
            },
            menuAssetDisplayOrder: ['0YRxtglWpkDyxcW8WCTD', `divergent-${callCount}`],
          }),
        });
        await fn(mockTransaction);
      });

      // Suppress expected console.warn output
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await expect(
        rebuildMenus(BUSINESS_ID, { menuIds: ['toctou-menu'] }),
      ).rejects.toThrow('Failed to rebuild menu toctou-menu after 3 retries');

      warnSpy.mockRestore();
    });

    it('re-materializes groups and collections on retry with changed asset IDs', async () => {
      // Bulk snapshot has only group g1 = 0YRxtglWpkDyxcW8WCTD
      setupSingleMenu({
        bulkMenuAssets: {
          '0YRxtglWpkDyxcW8WCTD': { assetType: 'group' },
        },
        bulkMenuAssetDisplayOrder: ['0YRxtglWpkDyxcW8WCTD'],
      });

      let runTransactionCallCount = 0;

      mockDb.runTransaction.mockImplementation(async (fn: (t: any) => Promise<void>) => {
        runTransactionCallCount++;
        if (runTransactionCallCount === 1) {
          // First attempt: transaction shows a second group was added
          mockTransaction.get.mockResolvedValueOnce({
            id: 'toctou-menu',
            exists: true,
            data: () => ({
              name: 'Test Menu',
              displayName: 'Test',
              coverImageGsl: null,
              coverBackgroundImageGsl: null,
              coverVideoGsl: null,
              logoImageGsl: null,
              gratuityRates: [],
              managedBy: null,
              isDeleted: false,
              created: new Date(),
              updated: new Date(),
              version: '1.0',
              groupDisplayOrder: ['0YRxtglWpkDyxcW8WCTD', 'SKoGd62OfNyZqMXqsKSX'],
              menuAssets: {
                '0YRxtglWpkDyxcW8WCTD': { assetType: 'group' },
                'SKoGd62OfNyZqMXqsKSX': { assetType: 'group' },
              },
              menuAssetDisplayOrder: ['0YRxtglWpkDyxcW8WCTD', 'SKoGd62OfNyZqMXqsKSX'],
            }),
          });
        } else {
          // Second attempt: consistent with the fresh data (both groups)
          mockTransaction.get.mockResolvedValueOnce({
            id: 'toctou-menu',
            exists: true,
            data: () => ({
              name: 'Test Menu',
              displayName: 'Test',
              coverImageGsl: null,
              coverBackgroundImageGsl: null,
              coverVideoGsl: null,
              logoImageGsl: null,
              gratuityRates: [],
              managedBy: null,
              isDeleted: false,
              created: new Date(),
              updated: new Date(),
              version: '1.0',
              groupDisplayOrder: ['0YRxtglWpkDyxcW8WCTD', 'SKoGd62OfNyZqMXqsKSX'],
              menuAssets: {
                '0YRxtglWpkDyxcW8WCTD': { assetType: 'group' },
                'SKoGd62OfNyZqMXqsKSX': { assetType: 'group' },
              },
              menuAssetDisplayOrder: ['0YRxtglWpkDyxcW8WCTD', 'SKoGd62OfNyZqMXqsKSX'],
            }),
          });
        }
        await fn(mockTransaction);
      });

      // Suppress expected console.warn output
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await rebuildMenus(BUSINESS_ID, { menuIds: ['toctou-menu'] });

      warnSpy.mockRestore();

      // Should have retried once
      expect(mockDb.runTransaction).toHaveBeenCalledTimes(2);
      // Only the second attempt writes
      expect(transactionSets).toHaveLength(1);

      const written = transactionSets[0].data;
      // Both groups should be materialized
      expect(written.groups['0YRxtglWpkDyxcW8WCTD']).toBeDefined();
      expect(written.groups['SKoGd62OfNyZqMXqsKSX']).toBeDefined();
      // The Chicken group should have products
      expect(written.groups['SKoGd62OfNyZqMXqsKSX'].name).toBe('Chicken');
    });
  });
});
