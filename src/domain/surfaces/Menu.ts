import { BaseEntity, baseEntityDefaults } from '../BaseEntity';
import { requireString } from '../validation';
import { MenuGroupMeta } from './MenuGroup';

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
  managedBy?: string | null;
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
  managedBy: string | null;
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
    managedBy: input.managedBy ?? null,
  };
}

export function menuMeta(menu: Menu): MenuMeta {
  return {
    name: menu.name,
    displayName: menu.displayName,
  };
}
