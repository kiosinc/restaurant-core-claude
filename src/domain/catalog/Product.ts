import { BaseEntity, baseEntityDefaults } from '../BaseEntity';
import { requireNonEmptyString, requireNonNegativeNumber, requireNonNegativeInteger, requireMinLessOrEqual } from '../validation';
import { LinkedObjectMap } from '../LinkedObjectRef';
import { ProductOptionSetSetting, OptionSetMeta } from './OptionSet';
import { LocationInventoryMap } from './InventoryCount';

export interface ProductMeta {
  name: string;
  isActive: boolean;
  imageUrls: string[];
  imageGsls: string[];
  minPrice: number;
  maxPrice: number;
  variationCount: number;
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
}

export function createProduct(input: ProductInput & Partial<BaseEntity>): Product {
  requireNonEmptyString('name', input.name);
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
  };
}
