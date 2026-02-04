import { DomainEntity, DomainEntityProps } from '../DomainEntity';
import { MetadataProjection } from '../MetadataSpec';
import { LinkedObjectMap } from '../LinkedObjectRef';
import { OptionMeta } from './OptionMeta';
import { LocationInventoryMap } from './InventoryCount';

export interface OptionProps extends DomainEntityProps {
  name: string;
  price: number;
  sku: string | null;
  gtin: string | null;
  imageUrls: string[];
  imageGsls: string[];
  locationPrices: { [locationId: string]: number };
  locationInventory: LocationInventoryMap;
  isActive: boolean;
  linkedObjects: LinkedObjectMap;
}

export class Option extends DomainEntity implements MetadataProjection<OptionMeta> {
  name: string;
  price: number;
  sku: string | null;
  gtin: string | null;
  imageUrls: string[];
  imageGsls: string[];
  locationPrices: { [locationId: string]: number };
  locationInventory: LocationInventoryMap;
  isActive: boolean;
  linkedObjects: LinkedObjectMap;

  constructor(props: OptionProps) {
    super(props);
    this.name = props.name;
    this.price = props.price;
    this.sku = props.sku ?? null;
    this.gtin = props.gtin ?? null;
    this.imageUrls = props.imageUrls ?? [];
    this.imageGsls = props.imageGsls ?? [];
    this.locationPrices = props.locationPrices ?? {};
    this.locationInventory = props.locationInventory ?? {};
    this.isActive = props.isActive;
    this.linkedObjects = props.linkedObjects ?? {};
  }

  metadata(): OptionMeta {
    return {
      name: this.name,
      isActive: this.isActive,
    };
  }
}
