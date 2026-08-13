import { BaseEntity, baseEntityDefaults } from '../BaseEntity';
import { requireString } from '../validation';
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
  categoryType?: 'menu' | 'regular' | 'kitchen';
}

export interface Category extends BaseEntity {
  name: string;
  products: { [id: string]: ProductMeta };
  productDisplayOrder: string[];
  imageUrls: string[];
  imageGsls: string[];
  linkedObjects: LinkedObjectMap;
  /**
   * Square category classification. Defaults to 'regular'; 'menu' and 'kitchen' are
   * stamped by square-gateway-claude from Square `categoryData.categoryType` (#85).
   * Legacy docs without the field deserialize to 'regular' via createCategory().
   */
  categoryType: 'menu' | 'regular' | 'kitchen';
}

export function createCategory(input: CategoryInput & Partial<BaseEntity>): Category {
  requireString('name', input.name);
  return {
    ...baseEntityDefaults(input),
    name: input.name,
    products: input.products ?? {},
    productDisplayOrder: input.productDisplayOrder ?? [],
    imageUrls: input.imageUrls ?? [],
    imageGsls: input.imageGsls ?? [],
    linkedObjects: input.linkedObjects ?? {},
    categoryType: input.categoryType ?? 'regular',
  };
}

export function categoryMeta(category: Category): CategoryMeta {
  return {
    name: category.name,
  };
}
