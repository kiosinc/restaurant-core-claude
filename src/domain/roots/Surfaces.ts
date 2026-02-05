import { DomainEntity, DomainEntityProps } from '../DomainEntity';
import { MenuMeta } from '../surfaces/MenuMeta';
import { MenuGroupMeta } from '../surfaces/MenuGroupMeta';

export interface SurfacesProps extends DomainEntityProps {
  menus: { [id: string]: MenuMeta };
  menuGroups: { [id: string]: MenuGroupMeta };
}

export class Surfaces extends DomainEntity {
  menus: { [id: string]: MenuMeta };
  menuGroups: { [id: string]: MenuGroupMeta };

  constructor(props: SurfacesProps) {
    super(props);
    this.menus = props.menus ?? {};
    this.menuGroups = props.menuGroups ?? {};
  }
}
