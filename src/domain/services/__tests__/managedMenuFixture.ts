/**
 * #88 test fixture for `ManagedMenuService.syncManagedSquareMenu`.
 *
 * Deliberately separate from `rebuildFixture.ts`: the 61 MenuRebuildService tests pin that
 * fixture's exact shape (4 menus / 11 groups / 39 products), so growing it to cover managed-menu
 * reconciliation would couple two unrelated suites.
 *
 * Every exported helper BUILDS ITS DOCS ON EACH CALL, so a test may freely mutate the returned
 * documents (that is how the demote → re-promote round trip flips a category's `categoryType`
 * between runs — `registerCollection` stores the very object it is handed, so mutating the
 * returned doc data mutates the registered store) without leaking state into the next test.
 *
 * Category coverage, mirroring the desired-state input rule:
 *   - `catA` / `catB`   — `categoryType: 'menu'`, the only two that must ever be mirrored
 *   - `catKitchen`      — `'kitchen'`, excluded by the equality query
 *   - `catRegular`      — `'regular'`, excluded by the equality query
 *   - `catLegacy`       — NO `categoryType` KEY AT ALL (docs written before #87), so it can never
 *                         match `where('categoryType','==','menu')`
 *   - `catDeletedMenu`  — `'menu'` but `isDeleted`, excluded by the in-memory filter
 *
 * MenuGroup coverage in `baseFixture()`:
 *   - `mgUnmanaged`      — mirrors `catA`, `managedBy: null` → the convert-in-place path
 *   - `mgLegacyNoMirror` — no `mirrorCategoryId` key and no `managedBy` key, name-identical to a
 *                          menu category → proves matching is by id, never by name
 *   - `mgOrphanManaged`  — `managedBy: 'square'` mirroring a category that does not exist → the
 *                          demote-in-place path
 *   - `mgClassic`        — a plain operator group, must never be touched
 * and `classicMenu` references BOTH `mgUnmanaged` and `mgOrphanManaged`, which is what proves an
 * operator's classic menu keeps its reference to a group this service demotes.
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

/** Category ids and the values tests assert against, so no test reaches into the doc data. */
export const CAT_A_ID = 'catA';
export const CAT_A_NAME = 'Appetizers';
export const CAT_A_PRODUCT_ORDER = ['pa1', 'pa2'];
export const CAT_B_ID = 'catB';
export const CAT_B_NAME = 'Beverages';
export const CAT_B_PRODUCT_ORDER = ['pb1'];
/** The `mirrorCategoryId` of `mgOrphanManaged` — intentionally has no Category document. */
export const MISSING_CATEGORY_ID = 'catGone';

const CREATED_ISO = '2026-01-01T00:00:00.000Z';
const UPDATED_ISO = '2026-02-01T00:00:00.000Z';

function baseFields(): Record<string, unknown> {
  return { created: CREATED_ISO, updated: UPDATED_ISO, isDeleted: false };
}

function product(id: string, name: string, minPrice: number): FixtureDoc {
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

/**
 * A Category doc. `categoryType` is only present when explicitly passed, so
 * `category('catLegacy', 'Legacy')` produces a genuine pre-#87 doc with the key ABSENT rather
 * than a doc with an explicit `undefined`.
 */
function category(
  id: string,
  name: string,
  overrides?: { categoryType?: string; productDisplayOrder?: string[]; isDeleted?: boolean },
): FixtureDoc {
  return {
    id,
    data: {
      ...baseFields(),
      name,
      products: {},
      productDisplayOrder: overrides?.productDisplayOrder ?? [],
      imageUrls: [],
      imageGsls: [],
      linkedObjects: {},
      ...(overrides?.categoryType !== undefined ? { categoryType: overrides.categoryType } : {}),
      ...(overrides?.isDeleted !== undefined ? { isDeleted: overrides.isDeleted } : {}),
    },
  };
}

/**
 * A MenuGroup doc. `mirrorCategoryId` and `managedBy` are only present when explicitly passed,
 * so a legacy group really is missing both keys rather than carrying explicit nulls.
 */
function menuGroup(
  id: string,
  name: string,
  overrides?: {
    displayName?: string;
    productDisplayOrder?: string[];
    mirrorCategoryId?: string | null;
    managedBy?: string | null;
    isDeleted?: boolean;
  },
): FixtureDoc {
  return {
    id,
    data: {
      ...baseFields(),
      name,
      displayName: overrides?.displayName ?? name,
      imageGsls: [],
      products: {},
      productDisplayOrder: overrides?.productDisplayOrder ?? [],
      parentGroup: null,
      childGroup: null,
      ...(overrides?.mirrorCategoryId !== undefined
        ? { mirrorCategoryId: overrides.mirrorCategoryId }
        : {}),
      ...(overrides?.managedBy !== undefined ? { managedBy: overrides.managedBy } : {}),
      ...(overrides?.isDeleted !== undefined ? { isDeleted: overrides.isDeleted } : {}),
    },
  };
}

function menu(
  id: string,
  name: string,
  overrides?: { managedBy?: string | null; groupIds?: string[]; isDeleted?: boolean },
): FixtureDoc {
  const groupIds = overrides?.groupIds ?? [];
  const menuAssets: Record<string, unknown> = {};
  for (const gid of groupIds) menuAssets[gid] = { assetType: 'group' };
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
      managedBy: overrides?.managedBy ?? null,
      groups: {},
      groupDisplayOrder: [...groupIds],
      collections: {},
      menuAssets,
      menuAssetDisplayOrder: [...groupIds],
      products: {},
      version: null,
      ...(overrides?.isDeleted !== undefined ? { isDeleted: overrides.isDeleted } : {}),
    },
  };
}

/** The three products referenced by `catA` / `catB`. */
function fixtureProducts(): FixtureDoc[] {
  return [
    product('pa1', 'Hummus', 600),
    product('pa2', 'Falafel', 700),
    product('pb1', 'Cola', 300),
  ];
}

/** Every category shape the desired-state query has to get right. */
function fixtureCategories(): FixtureDoc[] {
  return [
    category(CAT_A_ID, CAT_A_NAME, { categoryType: 'menu', productDisplayOrder: CAT_A_PRODUCT_ORDER }),
    category(CAT_B_ID, CAT_B_NAME, { categoryType: 'menu', productDisplayOrder: CAT_B_PRODUCT_ORDER }),
    category('catKitchen', 'Expo Station', { categoryType: 'kitchen' }),
    category('catRegular', 'Back Office', { categoryType: 'regular' }),
    // No `categoryType` key at all — a pre-#87 document.
    category('catLegacy', 'Legacy Category'),
    category('catDeletedMenu', 'Retired Menu Category', { categoryType: 'menu', isDeleted: true }),
  ];
}

/**
 * The default world: one convertible group, one legacy group that must never be matched, one
 * orphaned managed group to demote, one operator group, and a classic menu referencing two of
 * them. No `managedBy: 'square'` Menu exists yet, so a run against this set exercises create +
 * convert + demote at once.
 */
export function baseFixture(): FixtureSet {
  return {
    categories: fixtureCategories(),
    products: fixtureProducts(),
    menuGroups: [
      menuGroup('mgUnmanaged', CAT_A_NAME, {
        mirrorCategoryId: CAT_A_ID,
        managedBy: null,
        productDisplayOrder: ['pa1'],
      }),
      // Name-identical to catB but with neither key — must never be adopted.
      menuGroup('mgLegacyNoMirror', CAT_B_NAME, { displayName: 'Drinks' }),
      menuGroup('mgOrphanManaged', 'Gone Category', {
        mirrorCategoryId: MISSING_CATEGORY_ID,
        managedBy: 'square',
      }),
      menuGroup('mgClassic', 'Operator Picks', { mirrorCategoryId: null, managedBy: null }),
    ],
    menus: [
      menu('classicMenu', 'Classic Menu', {
        managedBy: null,
        groupIds: ['mgUnmanaged', 'mgOrphanManaged'],
      }),
    ],
  };
}

/** Categories and products only — the pure create path, with nothing to adopt or demote. */
export function menuCategoriesOnly(): FixtureSet {
  return {
    categories: fixtureCategories(),
    products: fixtureProducts(),
    menuGroups: [],
    menus: [],
  };
}

/** Only categories that must never be mirrored, so the assembly comes out empty. */
export function noQualifyingCategories(): FixtureSet {
  return {
    categories: fixtureCategories().filter((c) => c.id !== CAT_A_ID && c.id !== CAT_B_ID),
    products: fixtureProducts(),
    menuGroups: [],
    menus: [],
  };
}

/**
 * A single already-managed group mirroring `catA`. Used for the steady-state "no write" case and,
 * by flipping `catA.categoryType` between runs, for the demote → re-promote round trip.
 */
export function withManagedGroupForCatA(): FixtureSet {
  return {
    categories: fixtureCategories(),
    products: fixtureProducts(),
    menuGroups: [
      menuGroup('mgManagedA', CAT_A_NAME, { mirrorCategoryId: CAT_A_ID, managedBy: 'square' }),
    ],
    menus: [],
  };
}

/** A managed group whose mirror category is soft-deleted — it must be demoted, not deleted. */
export function withSoftDeletedMirrorCategory(): FixtureSet {
  const categories = fixtureCategories();
  const catA = categories.find((c) => c.id === CAT_A_ID);
  if (catA) catA.data.isDeleted = true;
  return {
    categories,
    products: fixtureProducts(),
    menuGroups: [
      menuGroup('mgSoftDeleted', CAT_A_NAME, { mirrorCategoryId: CAT_A_ID, managedBy: 'square' }),
    ],
    menus: [],
  };
}

/** An `isDeleted` group mirroring `catA` — invisible to matching, so a fresh group is created. */
export function withDeletedMenuGroup(): FixtureSet {
  return {
    categories: fixtureCategories(),
    products: fixtureProducts(),
    menuGroups: [
      menuGroup('mgDeletedMirror', CAT_A_NAME, {
        mirrorCategoryId: CAT_A_ID,
        managedBy: null,
        isDeleted: true,
      }),
    ],
    menus: [],
  };
}

/**
 * Two groups mirroring `catA`, so exactly one must win. Ids are chosen so `dupA` sorts before
 * `dupB`, making the lowest-doc-id tie-break observable.
 */
export function withDuplicateMirrors(
  firstManagedBy: string | null,
  secondManagedBy: string | null,
): FixtureSet {
  return {
    categories: fixtureCategories().filter((c) => c.id !== CAT_B_ID),
    products: fixtureProducts(),
    menuGroups: [
      menuGroup('dupA', CAT_A_NAME, { mirrorCategoryId: CAT_A_ID, managedBy: firstManagedBy }),
      menuGroup('dupB', CAT_A_NAME, { mirrorCategoryId: CAT_A_ID, managedBy: secondManagedBy }),
    ],
    menus: [],
  };
}

/** Ids of the two identically-named categories, in the order the category-id tie-break must produce. */
export const TIE_CATEGORY_IDS = ['catTie1', 'catTie2'];

/** Two menu categories with the SAME name, so ordering must fall through to the category id. */
export function withTieCategories(): FixtureSet {
  return {
    categories: TIE_CATEGORY_IDS.map((id) => category(id, 'Tie Category', { categoryType: 'menu' })),
    products: [],
    menuGroups: [],
    menus: [],
  };
}

/**
 * 'Zebra' and 'apple': codepoint ordering puts 'Zebra' (U+005A) first, `localeCompare` puts
 * 'apple' first. The assembly order is the regression guard against `localeCompare` creeping back.
 */
export const CODEPOINT_CATEGORY_IDS = { zebra: 'catZebra', apple: 'catApple' };

export function withCodepointCategories(): FixtureSet {
  return {
    categories: [
      category(CODEPOINT_CATEGORY_IDS.apple, 'apple', { categoryType: 'menu' }),
      category(CODEPOINT_CATEGORY_IDS.zebra, 'Zebra', { categoryType: 'menu' }),
    ],
    products: [],
    menuGroups: [],
    menus: [],
  };
}

/** Id of the pre-existing `managedBy: 'square'` Menu used by the reuse-path tests. */
export const EXISTING_SQUARE_MENU_ID = 'sqMenu';

/** The base world plus an already-existing managed Menu, so the run reuses it instead of creating. */
export function withExistingSquareMenu(): FixtureSet {
  const fixture = baseFixture();
  fixture.menus.push(menu(EXISTING_SQUARE_MENU_ID, 'Square Menu', { managedBy: 'square' }));
  return fixture;
}

/** Ids of the two managed Menus that violate the one-managed-Menu invariant. */
export const DUPLICATE_SQUARE_MENU_IDS = ['sqMenuA', 'sqMenuB'];

export function withTwoSquareMenus(): FixtureSet {
  const fixture = menuCategoriesOnly();
  for (const id of DUPLICATE_SQUARE_MENU_IDS) {
    fixture.menus.push(menu(id, 'Square Menu', { managedBy: 'square' }));
  }
  return fixture;
}

/** Id of the soft-deleted managed Menu, which must be neither reused nor counted. */
export const DELETED_SQUARE_MENU_ID = 'sqMenuDeleted';

export function withDeletedSquareMenu(): FixtureSet {
  const fixture = menuCategoriesOnly();
  fixture.menus.push(
    menu(DELETED_SQUARE_MENU_ID, 'Square Menu', { managedBy: 'square', isDeleted: true }),
  );
  return fixture;
}
