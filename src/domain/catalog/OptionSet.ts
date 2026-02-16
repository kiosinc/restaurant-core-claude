import { BaseEntity, baseEntityDefaults } from '../BaseEntity';
import { requireNonEmptyString, requireNonNegativeInteger, requireMinLessOrEqual } from '../validation';
import { LinkedObjectMap } from '../LinkedObjectRef';
import { OptionMeta } from './Option';
import { LocationInventoryMap } from './InventoryCount';

export interface OptionSetMeta {
  name: string;
  displayOrder: number;
  displayTier: number;
}

export interface ProductOptionSetSetting {
  minSelection: number;
  maxSelection: number;
  preSelected: string[];
  isActive: boolean;
}

export interface OptionSetInput {
  name: string;
  options?: { [id: string]: OptionMeta };
  minSelection: number;
  maxSelection: number;
  displayOrder: number;
  displayTier: number;
  optionDisplayOrder?: string[];
  preselectedOptionIds?: string[];
  imageUrls?: string[];
  imageGsls?: string[];
  locationInventory?: LocationInventoryMap;
  isActive: boolean;
  linkedObjects?: LinkedObjectMap;
}

export interface OptionSet extends BaseEntity {
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

export function createOptionSet(input: OptionSetInput & Partial<BaseEntity>): OptionSet {
  requireNonEmptyString('name', input.name);
  requireNonNegativeInteger('minSelection', input.minSelection);
  requireNonNegativeInteger('maxSelection', input.maxSelection);
  requireMinLessOrEqual('minSelection', input.minSelection, 'maxSelection', input.maxSelection);
  requireNonNegativeInteger('displayOrder', input.displayOrder);
  requireNonNegativeInteger('displayTier', input.displayTier);
  return {
    ...baseEntityDefaults(input),
    name: input.name,
    options: input.options ?? {},
    minSelection: input.minSelection,
    maxSelection: input.maxSelection,
    displayOrder: input.displayOrder,
    displayTier: input.displayTier,
    optionDisplayOrder: input.optionDisplayOrder ?? [],
    preselectedOptionIds: input.preselectedOptionIds ?? [],
    imageUrls: input.imageUrls ?? [],
    imageGsls: input.imageGsls ?? [],
    locationInventory: input.locationInventory ?? {},
    isActive: input.isActive,
    linkedObjects: input.linkedObjects ?? {},
  };
}

export function optionSetMeta(optionSet: OptionSet): OptionSetMeta {
  return {
    name: optionSet.name,
    displayOrder: optionSet.displayOrder,
    displayTier: optionSet.displayTier,
  };
}
