/**
 * #174 test fixture for `ManagedMenuService.syncManagedSquareMenu`.
 *
 * Deliberately separate from `rebuildFixture.ts`: the 61 MenuRebuildService tests pin that
 * fixture's exact shape (4 menus / 11 groups / 39 products), so growing it to cover the Square
 * menu mirror would couple two unrelated suites.
 *
 * #174 replaced #88's hand-rolled worlds with a SPEC-DRIVEN builder. The mirror's desired state is
 * now a function of a TREE, and a tree has far too many interesting shapes (two roots, depth 3, an
 * orphaned child, a legacy flat doc, a duplicate) to enumerate one exported world per shape. A test
 * therefore spells out the tree it needs inline — `world({ categories: [root('r'), child('c','r')] })`
 * — and the shape under test is visible in the test itself rather than three files away.
 *
 * Every builder RETURNS FRESH DOCS ON EACH CALL, so a test may freely mutate the returned documents
 * (`registerCollection` stores the very object it is handed, so mutating the returned doc data
 * mutates the registered store) without leaking state into the next test.
 *
 * Absent keys are absent, never explicitly `undefined`: `category('x','X')` produces a genuine
 * pre-#173 document with no `categoryType`, no `parentCategoryId` and no `isTopLevel` key at all,
 * which is the only way to prove the service's "absent isTopLevel counts as a root" rule.
 */

export interface FixtureDoc {
  id: string;
  data: Record<string, unknown>;
}

export interface FixtureSet {
  categories: FixtureDoc[];
  products: FixtureDoc[];
  menuGroups: FixtureDoc[];
  menus: FixtureDoc[];
}

export const BUSINESS_ID = 'managed-menu-biz';

const CREATED_ISO = '2026-01-01T00:00:00.000Z';
const UPDATED_ISO = '2026-02-01T00:00:00.000Z';

function baseFields(): Record<string, unknown> {
  return { created: CREATED_ISO, updated: UPDATED_ISO, isDeleted: false };
}

// ─── Products ────────────────────────────────────────────────────────────────

/** The three products the mirrored categories below hand to `rebuildMenus`. */
export const PRODUCT_IDS = { pa1: 'pa1', pa2: 'pa2', pb1: 'pb1' };

export function product(id: string, name: string, minPrice: number): FixtureDoc {
  return {
    id,
    data: {
      ...baseFields(),
      name,
      isActive: true,
      imageGsls: [],
      minPrice,
      maxPrice: minPrice,
      variationCount: 1,
      description: `${name} description`,
    },
  };
}

export function fixtureProducts(): FixtureDoc[] {
  return [
    product(PRODUCT_IDS.pa1, 'Hummus', 600),
    product(PRODUCT_IDS.pa2, 'Falafel', 700),
    product(PRODUCT_IDS.pb1, 'Cola', 300),
  ];
}

// ─── Categories ──────────────────────────────────────────────────────────────

export interface CategoryOverrides {
  /** Omitted entirely when absent — a pre-#87 doc that can never match the `'menu'` query. */
  categoryType?: string;
  /** Omitted entirely when absent — a pre-#173 doc, which the service must read as a ROOT. */
  isTopLevel?: boolean;
  parentCategoryId?: string | null;
  parentOrdinal?: number | null;
  rootCategoryId?: string | null;
  productDisplayOrder?: string[];
  isDeleted?: boolean;
}

export function category(id: string, name: string, overrides?: CategoryOverrides): FixtureDoc {
  const o = overrides ?? {};
  return {
    id,
    data: {
      ...baseFields(),
      name,
      products: {},
      productDisplayOrder: o.productDisplayOrder ?? [],
      imageUrls: [],
      imageGsls: [],
      linkedObjects: {},
      ...(o.categoryType !== undefined ? { categoryType: o.categoryType } : {}),
      ...(o.isTopLevel !== undefined ? { isTopLevel: o.isTopLevel } : {}),
      ...(o.parentCategoryId !== undefined ? { parentCategoryId: o.parentCategoryId } : {}),
      ...(o.parentOrdinal !== undefined ? { parentOrdinal: o.parentOrdinal } : {}),
      ...(o.rootCategoryId !== undefined ? { rootCategoryId: o.rootCategoryId } : {}),
      ...(o.isDeleted !== undefined ? { isDeleted: o.isDeleted } : {}),
    },
  };
}

/**
 * A Square ROOT menu-category — `categoryType: 'menu'`, `isTopLevel: true`, and no parent link,
 * exactly as Square emits a top-level menu. One of these mirrors to one managed `Menu`.
 */
export function root(id: string, name: string, overrides?: CategoryOverrides): FixtureDoc {
  return category(id, name, { categoryType: 'menu', isTopLevel: true, ...overrides });
}

/**
 * A Square CHILD menu-category — `isTopLevel: false` plus `parent_category.{id,ordinal}`. One of
 * these mirrors to one managed `MenuGroup` on its root's Menu.
 *
 * `rootCategoryId` is set to `parentId` by default, which is only true at depth 2; a depth-3 spec
 * passes it explicitly. The service never reads the field — it walks `parentCategoryId` — so the
 * default's job is to keep the fixture honest about what Square actually writes, not to feed logic.
 */
export function child(
  id: string,
  name: string,
  parentId: string,
  ordinal: number | null,
  overrides?: CategoryOverrides,
): FixtureDoc {
  return category(id, name, {
    categoryType: 'menu',
    isTopLevel: false,
    parentCategoryId: parentId,
    parentOrdinal: ordinal,
    rootCategoryId: parentId,
    ...overrides,
  });
}

// ─── MenuGroups ──────────────────────────────────────────────────────────────

export interface MenuGroupOverrides {
  displayName?: string;
  productDisplayOrder?: string[];
  /** Omitted entirely when absent — a legacy group that predates mirroring. */
  mirrorCategoryId?: string | null;
  /** Omitted entirely when absent — an OPERATOR-owned doc, which the mirror must never touch. */
  managedBy?: string | null;
  isDeleted?: boolean;
}

export function menuGroup(id: string, name: string, overrides?: MenuGroupOverrides): FixtureDoc {
  const o = overrides ?? {};
  return {
    id,
    data: {
      ...baseFields(),
      name,
      displayName: o.displayName ?? name,
      imageGsls: [],
      products: {},
      productDisplayOrder: o.productDisplayOrder ?? [],
      parentGroup: null,
      childGroup: null,
      ...(o.mirrorCategoryId !== undefined ? { mirrorCategoryId: o.mirrorCategoryId } : {}),
      ...(o.managedBy !== undefined ? { managedBy: o.managedBy } : {}),
      ...(o.isDeleted !== undefined ? { isDeleted: o.isDeleted } : {}),
    },
  };
}

/** A managed mirror group as the service itself would have written it on an earlier run. */
export function managedGroup(id: string, name: string, categoryId: string, overrides?: MenuGroupOverrides): FixtureDoc {
  return menuGroup(id, name, { mirrorCategoryId: categoryId, managedBy: 'square', ...overrides });
}

// ─── Menus ───────────────────────────────────────────────────────────────────

export interface MenuOverrides {
  managedBy?: string | null;
  /** Omitted entirely when absent. `null` models the LEGACY flat "Square Menu" of #88. */
  mirrorCategoryId?: string | null;
  groupIds?: string[];
  isDeleted?: boolean;
  /**
   * RAW override for `menuAssetDisplayOrder` ALONE, left deliberately `unknown` so a fixture can
   * express what Firestore can actually hold — an order that disagrees with Square, a duplicated or
   * stale id, or a value that is not even an array. `menuAssets` and `groupDisplayOrder` still come
   * from `groupIds`, and that asymmetry is the point.
   *
   * Under #183 the mirror never reads this field to compute order; it is read only by
   * `assemblyEquals`' no-churn compare, which is exactly what these fixtures exercise.
   *
   * `undefined` means "not overridden" (the default `[...groupIds]` applies); to express a doc with
   * no such key at all, use `omitMenuAssetDisplayOrder`.
   */
  menuAssetDisplayOrder?: unknown;
  /**
   * Omit the key entirely — a menu doc written before the field existed. #183: the no-churn compare
   * must still see such a doc as differing from the derived assembly.
   */
  omitMenuAssetDisplayOrder?: boolean;
}

export function menu(id: string, name: string, overrides?: MenuOverrides): FixtureDoc {
  const o = overrides ?? {};
  const groupIds = o.groupIds ?? [];
  const menuAssets: Record<string, unknown> = {};
  for (const gid of groupIds) menuAssets[gid] = { assetType: 'group' };
  const menuAssetDisplayOrder = o.menuAssetDisplayOrder !== undefined
    ? o.menuAssetDisplayOrder
    : [...groupIds];
  return {
    id,
    data: {
      ...baseFields(),
      name,
      displayName: name,
      coverImageGsl: null,
      coverBackgroundImageGsl: null,
      coverVideoGsl: null,
      logoImageGsl: null,
      gratuityRates: [],
      managedBy: o.managedBy ?? null,
      ...(o.mirrorCategoryId !== undefined ? { mirrorCategoryId: o.mirrorCategoryId } : {}),
      groups: {},
      groupDisplayOrder: [...groupIds],
      collections: {},
      menuAssets,
      ...(o.omitMenuAssetDisplayOrder ? {} : { menuAssetDisplayOrder }),
      products: {},
      version: null,
      ...(o.isDeleted !== undefined ? { isDeleted: o.isDeleted } : {}),
    },
  };
}

/** A managed mirror Menu as the service itself would have written it on an earlier run. */
export function managedMenu(id: string, name: string, rootCategoryId: string, overrides?: MenuOverrides): FixtureDoc {
  return menu(id, name, { managedBy: 'square', mirrorCategoryId: rootCategoryId, ...overrides });
}

// ─── Worlds ──────────────────────────────────────────────────────────────────

/**
 * Assembles a `FixtureSet` from the parts a test cares about. `products` defaults to the three
 * fixture products, so a world that only exercises topology never has to mention them.
 */
export function world(parts: {
  categories?: FixtureDoc[];
  products?: FixtureDoc[];
  menuGroups?: FixtureDoc[];
  menus?: FixtureDoc[];
}): FixtureSet {
  return {
    categories: parts.categories ?? [],
    products: parts.products ?? fixtureProducts(),
    menuGroups: parts.menuGroups ?? [],
    menus: parts.menus ?? [],
  };
}

/**
 * THE CANONICAL TREE, shared by most tests so their expectations can be spelled with the constants
 * below instead of literals:
 *
 *   Breakfast (root R1)          Dinner (root R2)
 *     ├─ 0 Appetizers  (C11)       └─ 0 Entrees (C21)
 *     └─ 1 Beverages   (C12)
 *
 * Ordinals are deliberately NOT in alphabetical agreement everywhere else in the suite; here they
 * are, so this world stays readable and the ordinal-vs-alphabetical distinction is made explicitly
 * by the tests that care.
 */
export const ROOT_1_ID = 'catRootBreakfast';
export const ROOT_1_NAME = 'Breakfast';
export const ROOT_2_ID = 'catRootDinner';
export const ROOT_2_NAME = 'Dinner';
export const CHILD_11_ID = 'catAppetizers';
export const CHILD_11_NAME = 'Appetizers';
export const CHILD_12_ID = 'catBeverages';
export const CHILD_12_NAME = 'Beverages';
export const CHILD_21_ID = 'catEntrees';
export const CHILD_21_NAME = 'Entrees';

export const CHILD_11_PRODUCT_ORDER = [PRODUCT_IDS.pa1, PRODUCT_IDS.pa2];
export const CHILD_12_PRODUCT_ORDER = [PRODUCT_IDS.pb1];

/**
 * Category shapes that must NEVER be mirrored, mixed into the canonical world so every test proves
 * the exclusion rules by construction rather than by a dedicated case:
 *   - `'kitchen'` and `'regular'` — excluded by the `categoryType` equality query;
 *   - a doc with NO `categoryType` key — a pre-#87 document, likewise excluded;
 *   - an `isDeleted` `'menu'` root — excluded by the in-memory live filter.
 */
export function nonMirroredCategories(): FixtureDoc[] {
  return [
    category('catKitchen', 'Expo Station', { categoryType: 'kitchen' }),
    category('catRegular', 'Back Office', { categoryType: 'regular' }),
    category('catLegacy', 'Legacy Category'),
    root('catDeletedRoot', 'Retired Menu', { isDeleted: true }),
  ];
}

/** The canonical tree's categories, plus the never-mirrored noise. */
export function canonicalCategories(): FixtureDoc[] {
  return [
    root(ROOT_1_ID, ROOT_1_NAME),
    child(CHILD_11_ID, CHILD_11_NAME, ROOT_1_ID, 0, {
      productDisplayOrder: CHILD_11_PRODUCT_ORDER,
    }),
    child(CHILD_12_ID, CHILD_12_NAME, ROOT_1_ID, 1, {
      productDisplayOrder: CHILD_12_PRODUCT_ORDER,
    }),
    root(ROOT_2_ID, ROOT_2_NAME),
    child(CHILD_21_ID, CHILD_21_NAME, ROOT_2_ID, 0),
    ...nonMirroredCategories(),
  ];
}

/** The canonical tree with nothing mirrored yet — the pure create path. */
export function canonicalWorld(): FixtureSet {
  return world({ categories: canonicalCategories() });
}

/** Doc ids of the pre-existing managed docs in `mirroredWorld()`. */
export const MIRRORED_MENU_ID = { r1: 'sqMenuBreakfast', r2: 'sqMenuDinner' };
export const MIRRORED_GROUP_ID = { c11: 'sqGrpAppetizers', c12: 'sqGrpBeverages', c21: 'sqGrpEntrees' };

/**
 * The canonical tree ALREADY MIRRORED — the steady state a second run must leave untouched, and the
 * starting point for every "something disappeared from Square" test (delete a category from
 * `categories` and re-run).
 */
export function mirroredWorld(): FixtureSet {
  return world({
    categories: canonicalCategories(),
    menuGroups: [
      managedGroup(MIRRORED_GROUP_ID.c11, CHILD_11_NAME, CHILD_11_ID),
      managedGroup(MIRRORED_GROUP_ID.c12, CHILD_12_NAME, CHILD_12_ID),
      managedGroup(MIRRORED_GROUP_ID.c21, CHILD_21_NAME, CHILD_21_ID),
    ],
    menus: [
      managedMenu(MIRRORED_MENU_ID.r1, ROOT_1_NAME, ROOT_1_ID, {
        groupIds: [MIRRORED_GROUP_ID.c11, MIRRORED_GROUP_ID.c12],
      }),
      managedMenu(MIRRORED_MENU_ID.r2, ROOT_2_NAME, ROOT_2_ID, {
        groupIds: [MIRRORED_GROUP_ID.c21],
      }),
    ],
  });
}
