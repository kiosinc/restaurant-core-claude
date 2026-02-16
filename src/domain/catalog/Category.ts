import { BaseEntity, baseEntityDefaults } from '../BaseEntity';
import { requireNonEmptyString } from '../validation';
import { LinkedObjectMap } from '../LinkedObjectRef';
import { ProductMeta } from './Product';

export interface CategoryMeta {
  name: string;
}

export interface CategoryInput {
  name: string;
  products?: { [id: string]: ProductMeta };
  productDisplayOrder?: string[];
  imageUrls?: string[];
  imageGsls?: string[];
  linkedObjects?: LinkedObjectMap;
}

export interface Category extends BaseEntity {
  name: string;
  products: { [id: string]: ProductMeta };
  productDisplayOrder: string[];
  imageUrls: string[];
  imageGsls: string[];
  linkedObjects: LinkedObjectMap;
}

export function createCategory(input: CategoryInput & Partial<BaseEntity>): Category {
  requireNonEmptyString('name', input.name);
  return {
    ...baseEntityDefaults(input),
    name: input.name,
    products: input.products ?? {},
    productDisplayOrder: input.productDisplayOrder ?? [],
    imageUrls: input.imageUrls ?? [],
    imageGsls: input.imageGsls ?? [],
    linkedObjects: input.linkedObjects ?? {},
  };
}

export function categoryMeta(category: Category): CategoryMeta {
  return {
    name: category.name,
  };
}
