import { BaseEntity, baseEntityDefaults } from '../BaseEntity';
import { requireString } from '../validation';
import { LinkedObjectMap } from '../LinkedObjectRef';
import { ProductOptionSetSetting, OptionSetMeta } from './OptionSet';
import { LocationInventoryMap } from './InventoryCount';

/**
 * Denormalized product projection embedded at `Category.products[productId]` and
 * `MenuGroup.products[productId]`.
 *
 * Square's per-category item ordinal deliberately does NOT live here.
 * `CatalogCascadeService` regenerates the whole `products.{productId}` entry from
 * `productMeta(product)` on every product save, and a Product carries no per-category value —
 * so anything edge-scoped stored on this shape is erased by the next save. The ordinal lives in
 * the sibling map `Category.productOrdinals` / `MenuGroup.productOrdinals`; see
 * `Category.productOrdinals` for the full rationale.
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

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && value >= 0;
}

export function createProduct(input: ProductInput & Partial<BaseEntity>): Product {
  requireString('name', input.name);

  // #93: minPrice/maxPrice/variationCount are derived — catalog sync recomputes them from the
  // item's variations on every pass — so they are repairable data, not user-authored input.
  // Validating them made a legacy document unreadable through productConverter.fromFirestore, and
  // the read happens inside upsertCatalogEntity *before* the recompute that would have fixed it,
  // so the poison pill took down the whole Items stage instead. Default on read: the doc hydrates
  // with zeroes, the processor overwrites them with the real values, and the next sync repairs it.
  // #204: a one-sided input is mirrored, not defaulted. Defaulting the absent side to 0 let that 0
  // win the clamp below and destroy the value that was actually there ({ minPrice: 5 } hydrated as
  // 0/0), and a hydrate→mutate→save writer then persists the zero. Mirroring keeps min <= max
  // without inventing a price. Both sides absent — or negative, which fails the guard the same way
  // — still lands on 0/0 per #93 above.
  const presentMinPrice = isNonNegativeNumber(input.minPrice) ? input.minPrice : undefined;
  const presentMaxPrice = isNonNegativeNumber(input.maxPrice) ? input.maxPrice : undefined;
  const minPrice = presentMinPrice ?? presentMaxPrice ?? 0;
  const maxPrice = presentMaxPrice ?? presentMinPrice ?? 0;
  const variationCount =
    isNonNegativeNumber(input.variationCount) && Number.isInteger(input.variationCount)
      ? input.variationCount
      : 0;

  return {
    ...baseEntityDefaults(input),
    name: input.name,
    caption: input.caption ?? '',
    description: input.description ?? '',
    imageUrls: input.imageUrls ?? [],
    imageGsls: input.imageGsls ?? [],
    optionSets: input.optionSets ?? {},
    optionSetsSelection: input.optionSetsSelection ?? {},
    // Clamp rather than throw: defaulting one side of the pair can break min <= max on its own,
    // and re-introducing a throw there would just move the poison pill.
    minPrice: Math.min(minPrice, maxPrice),
    maxPrice,
    variationCount,
    locationInventory: input.locationInventory ?? {},
    // #198: defaulted, not validated — productMeta emits this into a parent document's map, merged
    // by transaction.update here and by the businesses cascade's batch.update downstream; an
    // undefined fails the whole write either way (#204: the batching is the consumer's, not this
    // repo's). Prod population needing the default is zero, so validating would change behaviour
    // for nothing.
    isActive: input.isActive ?? false,
    linkedObjects: input.linkedObjects ?? {},
    dietaryPreferences: input.dietaryPreferences ?? [],
    allergens: input.allergens ?? [],
    // #204: absent means unknown, so omit the key rather than emit an explicit undefined that
    // Firestore rejects. Not defaulted to a number — 0 calories is a claim. Mirrors productMeta.
    ...(input.calorieCount !== undefined && { calorieCount: input.calorieCount }),
  };
}

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
