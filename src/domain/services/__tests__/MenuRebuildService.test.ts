import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rebuildMenus, resolveChangedProducts } from '../MenuRebuildService';
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

    it('each group has required fields: displayName, name, imageGsls, productDisplayOrder, mirrorCategoryId', async () => {
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
          menuAssets: { a1: { assetType: 'group', assetId: 'g1' } },
          menuAssetDisplayOrder: ['a1'],
        },
      }]);

      await rebuildMenus(BUSINESS_ID);
      expect(transactionSets).toHaveLength(1);
      expect(transactionSets[0].data.groups).toEqual({});
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
});
