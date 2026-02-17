import { BaseEntity, baseEntityDefaults } from '../BaseEntity';
import { requireString, requireNonNegativeNumber } from '../validation';
import { LinkedObjectMap } from '../LinkedObjectRef';
import { LocationInventoryMap } from './InventoryCount';

export interface OptionMeta {
  name: string;
  isActive: boolean;
}

export interface OptionInput {
  name: string;
  price: number;
  sku?: string | null;
  gtin?: string | null;
  imageUrls?: string[];
  imageGsls?: string[];
  locationPrices?: { [locationId: string]: number };
  locationInventory?: LocationInventoryMap;
  isActive: boolean;
  linkedObjects?: LinkedObjectMap;
}

export interface Option extends BaseEntity {
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

export function createOption(input: OptionInput & Partial<BaseEntity>): Option {
  requireString('name', input.name);
  requireNonNegativeNumber('price', input.price);
  return {
    ...baseEntityDefaults(input),
    name: input.name,
    price: input.price,
    sku: input.sku ?? null,
    gtin: input.gtin ?? null,
    imageUrls: input.imageUrls ?? [],
    imageGsls: input.imageGsls ?? [],
    locationPrices: input.locationPrices ?? {},
    locationInventory: input.locationInventory ?? {},
    isActive: input.isActive,
    linkedObjects: input.linkedObjects ?? {},
  };
}

export function optionMeta(option: Option): OptionMeta {
  return {
    name: option.name,
    isActive: option.isActive,
  };
}
