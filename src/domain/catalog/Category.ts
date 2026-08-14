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
  parentCategoryId?: string | null;
  parentOrdinal?: number | null;
  rootCategoryId?: string | null;
  isTopLevel?: boolean;
  managedBy?: string | null;
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
  /**
   * Square's two-level MENU_CATEGORY tree, mirrored verbatim from
   * `categoryData.parent_category.id` / `.ordinal`, `categoryData.root_category` and
   * `categoryData.is_top_level` — see the P18.1 integration contract (#85, Amendment 1).
   * A root category becomes a KIOS Menu; a child category becomes a MenuGroup under it.
   *
   * Square omits `parent_category` and `root_category` on roots, so both default to null.
   * `isTopLevel` defaults to TRUE, not false: every doc written before this field existed
   * predates the Square menu tree and is therefore flat, i.e. parentless. Legacy docs
   * deserialize to these defaults because the converter reads through createCategory(),
   * so no backfill is required.
   */
  parentCategoryId: string | null;
  parentOrdinal: number | null;
  rootCategoryId: string | null;
  isTopLevel: boolean;
  /**
   * Ownership lock, not membership. Non-null (currently only 'square') means an external
   * system owns this doc and KIOS surfaces render it read-only. Orthogonal to
   * `MenuGroup.mirrorCategoryId` / `Menu.mirrorCategoryId`, which is the membership
   * source (#79). Defaults to null and is stamped by square-gateway-claude; legacy docs
   * deserialize to null through createCategory(), so no backfill is required.
   */
  managedBy: string | null;
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
    parentCategoryId: input.parentCategoryId ?? null,
    parentOrdinal: input.parentOrdinal ?? null,
    rootCategoryId: input.rootCategoryId ?? null,
    isTopLevel: input.isTopLevel ?? true,
    managedBy: input.managedBy ?? null,
  };
}

export function categoryMeta(category: Category): CategoryMeta {
  return {
    name: category.name,
  };
}
