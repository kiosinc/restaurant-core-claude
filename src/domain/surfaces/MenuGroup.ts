import { BaseEntity, baseEntityDefaults } from '../BaseEntity';
import { requireNonEmptyString } from '../validation';
import { ProductMeta } from '../catalog/Product';

export interface MenuGroupMeta {
  name: string;
  displayName: string | null;
}

export interface MenuGroupInput {
  name: string;
  displayName?: string | null;
  products?: { [id: string]: ProductMeta };
  productDisplayOrder?: string[];
  parentGroup?: string | null;
  childGroup?: string | null;
  mirrorCategoryId?: string | null;
  managedBy?: string | null;
}

export interface MenuGroup extends BaseEntity {
  name: string;
  displayName: string | null;
  products: { [id: string]: ProductMeta };
  productDisplayOrder: string[];
  parentGroup: string | null;
  childGroup: string | null;
  mirrorCategoryId: string | null;
  managedBy: string | null;
}

export function createMenuGroup(input: MenuGroupInput & Partial<BaseEntity>): MenuGroup {
  requireNonEmptyString('name', input.name);
  return {
    ...baseEntityDefaults(input),
    name: input.name,
    displayName: input.displayName ?? '',
    products: input.products ?? {},
    productDisplayOrder: input.productDisplayOrder ?? [],
    parentGroup: input.parentGroup ?? null,
    childGroup: input.childGroup ?? null,
    mirrorCategoryId: input.mirrorCategoryId ?? null,
    managedBy: input.managedBy ?? null,
  };
}

export function menuGroupMeta(menuGroup: MenuGroup): MenuGroupMeta {
  return {
    name: menuGroup.name,
    displayName: menuGroup.displayName,
  };
}
