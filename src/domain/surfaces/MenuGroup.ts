import { BaseEntity, baseEntityDefaults } from '../BaseEntity';
import { requireString } from '../validation';
import { ProductMeta } from '../catalog/Product';
import type { MenuProductMeta } from './Menu';

/**
 * Embedded projection of a MenuGroup. Two writers produce this shape and they
 * populate different subsets, which is why everything past `displayName` is
 * optional:
 * - `MenuRebuildService.materializeGroups()` writes all of them into
 *   `Menu.groups[id]`. That is the full shape, and the one consumers read.
 * - `menuGroupMeta()` below writes only `{ name, displayName }` into the
 *   Surfaces root's `menuGroups` map, which is just a name index.
 *
 * So an optional field here means "not populated on every path", not "may be
 * missing from a materialized menu" — the rebuild always writes a concrete
 * value for each. kios-commons-types accordingly mirrors `managedBy` as a
 * non-optional `string | null` (#85 shape 2).
 */
export interface MenuGroupMeta {
  name: string;
  displayName: string | null;
  imageGsls?: string[];
  productDisplayOrder?: string[];
  mirrorCategoryId?: string | null;
  managedBy?: string | null;
  products?: { [id: string]: MenuProductMeta };
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
  requireString('name', input.name);
  return {
    ...baseEntityDefaults(input),
    name: input.name,
    displayName: input.displayName ?? null,
    products: input.products ?? {},
    productDisplayOrder: input.productDisplayOrder ?? [],
    parentGroup: input.parentGroup ?? null,
    childGroup: input.childGroup ?? null,
    mirrorCategoryId: input.mirrorCategoryId ?? null,
    managedBy: input.managedBy ?? null,
  };
}

/**
 * Thin name index for the Surfaces root's `menuGroups` map. Deliberately does
 * not project the materialized fields (`managedBy`, `mirrorCategoryId`,
 * `products`, …) — those are written only by
 * `MenuRebuildService.materializeGroups()` into `Menu.groups[id]`. Read the
 * materialized menu, not this map, when you need them.
 */
export function menuGroupMeta(menuGroup: MenuGroup): MenuGroupMeta {
  return {
    name: menuGroup.name,
    displayName: menuGroup.displayName,
  };
}
