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
  productOrdinals?: { [id: string]: number };
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
  /**
   * Square's per-membership item ordinal, keyed by product id. The source is
   * `item_data.categories[].ordinal` on the Square item — one entry per (product, category)
   * EDGE, not per product (P18.1 integration contract, #85 Amendment 1).
   *
   * A SIBLING MAP, NOT A `ProductMeta` FIELD. `products` is owned by `CatalogCascadeService`,
   * which regenerates `products.{productId}` WHOLESALE from `productMeta(product)` on every
   * product save; a Product holds no per-category value, so anything stored inside that map is
   * erased by the next save. `productSpec.mapField` is 'products', so the cascade's save path
   * touches only `products.{productId}` and a sibling map is outside its write path by
   * construction rather than by everyone remembering.
   *
   * EDGE-SCOPED, NOT PRODUCT-GLOBAL. In the KREATION ORGANIC catalog, item
   * `Q3H7GU65VIHZPZ5OBWXPEKOV` ("Sauteed Kale") holds five memberships carrying ordinals 3, 3,
   * 3, 68719476736 and -2250769021534208 — there is no single product-global value to hoist onto
   * `Product`.
   *
   * PRECISION CEILING. Square ordinals are 64-bit `bigint`, while Firestore numbers are IEEE-754
   * doubles, exact only to 2^53 (~9.0e15). Observed magnitudes peak near 2.25e15, leaving roughly
   * 4x of headroom, so today's data is safe — but square-gateway-claude's `squareOrdinal()`
   * helper does a plain `Number(bigint)`, which degrades SILENTLY past that bound rather than
   * throwing.
   *
   * ORDERING. Sort by ordinal ascending, then by product id ascending; products with NO entry in
   * this map sort LAST ("unknown position", not ordinal 0). Square documents ordinals as neither
   * sequential nor unique, so the id tiebreak is what makes repeated runs agree. `compareSiblings`
   * in `ManagedMenuService` is the in-repo precedent this mirrors, including its reason for plain
   * codepoint comparison over `localeCompare` (whose result depends on the runtime's ICU data).
   * The rule is documented HERE for the writer (square-gateway-claude) to implement; this package
   * implements no comparator, and `productDisplayOrder` remains the single ordering signal
   * consumers read.
   *
   * NEVER A POSITION. These are gap-allocated sort keys, not `0..n-1` indices. They cannot size
   * an array or offset into one — the gaps carry order, not distance.
   *
   * Entries are cleaned up with their product by the cascade: `productSpec.additionalDeleteFields`
   * lists 'productOrdinals', so `productOrdinals.{productId}` is deleted alongside
   * `products.{productId}`. Defaults to {} and legacy docs deserialize to {} through
   * createCategory(), so no backfill is required.
   */
  productOrdinals: { [id: string]: number };
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
    productOrdinals: input.productOrdinals ?? {},
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
