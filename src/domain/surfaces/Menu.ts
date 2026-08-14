import { BaseEntity, baseEntityDefaults } from '../BaseEntity';
import { requireString } from '../validation';
import { MenuGroupMeta } from './MenuGroup';

export interface MenuProductMeta {
  isActive: boolean;
  name: string;
  imageGsls: string[];
  minPrice: number;
  variationCount: number;
  description: string;
}

export interface MenuCollectionMeta {
  name: string;
  displayName: string;
  imageGsls: string[];
  videoGsls: string[];
  isUserInteractionEnabled: boolean;
  type: string;
  hyperlink: string;
}

export interface MenuAsset {
  assetType: 'product' | 'group' | 'collection' | 'htmlText';
  configuration?: string | Record<string, unknown>;
}

export interface MenuMeta {
  name: string;
  displayName: string | null;
}

export interface MenuInput {
  name: string;
  displayName?: string | null;
  groups?: { [id: string]: MenuGroupMeta };
  groupDisplayOrder?: string[];
  coverImageGsl?: string | null;
  coverBackgroundImageGsl?: string | null;
  coverVideoGsl?: string | null;
  logoImageGsl?: string | null;
  gratuityRates?: number[];
  mirrorCategoryId?: string | null;
  managedBy?: string | null;
  collections?: { [id: string]: MenuCollectionMeta };
  menuAssets?: { [id: string]: MenuAsset };
  menuAssetDisplayOrder?: string[];
  version?: string;
  products?: { [id: string]: MenuProductMeta };
}

export interface Menu extends BaseEntity {
  name: string;
  displayName: string | null;
  groups: { [id: string]: MenuGroupMeta };
  groupDisplayOrder: string[];
  coverImageGsl: string | null;
  coverBackgroundImageGsl: string | null;
  coverVideoGsl: string | null;
  logoImageGsl: string | null;
  gratuityRates: number[];
  /**
   * Binds a managed Menu to the Square ROOT category it mirrors (#85 Amendment 1) — the
   * stable identity multi-menu reconcile matches on, exactly as `MenuGroup.mirrorCategoryId`
   * binds a group to its child category. Membership source, not an ownership lock; that is
   * `managedBy` below. Defaults to null, so Menus written before this field existed
   * deserialize to null through createMenu() and no backfill is required.
   *
   * Also declared in `MenuRebuildService`'s `MaterializedMenuDoc`: the rebuild `t.set()`s the
   * whole menu document from that allowlist, so a Menu field missing there is erased on every
   * rebuild. Add to both or neither.
   */
  mirrorCategoryId: string | null;
  managedBy: string | null;
  collections: { [id: string]: MenuCollectionMeta };
  menuAssets: { [id: string]: MenuAsset };
  menuAssetDisplayOrder: string[];
  version: string | null;
  products: { [id: string]: MenuProductMeta };
}

export function createMenu(input: MenuInput & Partial<BaseEntity>): Menu {
  requireString('name', input.name);
  return {
    ...baseEntityDefaults(input),
    name: input.name,
    displayName: input.displayName ?? null,
    groups: input.groups ?? {},
    groupDisplayOrder: input.groupDisplayOrder ?? [],
    coverImageGsl: input.coverImageGsl ?? null,
    coverBackgroundImageGsl: input.coverBackgroundImageGsl ?? null,
    coverVideoGsl: input.coverVideoGsl ?? null,
    logoImageGsl: input.logoImageGsl ?? null,
    gratuityRates: input.gratuityRates ?? [],
    mirrorCategoryId: input.mirrorCategoryId ?? null,
    managedBy: input.managedBy ?? null,
    collections: input.collections ?? {},
    menuAssets: input.menuAssets ?? {},
    menuAssetDisplayOrder: input.menuAssetDisplayOrder ?? [],
    version: input.version ?? null,
    products: input.products ?? {},
  };
}

export function menuMeta(menu: Menu): MenuMeta {
  return {
    name: menu.name,
    displayName: menu.displayName,
  };
}
