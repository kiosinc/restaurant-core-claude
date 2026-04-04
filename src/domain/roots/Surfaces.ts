import { BaseEntity, baseEntityDefaults } from '../BaseEntity';
import { MenuMeta } from '../surfaces/Menu';
import { MenuGroupMeta } from '../surfaces/MenuGroup';

export interface Surfaces extends BaseEntity {
  menus: { [id: string]: MenuMeta };
  menuGroups: { [id: string]: MenuGroupMeta };
}

export function createSurfaces(input?: Partial<Surfaces>): Surfaces {
  return {
    ...baseEntityDefaults(input),
    menus: input?.menus ?? {},
    menuGroups: input?.menuGroups ?? {},
  };
}
