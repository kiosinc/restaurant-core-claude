import { DomainEntity, DomainEntityProps } from '../DomainEntity';
import { MetadataProjection } from '../MetadataSpec';
import { MenuGroupMeta } from './MenuGroupMeta';
import { ProductMeta } from '../catalog/ProductMeta';

export interface MenuGroupProps extends DomainEntityProps {
  name: string;
  displayName: string | null;
  products: { [id: string]: ProductMeta };
  productDisplayOrder: string[];
  parentGroup: string | null;
  childGroup: string | null;
  mirrorCategoryId: string | null;
}

export class MenuGroup extends DomainEntity implements MetadataProjection<MenuGroupMeta> {
  name: string;
  displayName: string | null;
  products: { [id: string]: ProductMeta };
  productDisplayOrder: string[];
  parentGroup: string | null;
  childGroup: string | null;
  mirrorCategoryId: string | null;

  constructor(props: MenuGroupProps) {
    super(props);
    this.name = props.name;
    this.displayName = props.displayName ?? '';
    this.products = props.products ?? {};
    this.productDisplayOrder = props.productDisplayOrder ?? [];
    this.parentGroup = props.parentGroup ?? null;
    this.childGroup = props.childGroup ?? null;
    this.mirrorCategoryId = props.mirrorCategoryId ?? null;
  }

  metadata(): MenuGroupMeta {
    return {
      name: this.name,
      displayName: this.displayName,
    };
  }
}
