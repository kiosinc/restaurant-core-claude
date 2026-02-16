import { LocationInput } from '../../locations/Location';
import { emptyAddress } from '../../misc/Address';

export function createTestLocationInput(overrides?: Partial<LocationInput>): LocationInput {
  return {
    businessId: 'biz-1',
    name: 'Main Street',
    isActive: true,
    linkedObjects: {},
    address: { ...emptyAddress },
    ...overrides,
  };
}
