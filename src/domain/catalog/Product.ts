import { DomainEntity, DomainEntityProps } from '../DomainEntity';
import { MetadataProjection } from '../MetadataSpec';
import { LinkedObjectMap } from '../LinkedObjectRef';
import { ProductMeta } from './ProductMeta';
import { OptionSetMeta } from './OptionSetMeta';
import { ProductOptionSetSetting } from './OptionSet';
import { LocationInventoryMap } from './InventoryCount';

export interface ProductProps extends DomainEntityProps {
  name: string;
  caption: string;
  description: string;
  imageUrls: string[];
  imageGsls: string[];
  optionSets: { [id: string]: OptionSetMeta };
  optionSetsSelection: { [id: string]: ProductOptionSetSetting };
  minPrice: number;
  maxPrice: number;
  variationCount: number;
  locationInventory: LocationInventoryMap;
  isActive: boolean;
  linkedObjects: LinkedObjectMap;
}

export class Product extends DomainEntity implements MetadataProjection<ProductMeta> {
  name: string;
  caption: string;
  description: string;
  imageUrls: string[];
  imageGsls: string[];
  optionSets: { [id: string]: OptionSetMeta };
  optionSetsSelection: { [id: string]: ProductOptionSetSetting };
  minPrice: number;
  maxPrice: number;
  variationCount: number;
  locationInventory: LocationInventoryMap;
  isActive: boolean;
  linkedObjects: LinkedObjectMap;

  constructor(props: ProductProps) {
    super(props);
    this.name = props.name;
    this.caption = props.caption ?? '';
    this.description = props.description ?? '';
    this.imageUrls = props.imageUrls ?? [];
    this.imageGsls = props.imageGsls ?? [];
    this.optionSets = props.optionSets ?? {};
    this.optionSetsSelection = props.optionSetsSelection ?? {};
    this.minPrice = props.minPrice;
    this.maxPrice = props.maxPrice;
    this.variationCount = props.variationCount;
    this.locationInventory = props.locationInventory ?? {};
    this.isActive = props.isActive;
    this.linkedObjects = props.linkedObjects ?? {};
  }

  metadata(): ProductMeta {
    return {
      name: this.name,
      isActive: this.isActive,
      imageUrls: this.imageUrls,
      imageGsls: this.imageGsls,
      minPrice: this.minPrice,
      maxPrice: this.maxPrice,
      variationCount: this.variationCount,
    };
  }
}
