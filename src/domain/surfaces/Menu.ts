import { DomainEntity, DomainEntityProps } from '../DomainEntity';
import { MetadataProjection } from '../MetadataSpec';
import { MenuMeta } from './MenuMeta';
import { MenuGroupMeta } from './MenuGroupMeta';

export interface MenuProps extends DomainEntityProps {
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

export class Menu extends DomainEntity implements MetadataProjection<MenuMeta> {
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

  constructor(props: MenuProps) {
    super(props);
    this.name = props.name;
    this.displayName = props.displayName ?? null;
    this.groups = props.groups ?? {};
    this.groupDisplayOrder = props.groupDisplayOrder ?? [];
    this.coverImageGsl = props.coverImageGsl ?? null;
    this.coverBackgroundImageGsl = props.coverBackgroundImageGsl ?? null;
    this.coverVideoGsl = props.coverVideoGsl ?? null;
    this.logoImageGsl = props.logoImageGsl ?? null;
    this.gratuityRates = props.gratuityRates ?? [];
    this.managedBy = props.managedBy ?? null;
  }

  metadata(): MenuMeta {
    return {
      name: this.name,
      displayName: this.displayName,
    };
  }
}
