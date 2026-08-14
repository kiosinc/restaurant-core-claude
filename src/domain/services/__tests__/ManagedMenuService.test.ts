import {
  describe, it, expect, vi, beforeEach, afterEach,
} from 'vitest';
import { syncManagedSquareMenu } from '../ManagedMenuService';
import type { MenuGroupMeta } from '../../surfaces/MenuGroup';
import {
  BUSINESS_ID,
  CHILD_11_ID,
  CHILD_11_NAME,
  CHILD_11_PRODUCT_ORDER,
  CHILD_12_ID,
  CHILD_21_ID,
  MIRRORED_GROUP_ID,
  MIRRORED_MENU_ID,
  PRODUCT_IDS,
  ROOT_1_ID,
  ROOT_1_NAME,
  ROOT_2_ID,
  ROOT_2_NAME,
  canonicalCategories,
  canonicalWorld,
  category,
  child,
  managedGroup,
  managedMenu,
  menu,
  menuGroup,
  mirroredWorld,
  nonMirroredCategories,
  root,
  world,
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
 * "index of X < docWritesBefore". Ordering is load-bearing twice over: every mirrored Menu doc
 * must exist before the rebuild (MenuRebuildService.ts:134 filters scoped ids against a bulk read
 * and silently no-ops otherwise), and group docs must exist before the menus reference them.
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

function deletesOn(collectionPath: string) {
  return writesOn(collectionPath).filter((w) => w.op === 'delete').map((w) => w.id);
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

/**
 * Names the shape of a materialized payload's `groups` map. `transactionSets` is untyped by
 * construction (the mock stores whatever it was handed), and `MenuGroupMeta` is exactly what
 * `materializeGroups` writes there — so this narrows once, here, instead of an `any` per call site.
 */
function materializedGroups(groups: unknown): Record<string, MenuGroupMeta> {
  return groups as Record<string, MenuGroupMeta>;
}

/** The id of the single CREATED group write whose `mirrorCategoryId` is `categoryId`. */
function createdGroupIdFor(categoryId: string): string {
  const match = groupCreates().filter((w) => w.data.mirrorCategoryId === categoryId);
  expect(match).toHaveLength(1);
  return match[0].id;
}

/** The result entry for one root, which must exist exactly once. */
function menuFor(result: { menus: Array<{ mirrorCategoryId: string }> }, rootCategoryId: string) {
  const match = result.menus.filter((m) => m.mirrorCategoryId === rootCategoryId);
  expect(match).toHaveLength(1);
  return match[0] as { menuId: string; mirrorCategoryId: string; managedGroupIds: string[] };
}

/**
 * The menu doc AS STORED after the run — the three fields that must agree with each other and with
 * the returned `managedGroupIds`.
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
 * #100 acceptance criterion: the stored `menuAssetDisplayOrder`, the stored `groupDisplayOrder`,
 * the stored `menuAssets` KEY ORDER and the returned `managedGroupIds` are all one and the same
 * sequence.
 */
async function expectConsistentAssembly(
  entry: { menuId: string; managedGroupIds: string[] },
  expected: string[],
) {
  const stored = await storedAssembly(entry.menuId);
  expect(entry.managedGroupIds).toEqual(expected);
  expect(stored.menuAssetDisplayOrder).toEqual(expected);
  expect(stored.groupDisplayOrder).toEqual(expected);
  expect(stored.assetKeys).toEqual(expected);
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

  registerFixture(canonicalWorld());
});

afterEach(() => {
  warnSpy.mockRestore();
});

describe('ManagedMenuService', () => {
  // ─── TC1: hierarchical create path ─────────────────────────────────────

  describe('TC1 — create path: one Menu per root', () => {
    it('creates exactly one managedBy:\'square\' Menu per root category', async () => {
      const result = await syncManagedSquareMenu(BUSINESS_ID);

      const menuWrites = writesOn(MENUS_PATH);
      expect(menuWrites).toHaveLength(2);
      expect(menuWrites.every((w) => w.op === 'set')).toBe(true);
      expect(menuWrites.every((w) => w.data.managedBy === 'square')).toBe(true);
      expect(result.menus).toHaveLength(2);
    });

    it('binds each created Menu to its root via mirrorCategoryId', async () => {
      const result = await syncManagedSquareMenu(BUSINESS_ID);

      for (const rootId of [ROOT_1_ID, ROOT_2_ID]) {
        const entry = menuFor(result, rootId);
        const stored = await readDoc(MENUS_PATH, entry.menuId);
        expect(stored.mirrorCategoryId).toBe(rootId);
      }
    });

    it('names each Menu after its root category', async () => {
      const result = await syncManagedSquareMenu(BUSINESS_ID);

      const breakfast = await readDoc(MENUS_PATH, menuFor(result, ROOT_1_ID).menuId);
      const dinner = await readDoc(MENUS_PATH, menuFor(result, ROOT_2_ID).menuId);
      expect(breakfast.name).toBe(ROOT_1_NAME);
      expect(breakfast.displayName).toBe(ROOT_1_NAME);
      expect(dinner.name).toBe(ROOT_2_NAME);
      expect(dinner.displayName).toBe(ROOT_2_NAME);
    });

    it('writes ISO timestamps and no Id key on created Menus', async () => {
      await syncManagedSquareMenu(BUSINESS_ID);

      for (const write of writesOn(MENUS_PATH)) {
        expect(write.data).not.toHaveProperty('Id');
        expect(write.data.isDeleted).toBe(false);
        expect(write.data.created).toMatch(ISO_RE);
        expect(write.data.updated).toMatch(ISO_RE);
      }
    });

    it('creates one managed MenuGroup per child category', async () => {
      await syncManagedSquareMenu(BUSINESS_ID);

      const creates = groupCreates();
      expect(creates).toHaveLength(3);
      expect(creates.map((w) => w.data.mirrorCategoryId).sort()).toEqual(
        [CHILD_11_ID, CHILD_12_ID, CHILD_21_ID].sort(),
      );
      for (const write of creates) {
        expect(write.data.managedBy).toBe('square');
        // The effective product list lives on the mirror CATEGORY (#79); pre-filling it here
        // would create a second, stale copy of the truth.
        expect(write.data.productDisplayOrder).toEqual([]);
        expect(write.data).not.toHaveProperty('Id');
      }
    });

    it('names each managed group after its child category', async () => {
      await syncManagedSquareMenu(BUSINESS_ID);

      const appetizers = groupCreates().find((w) => w.data.mirrorCategoryId === CHILD_11_ID);
      expect(appetizers?.data.name).toBe(CHILD_11_NAME);
      expect(appetizers?.data.displayName).toBe(CHILD_11_NAME);
    });

    it('writes menuAssets, groupDisplayOrder and menuAssetDisplayOrder as identical sequences', async () => {
      const result = await syncManagedSquareMenu(BUSINESS_ID);

      for (const entry of result.menus) {
        await expectConsistentAssembly(entry, entry.managedGroupIds);
        const stored = await readDoc(MENUS_PATH, entry.menuId);
        for (const asset of Object.values(stored.menuAssets)) {
          expect(asset).toEqual({ assetType: 'group' });
        }
      }
    });

    it('returns { menus: [{ menuId, mirrorCategoryId, managedGroupIds }] } ordered by root', async () => {
      const result = await syncManagedSquareMenu(BUSINESS_ID);

      // Roots carry no parent ordinal, so they tie-break on (name, id): Breakfast before Dinner.
      expect(result.menus.map((m) => m.mirrorCategoryId)).toEqual([ROOT_1_ID, ROOT_2_ID]);
      expect(Object.keys(result)).toEqual(['menus']);
      for (const entry of result.menus) {
        expect(Object.keys(entry).sort()).toEqual(['managedGroupIds', 'menuId', 'mirrorCategoryId']);
      }
    });
  });

  // ─── TC2: children land under their own root ───────────────────────────

  describe('TC2 — no cross-menu leakage', () => {
    it('places each child group on the Menu of its own root', async () => {
      const result = await syncManagedSquareMenu(BUSINESS_ID);

      const breakfast = menuFor(result, ROOT_1_ID);
      const dinner = menuFor(result, ROOT_2_ID);
      expect(breakfast.managedGroupIds).toEqual([
        createdGroupIdFor(CHILD_11_ID),
        createdGroupIdFor(CHILD_12_ID),
      ]);
      expect(dinner.managedGroupIds).toEqual([createdGroupIdFor(CHILD_21_ID)]);
    });

    it('never lists one root\'s group on another root\'s Menu', async () => {
      const result = await syncManagedSquareMenu(BUSINESS_ID);

      const breakfast = menuFor(result, ROOT_1_ID);
      const dinner = menuFor(result, ROOT_2_ID);
      const overlap = breakfast.managedGroupIds.filter((id) => dinner.managedGroupIds.includes(id));
      expect(overlap).toEqual([]);
    });

    it('gives a root with no children an empty assembly rather than no Menu', async () => {
      registerFixture(world({ categories: [root('catLonely', 'Lonely Menu')] }));

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      expect(result.menus).toHaveLength(1);
      expect(result.menus[0].managedGroupIds).toEqual([]);
      await expectConsistentAssembly(result.menus[0], []);
    });

    it('creates no Menu at all when no category qualifies', async () => {
      registerFixture(world({ categories: nonMirroredCategories() }));

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      expect(result.menus).toEqual([]);
      expect(docWrites).toEqual([]);
    });
  });

  // ─── TC3: depth-3+ flattening ──────────────────────────────────────────

  describe('TC3 — depth-3+ flattens into the nearest depth-2 ancestor', () => {
    /**
     * One root, two depth-2 sections, and two depth-3 subsections under the FIRST section:
     *
     *   Menu (r)
     *     ├─ 0 Section A (s1)
     *     │    ├─ 0 Sub A1 (s1a)
     *     │    └─ 1 Sub A2 (s1b)
     *     └─ 1 Section B (s2)
     *
     * A pre-order DFS places each depth-3 group immediately after the depth-2 ancestor it belongs
     * to, which is what "flattened into the nearest depth-2 ancestor, preserving ordinal order"
     * means: only the nesting LEVEL is lost, never the authored sequence and never a category's
     * products (each flattened group still binds to its own category).
     */
    function deepWorld(): FixtureSet {
      return world({
        categories: [
          root('r', 'Deep Menu'),
          child('s1', 'Section A', 'r', 0),
          child('s2', 'Section B', 'r', 1),
          child('s1a', 'Sub A1', 's1', 0, { rootCategoryId: 'r' }),
          child('s1b', 'Sub A2', 's1', 1, { rootCategoryId: 'r' }),
        ],
      });
    }

    it('places depth-3 groups immediately after their depth-2 ancestor', async () => {
      registerFixture(deepWorld());

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      expect(result.menus[0].managedGroupIds).toEqual([
        createdGroupIdFor('s1'),
        createdGroupIdFor('s1a'),
        createdGroupIdFor('s1b'),
        createdGroupIdFor('s2'),
      ]);
    });

    it('gives every flattened descendant its own group bound to its own category', async () => {
      registerFixture(deepWorld());

      await syncManagedSquareMenu(BUSINESS_ID);

      expect(groupCreates().map((w) => w.data.mirrorCategoryId).sort()).toEqual(
        ['s1', 's1a', 's1b', 's2'],
      );
    });

    it('flattens depth-4 as well, still in ordinal order', async () => {
      registerFixture(world({
        categories: [
          root('r', 'Deep Menu'),
          child('s1', 'Section A', 'r', 0),
          child('s1a', 'Sub A1', 's1', 0, { rootCategoryId: 'r' }),
          child('s1a1', 'Sub Sub A1', 's1a', 0, { rootCategoryId: 'r' }),
        ],
      }));

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      expect(result.menus[0].managedGroupIds).toEqual([
        createdGroupIdFor('s1'),
        createdGroupIdFor('s1a'),
        createdGroupIdFor('s1a1'),
      ]);
    });
  });

  // ─── TC4: idempotency / no churn ───────────────────────────────────────

  describe('TC4 — idempotency / no churn', () => {
    it('performs zero document writes on a run against an already-mirrored tree', async () => {
      registerFixture(mirroredWorld());

      await syncManagedSquareMenu(BUSINESS_ID);

      expect(docWrites).toEqual([]);
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('performs zero document writes on a second run after a create run', async () => {
      await syncManagedSquareMenu(BUSINESS_ID);
      docWrites.length = 0;

      await syncManagedSquareMenu(BUSINESS_ID);

      expect(docWrites).toEqual([]);
    });

    it('returns an identical result object on a second run', async () => {
      const first = await syncManagedSquareMenu(BUSINESS_ID);
      const second = await syncManagedSquareMenu(BUSINESS_ID);

      expect(second).toEqual(first);
    });

    it('leaves every mirrored Menu doc byte-identical after a second run', async () => {
      registerFixture(mirroredWorld());
      const before = await Promise.all(
        [MIRRORED_MENU_ID.r1, MIRRORED_MENU_ID.r2].map((id) => readDoc(MENUS_PATH, id)),
      );

      await syncManagedSquareMenu(BUSINESS_ID);

      const after = await Promise.all(
        [MIRRORED_MENU_ID.r1, MIRRORED_MENU_ID.r2].map((id) => readDoc(MENUS_PATH, id)),
      );
      expect(after).toEqual(before);
    });
  });

  // ─── TC5: delete, don't demote ─────────────────────────────────────────

  describe('TC5 — delete, don\'t demote', () => {
    /** The mirrored world minus one category, i.e. Square deleted it between runs. */
    function mirroredWithout(categoryId: string): FixtureSet {
      const set = mirroredWorld();
      set.categories = set.categories.filter((c) => c.id !== categoryId);
      return set;
    }

    it('deletes the Menu when its root disappears from Square', async () => {
      registerFixture(mirroredWithout(ROOT_2_ID));

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      expect(deletesOn(MENUS_PATH)).toEqual([MIRRORED_MENU_ID.r2]);
      expect(await docExists(MENUS_PATH, MIRRORED_MENU_ID.r2)).toBe(false);
      expect(result.menus.map((m) => m.mirrorCategoryId)).toEqual([ROOT_1_ID]);
    });

    it('deletes the managed groups of a deleted root', async () => {
      registerFixture(mirroredWithout(ROOT_2_ID));

      await syncManagedSquareMenu(BUSINESS_ID);

      // The child survives in the catalog but its root is gone, so the child is unattached and its
      // group is deleted along with the menu.
      expect(deletesOn(MENU_GROUPS_PATH)).toEqual([MIRRORED_GROUP_ID.c21]);
      expect(await docExists(MENU_GROUPS_PATH, MIRRORED_GROUP_ID.c21)).toBe(false);
    });

    it('deletes just the group when a child disappears from Square', async () => {
      registerFixture(mirroredWithout(CHILD_12_ID));

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      expect(deletesOn(MENU_GROUPS_PATH)).toEqual([MIRRORED_GROUP_ID.c12]);
      expect(deletesOn(MENUS_PATH)).toEqual([]);
      expect(menuFor(result, ROOT_1_ID).managedGroupIds).toEqual([MIRRORED_GROUP_ID.c11]);
    });

    it('deletes a managed group whose mirror category was soft-deleted', async () => {
      const set = mirroredWorld();
      const target = set.categories.find((c) => c.id === CHILD_12_ID) as FixtureDoc;
      target.data.isDeleted = true;
      registerFixture(set);

      await syncManagedSquareMenu(BUSINESS_ID);

      expect(deletesOn(MENU_GROUPS_PATH)).toEqual([MIRRORED_GROUP_ID.c12]);
    });

    it('deletes a managed group whose mirror category was demoted to regular', async () => {
      const set = mirroredWorld();
      const target = set.categories.find((c) => c.id === CHILD_12_ID) as FixtureDoc;
      target.data.categoryType = 'regular';
      registerFixture(set);

      await syncManagedSquareMenu(BUSINESS_ID);

      expect(deletesOn(MENU_GROUPS_PATH)).toEqual([MIRRORED_GROUP_ID.c12]);
    });

    it('never writes managedBy: null anywhere', async () => {
      registerFixture(mirroredWithout(ROOT_2_ID));

      await syncManagedSquareMenu(BUSINESS_ID);

      for (const write of docWrites) {
        expect(write.data.managedBy ?? 'square').toBe('square');
      }
    });

    it('deletes the legacy flat "Square Menu" that has no mirrorCategoryId', async () => {
      const set = canonicalWorld();
      set.menus = [menu('sqLegacyFlat', 'Square Menu', { managedBy: 'square', mirrorCategoryId: null })];
      registerFixture(set);

      await syncManagedSquareMenu(BUSINESS_ID);

      expect(deletesOn(MENUS_PATH)).toEqual(['sqLegacyFlat']);
      expect(await docExists(MENUS_PATH, 'sqLegacyFlat')).toBe(false);
    });

    it('migrates the flat model: deletes managed groups that mirror ROOT categories', async () => {
      // The state #88's flat model left behind: ONE managed Menu with no mirrorCategoryId, and a
      // managed group for EVERY menu category — roots included, since the flat model made no
      // distinction. Under the mirror a root is a Menu, never a group, so those groups have no
      // live mirror category to win and are swept by the same deletion rule as any other orphan.
      const set = canonicalWorld();
      set.menuGroups = [
        managedGroup('flatRoot1', ROOT_1_NAME, ROOT_1_ID),
        managedGroup('flatRoot2', ROOT_2_NAME, ROOT_2_ID),
        managedGroup('flatChild11', CHILD_11_NAME, CHILD_11_ID),
      ];
      set.menus = [menu('flatMenu', 'Square Menu', {
        managedBy: 'square',
        mirrorCategoryId: null,
        groupIds: ['flatRoot1', 'flatRoot2', 'flatChild11'],
      })];
      registerFixture(set);

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      expect(deletesOn(MENU_GROUPS_PATH).sort()).toEqual(['flatRoot1', 'flatRoot2']);
      expect(deletesOn(MENUS_PATH)).toEqual(['flatMenu']);
      // The child's group is reused in place — it already mirrors a live child category.
      expect(menuFor(result, ROOT_1_ID).managedGroupIds).toContain('flatChild11');
      expect(result.menus.map((m) => m.mirrorCategoryId)).toEqual([ROOT_1_ID, ROOT_2_ID]);
    });

    it('deletes a managed Menu that predates the mirrorCategoryId field entirely', async () => {
      const set = canonicalWorld();
      set.menus = [menu('sqNoField', 'Square Menu', { managedBy: 'square' })];
      registerFixture(set);

      await syncManagedSquareMenu(BUSINESS_ID);

      expect(deletesOn(MENUS_PATH)).toEqual(['sqNoField']);
    });

    it('writes the surviving Menus before deleting the departed ones', async () => {
      registerFixture(mirroredWithout(ROOT_2_ID));

      await syncManagedSquareMenu(BUSINESS_ID);

      const menuOps = writesOn(MENUS_PATH);
      const deleteIndex = menuOps.findIndex((w) => w.op === 'delete');
      // r1's assembly is unchanged here, so the only menu op is the delete — the ordering claim is
      // that no delete precedes a surviving write, which holds vacuously and is asserted directly.
      expect(menuOps.slice(0, deleteIndex).every((w) => w.op !== 'delete')).toBe(true);
    });
  });

  // ─── TC6: no adoption ──────────────────────────────────────────────────

  describe('TC6 — the mirror never adopts operator docs', () => {
    /** An operator's own mirror group for a Square child category — `managedBy` never set. */
    function withOperatorMirrorGroup(): FixtureSet {
      return world({
        categories: canonicalCategories(),
        menuGroups: [
          menuGroup('opMirror', 'My Appetizers', { mirrorCategoryId: CHILD_11_ID }),
          menuGroup('opPlain', 'Operator Picks', { mirrorCategoryId: null, managedBy: null }),
        ],
        menus: [menu('opMenu', 'Operator Menu', { groupIds: ['opMirror', 'opPlain'] })],
      });
    }

    it('never converts an operator mirror group to managedBy: \'square\'', async () => {
      registerFixture(withOperatorMirrorGroup());

      await syncManagedSquareMenu(BUSINESS_ID);

      expect(writesFor(MENU_GROUPS_PATH, 'opMirror')).toEqual([]);
      const stored = await readDoc(MENU_GROUPS_PATH, 'opMirror');
      expect(stored).not.toHaveProperty('managedBy');
    });

    it('creates its own duplicate group alongside the operator\'s', async () => {
      registerFixture(withOperatorMirrorGroup());

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      const mine = createdGroupIdFor(CHILD_11_ID);
      expect(mine).not.toBe('opMirror');
      expect(menuFor(result, ROOT_1_ID).managedGroupIds).toContain(mine);
      expect(menuFor(result, ROOT_1_ID).managedGroupIds).not.toContain('opMirror');
    });

    it('never deletes an operator group, mirror or plain', async () => {
      registerFixture(withOperatorMirrorGroup());

      await syncManagedSquareMenu(BUSINESS_ID);

      expect(deletesOn(MENU_GROUPS_PATH)).toEqual([]);
      expect(await docExists(MENU_GROUPS_PATH, 'opMirror')).toBe(true);
      expect(await docExists(MENU_GROUPS_PATH, 'opPlain')).toBe(true);
    });

    it('never touches an operator Menu, even one holding a mirror group', async () => {
      registerFixture(withOperatorMirrorGroup());

      await syncManagedSquareMenu(BUSINESS_ID);

      expect(writesFor(MENUS_PATH, 'opMenu')).toEqual([]);
    });

    it('never adopts an operator group whose mirrorCategoryId points at a ROOT', async () => {
      const set = canonicalWorld();
      set.menuGroups = [menuGroup('opRootMirror', 'My Breakfast', { mirrorCategoryId: ROOT_1_ID })];
      registerFixture(set);

      await syncManagedSquareMenu(BUSINESS_ID);

      expect(writesFor(MENU_GROUPS_PATH, 'opRootMirror')).toEqual([]);
    });

    it('ignores an isDeleted managed group and mints a fresh one', async () => {
      const set = canonicalWorld();
      set.menuGroups = [
        managedGroup('sqDeleted', CHILD_11_NAME, CHILD_11_ID, { isDeleted: true }),
      ];
      registerFixture(set);

      await syncManagedSquareMenu(BUSINESS_ID);

      expect(createdGroupIdFor(CHILD_11_ID)).not.toBe('sqDeleted');
      expect(writesFor(MENU_GROUPS_PATH, 'sqDeleted')).toEqual([]);
    });
  });

  // ─── TC7: multi-menu is normal, duplicates resolve deterministically ───

  describe('TC7 — multiple managed Menus are normal', () => {
    it('does not throw when many managed Menus exist', async () => {
      registerFixture(mirroredWorld());

      await expect(syncManagedSquareMenu(BUSINESS_ID)).resolves.toBeDefined();
    });

    it('produces 34 Menus for 34 roots', async () => {
      const roots = Array.from({ length: 34 }, (_, i) => root(`r${i}`, `Menu ${i}`));
      registerFixture(world({ categories: roots }));

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      expect(result.menus).toHaveLength(34);
      expect(new Set(result.menus.map((m) => m.menuId)).size).toBe(34);
    });

    it('keeps the lowest doc id when two managed Menus mirror one root, deleting the loser', async () => {
      const set = canonicalWorld();
      set.menus = [
        managedMenu('sqZ', ROOT_1_NAME, ROOT_1_ID),
        managedMenu('sqA', ROOT_1_NAME, ROOT_1_ID),
      ];
      registerFixture(set);

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      expect(menuFor(result, ROOT_1_ID).menuId).toBe('sqA');
      expect(deletesOn(MENUS_PATH)).toEqual(['sqZ']);
    });

    it('keeps the lowest doc id when two managed groups mirror one child, deleting the loser', async () => {
      const set = canonicalWorld();
      set.menuGroups = [
        managedGroup('gZ', CHILD_11_NAME, CHILD_11_ID),
        managedGroup('gA', CHILD_11_NAME, CHILD_11_ID),
      ];
      registerFixture(set);

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      expect(menuFor(result, ROOT_1_ID).managedGroupIds).toContain('gA');
      expect(deletesOn(MENU_GROUPS_PATH)).toEqual(['gZ']);
    });

    it('ignores an isDeleted managed Menu and creates a new one for that root', async () => {
      const set = canonicalWorld();
      set.menus = [managedMenu('sqGone', ROOT_1_NAME, ROOT_1_ID, { isDeleted: true })];
      registerFixture(set);

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      expect(menuFor(result, ROOT_1_ID).menuId).not.toBe('sqGone');
      expect(writesFor(MENUS_PATH, 'sqGone')).toEqual([]);
    });
  });

  // ─── TC8: root classification and unattached descendants ───────────────

  describe('TC8 — root classification', () => {
    it('treats a category with no isTopLevel key as a root', async () => {
      registerFixture(world({
        categories: [category('catLegacyMenu', 'Legacy Menu', { categoryType: 'menu' })],
      }));

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      expect(result.menus.map((m) => m.mirrorCategoryId)).toEqual(['catLegacyMenu']);
    });

    it('skips a child whose parent category does not exist', async () => {
      registerFixture(world({
        categories: [root('r', 'Menu'), child('orphan', 'Orphan', 'nosuchparent', 0)],
      }));

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      expect(result.menus).toHaveLength(1);
      expect(result.menus[0].managedGroupIds).toEqual([]);
      expect(warnSpy).toHaveBeenCalledWith(
        '[ManagedMenuService] menu categories with no live root: not mirrored, any managed group deleted',
        { businessId: BUSINESS_ID, categoryIds: ['orphan'] },
      );
    });

    it('skips a child whose parentCategoryId is null', async () => {
      registerFixture(world({
        categories: [
          root('r', 'Menu'),
          category('headless', 'Headless', { categoryType: 'menu', isTopLevel: false, parentCategoryId: null }),
        ],
      }));

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      expect(result.menus[0].managedGroupIds).toEqual([]);
    });

    it('skips a child whose parent is a soft-deleted root', async () => {
      registerFixture(world({
        categories: [
          root('deadRoot', 'Dead Menu', { isDeleted: true }),
          child('c', 'Section', 'deadRoot', 0),
        ],
      }));

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      expect(result.menus).toEqual([]);
      expect(docWrites).toEqual([]);
    });

    it('never promotes an unattached child to a Menu of its own', async () => {
      registerFixture(world({ categories: [child('orphan', 'Orphan', 'nosuchparent', 0)] }));

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      expect(result.menus).toEqual([]);
    });

    it('survives a parent cycle without hanging, skipping both categories', async () => {
      registerFixture(world({
        categories: [
          child('x', 'X', 'y', 0),
          child('y', 'Y', 'x', 0),
        ],
      }));

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      expect(result.menus).toEqual([]);
      expect(warnSpy).toHaveBeenCalledWith(
        '[ManagedMenuService] menu categories with no live root: not mirrored, any managed group deleted',
        { businessId: BUSINESS_ID, categoryIds: ['x', 'y'] },
      );
    });

    it('survives a self-parenting category', async () => {
      registerFixture(world({ categories: [root('r', 'Menu'), child('self', 'Self', 'self', 0)] }));

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      expect(result.menus[0].managedGroupIds).toEqual([]);
    });
  });

  // ─── TC9: ordering — parentOrdinal seed + #100 carve-out ───────────────

  describe('TC9 — ordering', () => {
    /**
     * Ordinals run OPPOSITE to alphabetical order, so any test that passes here would fail under
     * #88's alphabetical seed. Zulu is ordinal 0, Alpha is ordinal 2.
     */
    function ordinalWorld(existingMenu?: FixtureDoc, groups?: FixtureDoc[]): FixtureSet {
      return world({
        categories: [
          root('r', 'Menu'),
          child('cz', 'Zulu', 'r', 0),
          child('cm', 'Mike', 'r', 1),
          child('ca', 'Alpha', 'r', 2),
        ],
        menuGroups: groups ?? [],
        menus: existingMenu ? [existingMenu] : [],
      });
    }

    it('seeds new groups from parentOrdinal, not alphabetically', async () => {
      registerFixture(ordinalWorld());

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      expect(result.menus[0].managedGroupIds).toEqual([
        createdGroupIdFor('cz'),
        createdGroupIdFor('cm'),
        createdGroupIdFor('ca'),
      ]);
    });

    it('sorts ordinal-less siblings after ordinaled ones, by name then id', async () => {
      registerFixture(world({
        categories: [
          root('r', 'Menu'),
          child('cnull2', 'Yankee', 'r', null),
          child('cnull1', 'Bravo', 'r', null),
          child('cord', 'Zulu', 'r', 5),
        ],
      }));

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      expect(result.menus[0].managedGroupIds).toEqual([
        createdGroupIdFor('cord'),
        createdGroupIdFor('cnull1'),
        createdGroupIdFor('cnull2'),
      ]);
    });

    it('preserves an operator-set menuAssetDisplayOrder across a sync', async () => {
      const groups = [
        managedGroup('gz', 'Zulu', 'cz'),
        managedGroup('gm', 'Mike', 'cm'),
        managedGroup('ga', 'Alpha', 'ca'),
      ];
      const operatorOrder = ['ga', 'gz', 'gm'];
      registerFixture(ordinalWorld(
        managedMenu('sq', 'Menu', 'r', {
          groupIds: ['gz', 'gm', 'ga'],
          menuAssetDisplayOrder: operatorOrder,
        }),
        groups,
      ));

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      await expectConsistentAssembly(result.menus[0], operatorOrder);
    });

    it('heals a groupDisplayOrder left stale by an operator reorder', async () => {
      const groups = [managedGroup('gz', 'Zulu', 'cz'), managedGroup('gm', 'Mike', 'cm'), managedGroup('ga', 'Alpha', 'ca')];
      registerFixture(ordinalWorld(
        managedMenu('sq', 'Menu', 'r', {
          groupIds: ['gz', 'gm', 'ga'],
          menuAssetDisplayOrder: ['ga', 'gz', 'gm'],
        }),
        groups,
      ));

      await syncManagedSquareMenu(BUSINESS_ID);

      const update = writesFor(MENUS_PATH, 'sq');
      expect(update).toHaveLength(1);
      expect(Object.keys(update[0].data).sort()).toEqual([
        'groupDisplayOrder', 'menuAssetDisplayOrder', 'menuAssets', 'updated',
      ]);
      expect((await storedAssembly('sq')).groupDisplayOrder).toEqual(['ga', 'gz', 'gm']);
    });

    it('appends a newcomer at the end of the operator order, not at its ordinal slot', async () => {
      const groups = [managedGroup('gz', 'Zulu', 'cz'), managedGroup('gm', 'Mike', 'cm')];
      registerFixture(ordinalWorld(
        managedMenu('sq', 'Menu', 'r', {
          groupIds: ['gz', 'gm'],
          menuAssetDisplayOrder: ['gm', 'gz'],
        }),
        groups,
      ));

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      // 'ca' has ordinal 2 (last) but would sort FIRST alphabetically; either way it appends.
      await expectConsistentAssembly(result.menus[0], ['gm', 'gz', createdGroupIdFor('ca')]);
    });

    it('sorts multiple newcomers among themselves by ordinal without re-sorting the rest', async () => {
      registerFixture(ordinalWorld(
        managedMenu('sq', 'Menu', 'r', { groupIds: ['gm'], menuAssetDisplayOrder: ['gm'] }),
        [managedGroup('gm', 'Mike', 'cm')],
      ));

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      await expectConsistentAssembly(result.menus[0], [
        'gm', createdGroupIdFor('cz'), createdGroupIdFor('ca'),
      ]);
    });

    it('drops a deleted group without re-ordering the rest', async () => {
      const set = ordinalWorld(
        managedMenu('sq', 'Menu', 'r', {
          groupIds: ['gz', 'gm', 'ga'],
          menuAssetDisplayOrder: ['ga', 'gz', 'gm'],
        }),
        [managedGroup('gz', 'Zulu', 'cz'), managedGroup('gm', 'Mike', 'cm'), managedGroup('ga', 'Alpha', 'ca')],
      );
      set.categories = set.categories.filter((c) => c.id !== 'cz');
      registerFixture(set);

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      await expectConsistentAssembly(result.menus[0], ['ga', 'gm']);
      expect(deletesOn(MENU_GROUPS_PATH)).toEqual(['gz']);
    });

    it('orders by ordinal when there is no existing Menu at all', async () => {
      registerFixture(ordinalWorld());

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      await expectConsistentAssembly(result.menus[0], [
        createdGroupIdFor('cz'), createdGroupIdFor('cm'), createdGroupIdFor('ca'),
      ]);
    });

    it.each([
      ['null', null],
      ['a comma-joined string', 'gz,gm,ga'],
      ['a number', 7],
      ['an object', { 0: 'gz' }],
    ])('ignores a menuAssetDisplayOrder that is %s', async (_label, raw) => {
      registerFixture(ordinalWorld(
        managedMenu('sq', 'Menu', 'r', { groupIds: ['gz', 'gm', 'ga'], menuAssetDisplayOrder: raw }),
        [managedGroup('gz', 'Zulu', 'cz'), managedGroup('gm', 'Mike', 'cm'), managedGroup('ga', 'Alpha', 'ca')],
      ));

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      await expectConsistentAssembly(result.menus[0], ['gz', 'gm', 'ga']);
    });

    it('falls back to the seed order when menuAssetDisplayOrder is missing entirely', async () => {
      registerFixture(ordinalWorld(
        managedMenu('sq', 'Menu', 'r', { groupIds: ['gz', 'gm', 'ga'], omitMenuAssetDisplayOrder: true }),
        [managedGroup('gz', 'Zulu', 'cz'), managedGroup('gm', 'Mike', 'cm'), managedGroup('ga', 'Alpha', 'ca')],
      ));

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      await expectConsistentAssembly(result.menus[0], ['gz', 'gm', 'ga']);
    });

    it('ignores non-string and duplicate entries and ids outside the managed set', async () => {
      registerFixture(ordinalWorld(
        managedMenu('sq', 'Menu', 'r', {
          groupIds: ['gz', 'gm', 'ga'],
          menuAssetDisplayOrder: ['ga', 42, 'ga', 'notAGroup', 'gm', null, 'gz'],
        }),
        [managedGroup('gz', 'Zulu', 'cz'), managedGroup('gm', 'Mike', 'cm'), managedGroup('ga', 'Alpha', 'ca')],
      ));

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      await expectConsistentAssembly(result.menus[0], ['ga', 'gm', 'gz']);
    });

    it('orders roots deterministically by name then id', async () => {
      registerFixture(world({
        categories: [root('zz', 'Alpha Menu'), root('aa', 'Alpha Menu'), root('mm', 'Beta Menu')],
      }));

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      expect(result.menus.map((m) => m.mirrorCategoryId)).toEqual(['aa', 'zz', 'mm']);
    });

    it('orders by codepoint, not by locale', async () => {
      registerFixture(world({
        categories: [root('r', 'Menu'), child('capital', 'Zebra', 'r', null), child('lower', 'apple', 'r', null)],
      }));

      const result = await syncManagedSquareMenu(BUSINESS_ID);

      // 'Zebra' (U+005A) precedes 'apple' (U+0061) by codepoint; localeCompare would reverse them.
      expect(result.menus[0].managedGroupIds).toEqual([
        createdGroupIdFor('capital'), createdGroupIdFor('lower'),
      ]);
    });
  });

  // ─── TC10: materialization ─────────────────────────────────────────────

  describe('TC10 — materialization', () => {
    it('materializes the mirror category\'s productDisplayOrder into its group', async () => {
      const result = await syncManagedSquareMenu(BUSINESS_ID);

      const entry = menuFor(result, ROOT_1_ID);
      const payloads = materializedWrites(entry.menuId);
      const groups = payloads[payloads.length - 1].groups;
      const appetizers = groups[createdGroupIdFor(CHILD_11_ID)];
      expect(appetizers.productDisplayOrder).toEqual(CHILD_11_PRODUCT_ORDER);
      expect(Object.keys(appetizers.products).sort()).toEqual([...CHILD_11_PRODUCT_ORDER].sort());
    });

    it('materializes managed groups carrying managedBy \'square\' and their mirrorCategoryId', async () => {
      const result = await syncManagedSquareMenu(BUSINESS_ID);

      const entry = menuFor(result, ROOT_1_ID);
      const payloads = materializedWrites(entry.menuId);
      const groups = payloads[payloads.length - 1].groups;
      for (const [groupId, group] of Object.entries(materializedGroups(groups))) {
        expect(group.managedBy).toBe('square');
        expect(entry.managedGroupIds).toContain(groupId);
      }
    });

    it('materializes each root\'s Menu independently', async () => {
      const result = await syncManagedSquareMenu(BUSINESS_ID);

      for (const entry of result.menus) {
        const payloads = materializedWrites(entry.menuId);
        expect(payloads.length).toBeGreaterThan(0);
        expect(Object.keys(payloads[payloads.length - 1].groups)).toEqual(entry.managedGroupIds);
      }
    });

    it('leaves no product dangling in any materialized group', async () => {
      const result = await syncManagedSquareMenu(BUSINESS_ID);

      const entry = menuFor(result, ROOT_1_ID);
      const payloads = materializedWrites(entry.menuId);
      const groups = payloads[payloads.length - 1].groups;
      const seen: string[] = [];
      for (const group of Object.values(materializedGroups(groups))) {
        for (const productId of group.productDisplayOrder ?? []) {
          expect(group.products).toHaveProperty(productId);
          seen.push(productId);
        }
      }
      expect(seen.sort()).toEqual([PRODUCT_IDS.pa1, PRODUCT_IDS.pa2, PRODUCT_IDS.pb1].sort());
    });
  });

  // ─── TC11: rebuild wiring, sequencing and the flag-agnostic contract ───

  describe('TC11 — rebuild wiring and sequencing', () => {
    it('calls rebuildMenus exactly once, scoped to every mirrored Menu', async () => {
      const result = await syncManagedSquareMenu(BUSINESS_ID);

      expect(rebuildMenusSpy).toHaveBeenCalledTimes(1);
      expect(rebuildCalls[0].businessId).toBe(BUSINESS_ID);
      expect(rebuildCalls[0].scope).toEqual({
        menuIds: result.menus.map((m) => m.menuId),
        changedMenuGroupIds: [],
      });
    });

    it('passes deleted group ids as changedMenuGroupIds so operator menus are pruned', async () => {
      const set = mirroredWorld();
      set.categories = set.categories.filter((c) => c.id !== CHILD_12_ID);
      registerFixture(set);

      await syncManagedSquareMenu(BUSINESS_ID);

      expect((rebuildCalls[0].scope as { changedMenuGroupIds: string[] }).changedMenuGroupIds)
        .toEqual([MIRRORED_GROUP_ID.c12]);
    });

    it('calls rebuildMenus even when nothing changed', async () => {
      registerFixture(mirroredWorld());

      await syncManagedSquareMenu(BUSINESS_ID);
      await syncManagedSquareMenu(BUSINESS_ID);

      expect(rebuildMenusSpy).toHaveBeenCalledTimes(2);
    });

    it('writes every Menu document before invoking rebuildMenus', async () => {
      await syncManagedSquareMenu(BUSINESS_ID);

      const menuWriteIndexes = docWrites
        .map((w, i) => ({ w, i }))
        .filter(({ w }) => w.path.startsWith(`${MENUS_PATH}/`))
        .map(({ i }) => i);
      expect(menuWriteIndexes.length).toBeGreaterThan(0);
      for (const index of menuWriteIndexes) {
        expect(index).toBeLessThan(rebuildCalls[0].docWritesBefore);
      }
    });

    it('creates every managed group doc before the menu assemblies reference them', async () => {
      await syncManagedSquareMenu(BUSINESS_ID);

      const lastGroupCreate = docWrites.reduce(
        (acc, w, i) => (w.path.startsWith(`${MENU_GROUPS_PATH}/`) && w.op === 'set' ? i : acc),
        -1,
      );
      const firstMenuWrite = docWrites.findIndex((w) => w.path.startsWith(`${MENUS_PATH}/`));
      expect(lastGroupCreate).toBeGreaterThanOrEqual(0);
      expect(firstMenuWrite).toBeGreaterThan(lastGroupCreate);
    });

    /**
     * Deletions come last so that at EVERY crash point the tree is a superset of the desired state,
     * never a subset — a leftover doc is deleted again next run, whereas a Menu written after its
     * groups were deleted would reference docs that no longer exist.
     */
    it('deletes only after every surviving doc has been written', async () => {
      const set = mirroredWorld();
      set.categories = set.categories.filter((c) => c.id !== CHILD_12_ID);
      // Force a menu write on the run as well, so the assertion has a real write to order against.
      const survivor = set.menus.find((m) => m.id === MIRRORED_MENU_ID.r1) as FixtureDoc;
      survivor.data.menuAssetDisplayOrder = [];
      registerFixture(set);

      await syncManagedSquareMenu(BUSINESS_ID);

      const firstDelete = docWrites.findIndex((w) => w.op === 'delete');
      const lastNonDelete = docWrites.reduce((acc, w, i) => (w.op === 'delete' ? acc : i), -1);
      expect(firstDelete).toBeGreaterThanOrEqual(0);
      expect(lastNonDelete).toBeGreaterThanOrEqual(0);
      expect(firstDelete).toBeGreaterThan(lastNonDelete);
    });

    it('runs with syncSquareMenuCategories undefined', async () => {
      expect(FLAGS_WITHOUT_SQUARE_MENU_FLAG).not.toHaveProperty('syncSquareMenuCategories');

      await expect(syncManagedSquareMenu(BUSINESS_ID)).resolves.toBeDefined();
    });

    it('logs one summary line when it changed something', async () => {
      await syncManagedSquareMenu(BUSINESS_ID);

      expect(warnSpy).toHaveBeenCalledWith('[ManagedMenuService] mirrored Square menus', {
        businessId: BUSINESS_ID,
        menuCount: 2,
        menusChanged: 2,
        menusDeleted: [],
        groupsCreated: 3,
        groupsDeleted: [],
      });
    });
  });
});
