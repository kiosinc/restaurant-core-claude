/**
 * #207 — the owned answer to "did this write change anything a materialized output depends on?".
 *
 * This repo decides which entity fields can move a materialized Menu or a stamped
 * `products.{id}` entry, and until now it exported none of that. Consumers that gate a cascade
 * on it (kiosinc/firestore-functions#48) had to re-derive the set by reading this source, with
 * nothing failing on either side when the two drifted.
 *
 * ## Why a product's set is a union of three declarations
 *
 * A product change reaches two different outputs through two different projections, and they
 * are not the same set:
 *
 *  - **tier 1** — `productMeta()` (`../catalog/Product.ts`) stamps `ProductMeta` onto
 *    `Category.products.{id}` and `MenuGroup.products.{id}`.
 *  - **tier 2** — `MenuRebuildService.materializeGroups()` writes `MenuProductMeta` into
 *    `Menu.groups.{g}.products.{id}`.
 *
 * `description` exists only in tier 2; `imageUrls`, `maxPrice`, `dietaryPreferences`,
 * `allergens` and `calorieCount` only in tier 1. `isDeleted` is in neither interface — it gates
 * materialization (`if (!product || product.data.isDeleted) continue;`) and dropping a product
 * from a menu is as much a rebuild as renaming it. A gate built from either interface alone is
 * wrong in one direction (misses real changes) or the other (cascades on no-ops).
 *
 * ## Why `MenuGroupMeta.products` is excluded
 *
 * `materializeGroups` never reads a group's own `products` map — it rebuilds that section from
 * the live product docs. That map is exactly what the cascade's own tier 1 stamps, so gating on
 * it would make every product cascade enqueue a redundant menuGroup cascade.
 *
 * ## Drift
 *
 * The key lists below are `Record<keyof T, true>` witnesses, not copies: a field added to
 * `ProductMeta`, `MenuProductMeta` or `MenuGroupMeta` fails to compile here until it is
 * accounted for, and `__tests__/RebuildRelevance.test.ts` re-derives both sets from an actual
 * rebuild so a materializer that starts reading a *fourth* declaration is caught too.
 */
import type { BaseEntity } from '../BaseEntity';
import type { ProductMeta } from '../catalog/Product';
import type { MenuProductMeta } from '../surfaces/Menu';
import type { MenuGroupMeta } from '../surfaces/MenuGroup';

/**
 * Lifts a compile-time key union into a runtime key list. The `Record<keyof T, true>` parameter
 * is what makes this a derivation rather than a hand copy: TypeScript rejects the call when a
 * key of `T` is missing, and excess-property checking rejects one that no longer exists.
 */
function keysOf<T>(witness: Record<keyof T, true>): (keyof T)[] {
  return Object.keys(witness) as (keyof T)[];
}

const PRODUCT_META_KEYS = keysOf<ProductMeta>({
  name: true,
  isActive: true,
  imageUrls: true,
  imageGsls: true,
  minPrice: true,
  maxPrice: true,
  variationCount: true,
  dietaryPreferences: true,
  allergens: true,
  calorieCount: true,
});

const MENU_PRODUCT_META_KEYS = keysOf<MenuProductMeta>({
  isActive: true,
  name: true,
  imageGsls: true,
  minPrice: true,
  variationCount: true,
  description: true,
});

const MENU_GROUP_META_KEYS = keysOf<MenuGroupMeta>({
  name: true,
  displayName: true,
  imageGsls: true,
  productDisplayOrder: true,
  mirrorCategoryId: true,
  managedBy: true,
  products: true,
});

/**
 * Both names are bound through `Extract<>` rather than written as bare string literals: renaming
 * `BaseEntity.isDeleted` or `MenuGroupMeta.products` collapses the type to `never` and breaks
 * this file, instead of silently dropping the materialization gate or re-admitting the map the
 * cascade itself stamps.
 */
const IS_DELETED: Extract<keyof BaseEntity, 'isDeleted'> = 'isDeleted';
const MENU_GROUP_STAMPED_MAP: Extract<keyof MenuGroupMeta, 'products'> = 'products';

function sortedUnique<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)].sort();
}

/** Entity kinds a cascade caller can be triggered by today. See #207 "Out" for the rest. */
export type RebuildKind = 'product' | 'menuGroup';

/** Union of the tier-1 and tier-2 product projections plus the materialization gate. */
export type ProductRebuildField = keyof ProductMeta | keyof MenuProductMeta | 'isDeleted';

/** `MenuGroupMeta` keys minus the cascade-stamped `products` map, plus the gate. */
export type MenuGroupRebuildField = Exclude<keyof MenuGroupMeta, 'products'> | 'isDeleted';

/**
 * Every product field that can move a materialized output — 12 names drawn from `ProductMeta`,
 * `MenuProductMeta` and the `isDeleted` gate. Sorted, so the exported order is a stable contract
 * rather than a consequence of witness ordering.
 */
export const PRODUCT_REBUILD_FIELDS: readonly ProductRebuildField[] = Object.freeze(
  sortedUnique<ProductRebuildField>([...PRODUCT_META_KEYS, ...MENU_PRODUCT_META_KEYS, IS_DELETED]),
);

/** Every menuGroup field `materializeGroups` reads, plus the `isDeleted` gate. */
export const MENU_GROUP_REBUILD_FIELDS: readonly MenuGroupRebuildField[] = Object.freeze(
  sortedUnique<MenuGroupRebuildField>([
    ...MENU_GROUP_META_KEYS.filter(
      (key): key is Exclude<keyof MenuGroupMeta, 'products'> => key !== MENU_GROUP_STAMPED_MAP,
    ),
    IS_DELETED,
  ]),
);

/** The read-sets keyed by kind, for callers that dispatch rather than branch. */
export const REBUILD_FIELDS: Readonly<Record<RebuildKind, readonly string[]>> = Object.freeze({
  product: PRODUCT_REBUILD_FIELDS,
  menuGroup: MENU_GROUP_REBUILD_FIELDS,
});

/**
 * One side of a Firestore change. `change.before.data()` / `change.after.data()` yield
 * `undefined` on create and delete respectively, so both ends are nullable by construction.
 */
export type RebuildDocData = Record<string, unknown> | null | undefined;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Structural comparison of one field across a change.
 *
 * Two properties matter for real Firestore documents, and neither survives the
 * `JSON.stringify(before[f]) !== JSON.stringify(after[f])` a consumer would otherwise write:
 *
 *  - **Absent === `undefined`.** Most of this repo's fields postdate the documents that carry
 *    them (`managedBy`, `mirrorCategoryId`, `calorieCount`, `productOrdinals` all shipped after
 *    prod had populated collections), so a legacy doc simply has no key. Property access hands
 *    both states back as `undefined` and `===` settles it — no `hasOwnProperty` bookkeeping.
 *  - **`null` is a value, not an absence.** The materializers coalesce (`x ?? null`, `?? []`),
 *    so absent → explicit-null usually materializes identically and reporting it as a change
 *    costs one redundant rebuild. That is the cheap direction: the expensive one is a menu that
 *    silently stops rebuilding. Nothing here may trade a missed change for a saved write.
 *
 * Arrays compare element-wise and order-sensitively — `productDisplayOrder` and `imageGsls` are
 * ordered outputs, so a reorder IS a change. Non-plain objects (Firestore `Timestamp`,
 * `DocumentReference`, `Date`) fall through to reference identity and therefore report a change;
 * no field in either read-set is one of those, and erring toward a rebuild is the safe default.
 */
function fieldValuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'number') {
    return Number.isNaN(a) && Number.isNaN(b);
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((element, index) => fieldValuesEqual(element, b[index]));
  }
  if (isPlainRecord(a) && isPlainRecord(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      if (!fieldValuesEqual(a[key], b[key])) return false;
    }
    return true;
  }
  return false;
}

function affectsAnyOf(
  fields: readonly string[],
  before: RebuildDocData,
  after: RebuildDocData,
): boolean {
  const hasBefore = before !== null && before !== undefined;
  const hasAfter = after !== null && after !== undefined;
  // Create and delete are always rebuild-relevant: the entity entered or left every output that
  // references it, whatever its individual fields say. Neither side present is not a change.
  if (!hasBefore && !hasAfter) return false;
  if (!hasBefore || !hasAfter) return true;
  return fields.some((field) => !fieldValuesEqual(before[field], after[field]));
}

/**
 * True when a product write can move a stamped `products.{id}` entry or a materialized menu —
 * i.e. when a cascade for this product is worth enqueuing.
 */
export function affectsProductRebuild(before: RebuildDocData, after: RebuildDocData): boolean {
  return affectsAnyOf(PRODUCT_REBUILD_FIELDS, before, after);
}

/** True when a menuGroup write can move a materialized menu. */
export function affectsMenuGroupRebuild(before: RebuildDocData, after: RebuildDocData): boolean {
  return affectsAnyOf(MENU_GROUP_REBUILD_FIELDS, before, after);
}

/** Kind-dispatching form of the two predicates above. */
export function affectsRebuild(
  kind: RebuildKind,
  before: RebuildDocData,
  after: RebuildDocData,
): boolean {
  const fields = REBUILD_FIELDS[kind];
  // Reachable only from JavaScript callers, where an unknown kind would otherwise gate on an
  // empty field list and silently suppress every cascade for it. Fail loudly instead.
  if (!fields) throw new Error(`affectsRebuild: unknown kind '${String(kind)}'`);
  return affectsAnyOf(fields, before, after);
}
