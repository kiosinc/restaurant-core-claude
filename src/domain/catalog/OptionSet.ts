import { DomainEntity, DomainEntityProps } from '../DomainEntity';
import { MetadataProjection } from '../MetadataSpec';
import { LinkedObjectMap } from '../LinkedObjectRef';
import { OptionSetMeta } from './OptionSetMeta';
import { OptionMeta } from './OptionMeta';
import { LocationInventoryMap } from './InventoryCount';

export interface ProductOptionSetSetting {
  minSelection: number;
  maxSelection: number;
  preSelected: string[];
  isActive: boolean;
}

export interface OptionSetProps extends DomainEntityProps {
  name: string;
  options: { [id: string]: OptionMeta };
  minSelection: number;
  maxSelection: number;
  displayOrder: number;
  displayTier: number;
  optionDisplayOrder: string[];
  preselectedOptionIds: string[];
  imageUrls: string[];
  imageGsls: string[];
  locationInventory: LocationInventoryMap;
  isActive: boolean;
  linkedObjects: LinkedObjectMap;
}

export class OptionSet extends DomainEntity implements MetadataProjection<OptionSetMeta> {
  name: string;
  options: { [id: string]: OptionMeta };
  minSelection: number;
  maxSelection: number;
  displayOrder: number;
  displayTier: number;
  optionDisplayOrder: string[];
  preselectedOptionIds: string[];
  imageUrls: string[];
  imageGsls: string[];
  locationInventory: LocationInventoryMap;
  isActive: boolean;
  linkedObjects: LinkedObjectMap;

  constructor(props: OptionSetProps) {
    super(props);
    this.name = props.name;
    this.options = props.options ?? {};
    this.minSelection = props.minSelection;
    this.maxSelection = props.maxSelection;
    this.displayOrder = props.displayOrder;
    this.displayTier = props.displayTier;
    this.optionDisplayOrder = props.optionDisplayOrder ?? [];
    this.preselectedOptionIds = props.preselectedOptionIds ?? [];
    this.imageUrls = props.imageUrls ?? [];
    this.imageGsls = props.imageGsls ?? [];
    this.locationInventory = props.locationInventory ?? {};
    this.isActive = props.isActive;
    this.linkedObjects = props.linkedObjects ?? {};
  }

  metadata(): OptionSetMeta {
    return {
      name: this.name,
      displayOrder: this.displayOrder,
      displayTier: this.displayTier,
    };
  }
}
