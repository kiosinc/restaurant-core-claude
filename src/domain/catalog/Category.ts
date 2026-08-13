import { BaseEntity, baseEntityDefaults } from '../BaseEntity';
import { requireString } from '../validation';
import { LinkedObjectMap } from '../LinkedObjectRef';
import { ProductMeta } from './Product';

export interface CategoryMeta {
  name: string;
}

/**
 * Square category classification. Mirrors Square's `categoryData.categoryType`
 * (`MENU_CATEGORY` / `REGULAR_CATEGORY` / `KITCHEN_CATEGORY`) — see the P18
 * integration contract (#85). A union rather than an enum so consuming packages
 * (kios-commons-types, square-gateway-claude) mirror the same structural shape.
 */
export type CategoryType = 'menu' | 'regular' | 'kitchen';

export interface CategoryInput {
  name: string;
  products?: { [id: string]: ProductMeta };
  productDisplayOrder?: string[];
  imageUrls?: string[];
  imageGsls?: string[];
  linkedObjects?: LinkedObjectMap;
  categoryType?: CategoryType;
}

export interface Category extends BaseEntity {
  name: string;
  products: { [id: string]: ProductMeta };
  productDisplayOrder: string[];
  imageUrls: string[];
  imageGsls: string[];
  linkedObjects: LinkedObjectMap;
  /**
   * Defaults to 'regular'; 'menu' and 'kitchen' are stamped by
   * square-gateway-claude. Legacy docs written before this field existed
   * deserialize to 'regular', because the converter reads through createCategory().
   */
  categoryType: CategoryType;
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
