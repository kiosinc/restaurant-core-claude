import { TenantEntity, TenantEntityProps } from '../TenantEntity';
import { MetadataProjection } from '../MetadataSpec';
import { LinkedObjectRef, LinkedObjectMap } from '../LinkedObjectRef';
import { Address } from '../misc/Address';
import { BusinessHours } from '../../utils/schedule';
import { Coordinates } from '../../utils/geo';

export interface LocationMeta {
  name: string;
  isActive: boolean;
}

export interface LocationProps extends TenantEntityProps {
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

export class Location extends TenantEntity implements MetadataProjection<LocationMeta> {
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

  constructor(props: LocationProps) {
    super(props);
    this.name = props.name;
    this.isActive = props.isActive;
    this.linkedObjects = props.linkedObjects;
    this.address = props.address;
    this.isPrimary = props.isPrimary ?? false;
    this.dailyOrderCounter = props.dailyOrderCounter ?? 0;
    this.formattedAddress = props.formattedAddress ?? null;
    this.displayName = props.displayName ?? null;
    this.imageUrls = props.imageUrls ?? [];
    this.geoCoordinates = props.geoCoordinates ?? null;
    this.utcOffset = props.utcOffset ?? null;
    this.businessHours = props.businessHours ?? null;
    this.phoneNumber = props.phoneNumber ?? null;
    this.email = props.email ?? null;
    this.currency = props.currency ?? null;
    this.isAcceptsMobileOrders = props.isAcceptsMobileOrders ?? null;
  }

  metadata(): LocationMeta {
    return {
      name: this.name,
      isActive: this.isActive,
    };
  }
}
