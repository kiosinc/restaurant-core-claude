import { LocationProps } from '../../locations/Location';
import { emptyAddress } from '../../misc/Address';

export function createTestLocationProps(overrides?: Partial<LocationProps>): LocationProps {
  return {
    businessId: 'biz-1',
    name: 'Main Street',
    isActive: true,
    linkedObjects: {},
    address: { ...emptyAddress },
    isPrimary: false,
    dailyOrderCounter: 0,
    formattedAddress: null,
    displayName: null,
    imageUrls: [],
    geoCoordinates: null,
    utcOffset: null,
    businessHours: null,
    phoneNumber: null,
    email: null,
    currency: null,
    isAcceptsMobileOrders: null,
    ...overrides,
  };
}
