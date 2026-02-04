import { DomainEntity, DomainEntityProps } from '../DomainEntity';
import { MetadataProjection } from '../MetadataSpec';
import { LinkedObjectMap } from '../LinkedObjectRef';
import { CategoryMeta } from './CategoryMeta';
import { ProductMeta } from './ProductMeta';

export interface CategoryProps extends DomainEntityProps {
  name: string;
  products: { [id: string]: ProductMeta };
  productDisplayOrder: string[];
  imageUrls: string[];
  imageGsls: string[];
  linkedObjects: LinkedObjectMap;
}

export class Category extends DomainEntity implements MetadataProjection<CategoryMeta> {
  name: string;
  products: { [id: string]: ProductMeta };
  productDisplayOrder: string[];
  imageUrls: string[];
  imageGsls: string[];
  linkedObjects: LinkedObjectMap;

  constructor(props: CategoryProps) {
    super(props);
    this.name = props.name;
    this.products = props.products ?? {};
    this.productDisplayOrder = props.productDisplayOrder ?? [];
    this.imageUrls = props.imageUrls ?? [];
    this.imageGsls = props.imageGsls ?? [];
    this.linkedObjects = props.linkedObjects ?? {};
  }

  metadata(): CategoryMeta {
    return {
      name: this.name,
    };
  }
}
