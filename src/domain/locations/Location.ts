import { BaseEntity, baseEntityDefaults } from '../BaseEntity';
import { requireString, requireNonEmptyString } from '../validation';
import { LinkedObjectMap } from '../LinkedObjectRef';
import { Address } from '../misc/Address';
import { BusinessHours } from '../../utils/schedule';
import { Coordinates } from '../../utils/geo';

export interface LocationMeta {
  name: string;
  isActive: boolean;
}

export interface LocationInput {
  businessId: string;
  name: string;
  isActive: boolean;
  linkedObjects: LinkedObjectMap;
  address: Address;
  isPrimary?: boolean;
  dailyOrderCounter?: number;
  formattedAddress?: string | null;
  displayName?: string | null;
  imageUrls?: string[];
  geoCoordinates?: Coordinates | null;
  utcOffset?: number | null;
  businessHours?: BusinessHours | null;
  phoneNumber?: string | null;
  email?: string | null;
  currency?: string | null;
  isAcceptsMobileOrders?: boolean | null;
}

export interface Location extends BaseEntity {
  readonly businessId: string;
  name: string;
  isActive: boolean;
  linkedObjects: LinkedObjectMap;
  address: Address;
  isPrimary: boolean;
  dailyOrderCounter: number;
  formattedAddress: string | null;
  displayName: string | null;
  imageUrls: string[];
  geoCoordinates: Coordinates | null;
  utcOffset: number | null;
  businessHours: BusinessHours | null;
  phoneNumber: string | null;
  email: string | null;
  currency: string | null;
  isAcceptsMobileOrders: boolean | null;
}

export function createLocation(input: LocationInput & Partial<BaseEntity>): Location {
  requireNonEmptyString('businessId', input.businessId);
  requireString('name', input.name);
  return {
    ...baseEntityDefaults(input),
    businessId: input.businessId,
    name: input.name,
    isActive: input.isActive,
    linkedObjects: input.linkedObjects,
    address: input.address,
    isPrimary: input.isPrimary ?? false,
    dailyOrderCounter: input.dailyOrderCounter ?? 0,
    formattedAddress: input.formattedAddress ?? null,
    displayName: input.displayName ?? null,
    imageUrls: input.imageUrls ?? [],
    geoCoordinates: input.geoCoordinates ?? null,
    utcOffset: input.utcOffset ?? null,
    businessHours: input.businessHours ?? null,
    phoneNumber: input.phoneNumber ?? null,
    email: input.email ?? null,
    currency: input.currency ?? null,
    isAcceptsMobileOrders: input.isAcceptsMobileOrders ?? null,
  };
}

export function locationMeta(location: Location): LocationMeta {
  return {
    name: location.name,
    isActive: location.isActive,
  };
}
