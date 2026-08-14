import { BaseEntity, baseEntityDefaults } from '../BaseEntity';
import { requireString, requireNonNegativeNumber, requireNonNegativeInteger, requireMinLessOrEqual } from '../validation';
import { LinkedObjectMap } from '../LinkedObjectRef';
import { ProductOptionSetSetting, OptionSetMeta } from './OptionSet';
import { LocationInventoryMap } from './InventoryCount';

/**
 * Denormalized product projection embedded at `Category.products[productId]` and
 * `MenuGroup.products[productId]`.
 *
 * PER-MEMBERSHIP, NOT PRODUCT-GLOBAL. The shape reads like a product-global one, but every
 * category and every menuGroup holds its own copy, and `squareOrdinal` genuinely differs
 * between those copies: in the KREATION ORGANIC catalog, item `Q3H7GU65VIHZPZ5OBWXPEKOV`
 * ("Sauteed Kale") holds five memberships carrying ordinals 3, 3, 3, 68719476736 and
 * -2250769021534208. So do not "deduplicate" it up onto `Product` — there is no single value to
 * move there. The source field is Square's `item_data.categories[].ordinal` (P18.1 integration
 * contract, #85 Amendment 1).
 *
 * ABSENT IS NOT null-WRITTEN. `squareOrdinal` follows the same convention as
 * `dietaryPreferences` / `allergens` / `calorieCount` above it: absent means "unknown
 * position", and consumers read `?? null`. There is deliberately NO normalization pass filling
 * it in, because ProductMeta entries never pass through a factory — `createCategory` and
 * `createMenuGroup` copy the products map verbatim — and adding one would (a) allocate a fresh
 * object per entry on every read of a category that can hold thousands of products, and (b)
 * make `toFirestore` persist an explicit `null` onto every legacy entry in the whole catalog,
 * creating exactly the index entries the `products` map exemption exists to avoid (see
 * FIRESTORE_INDEXES.md). Legacy docs therefore need no backfill: the key simply stays absent
 * through the round trip.
 *
 * PRECISION CEILING. Square ordinals are 64-bit `bigint`, while Firestore numbers are IEEE-754
 * doubles, exact only to 2^53 (~9.0e15). Observed magnitudes peak near 2.25e15, roughly 4x of
 * headroom, so today's data is safe — but square-gateway-claude's `squareOrdinal()` helper does
 * a plain `Number(bigint)`, which degrades SILENTLY past that bound rather than throwing.
 *
 * ORDERING. Sort by ordinal ascending, then by product id ascending, with nulls LAST. Square
 * documents ordinals as neither sequential nor unique, so the id tiebreak is what makes
 * repeated runs agree, and `null` is "unknown position" rather than ordinal 0. `compareSiblings`
 * in `ManagedMenuService` is the in-repo precedent this mirrors, including its reason for plain
 * codepoint comparison over `localeCompare` (whose result depends on the runtime's ICU data).
 * The rule is documented HERE for the writer (square-gateway-claude) to implement; this package
 * implements no comparator, and `productDisplayOrder` remains its single ordering signal.
 *
 * NEVER A POSITION. These are gap-allocated sort keys, not `0..n-1` indices. They cannot size
 * an array or offset into one — the gaps carry order, not distance.
 *
 * NEVER `undefined`. A writer must either omit the key or write a concrete `number` or `null`.
 * Firestore rejects `undefined` unless the client sets `ignoreUndefinedProperties`, which this
 * repo does not — exactly why `productMeta()` below spreads `calorieCount` conditionally.
 *
 * CASCADE HAZARD: a persisted `squareOrdinal` is erased by the next product save. Full text on
 * `productMeta()` below.
 */
export interface ProductMeta {
  name: string;
  isActive: boolean;
  imageUrls: string[];
  imageGsls: string[];
  minPrice: number;
  maxPrice: number;
  variationCount: number;
  dietaryPreferences?: string[];
  allergens?: string[];
  calorieCount?: number;
  squareOrdinal?: number | null;
}

export interface ProductInput {
  name: string;
  caption?: string;
  description?: string;
  imageUrls?: string[];
  imageGsls?: string[];
  optionSets?: { [id: string]: OptionSetMeta };
  optionSetsSelection?: { [id: string]: ProductOptionSetSetting };
  minPrice: number;
  maxPrice: number;
  variationCount: number;
  locationInventory?: LocationInventoryMap;
  isActive: boolean;
  linkedObjects?: LinkedObjectMap;
  dietaryPreferences?: string[];
  allergens?: string[];
  calorieCount?: number;
}

export interface Product extends BaseEntity {
  name: string;
  caption: string;
  description: string;
  imageUrls: string[];
  imageGsls: string[];
  optionSets: { [id: string]: OptionSetMeta };
  optionSetsSelection: { [id: string]: ProductOptionSetSetting };
  minPrice: number;
  maxPrice: number;
  variationCount: number;
  locationInventory: LocationInventoryMap;
  isActive: boolean;
  linkedObjects: LinkedObjectMap;
  dietaryPreferences: string[];
  allergens: string[];
  calorieCount?: number;
}

export function createProduct(input: ProductInput & Partial<BaseEntity>): Product {
  requireString('name', input.name);
  requireNonNegativeNumber('minPrice', input.minPrice);
  requireNonNegativeNumber('maxPrice', input.maxPrice);
  requireMinLessOrEqual('minPrice', input.minPrice, 'maxPrice', input.maxPrice);
  requireNonNegativeInteger('variationCount', input.variationCount);
  return {
    ...baseEntityDefaults(input),
    name: input.name,
    caption: input.caption ?? '',
    description: input.description ?? '',
    imageUrls: input.imageUrls ?? [],
    imageGsls: input.imageGsls ?? [],
    optionSets: input.optionSets ?? {},
    optionSetsSelection: input.optionSetsSelection ?? {},
    minPrice: input.minPrice,
    maxPrice: input.maxPrice,
    variationCount: input.variationCount,
    locationInventory: input.locationInventory ?? {},
    isActive: input.isActive,
    linkedObjects: input.linkedObjects ?? {},
    dietaryPreferences: input.dietaryPreferences ?? [],
    allergens: input.allergens ?? [],
    calorieCount: input.calorieCount,
  };
}

/**
 * Deliberately does NOT project `squareOrdinal`. The ordinal is per-membership and lives only on
 * the category/menuGroup copy, so `Product` holds no product-global value to project from.
 *
 * CASCADE OVERWRITE HAZARD. `CatalogCascadeService.buildSavedUpdates` sets
 * `categories/{categoryId}.products.{productId}` and
 * `menuGroups/{menuGroupId}.products.{productId}` to this function's output WHOLESALE, so any
 * persisted `squareOrdinal` is erased by the next product save. Whatever writes the ordinal must
 * re-supply it. Out of scope for #179 and tracked as a follow-up; do not "fix" it here by making
 * the cascade merge instead of replace — that is a behavior change to a shared, transactional
 * denormalization path and needs its own issue and tests.
 */
export function productMeta(product: Product): ProductMeta {
  return {
    name: product.name,
    isActive: product.isActive,
    imageUrls: product.imageUrls,
    imageGsls: product.imageGsls,
    minPrice: product.minPrice,
    maxPrice: product.maxPrice,
    variationCount: product.variationCount,
    dietaryPreferences: product.dietaryPreferences,
    allergens: product.allergens,
    ...(product.calorieCount !== undefined && { calorieCount: product.calorieCount }),
  };
}
