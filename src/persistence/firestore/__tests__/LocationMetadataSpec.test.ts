import { describe, it, expect, vi } from 'vitest';
import { Location } from '../../../domain/locations/Location';
import { LocationMetadataSpec } from '../LocationMetadataSpec';
import { createTestLocationProps } from '../../../domain/__tests__/helpers/LocationFixtures';

// Mock Locations.docRef to avoid real Firestore
vi.mock('../../../restaurant/roots/Locations', () => ({
  default: {
    docRef: (businessId: string) => ({
      path: `businesses/${businessId}/public/locations`,
    }),
  },
}));

describe('LocationMetadataSpec', () => {
  const spec = new LocationMetadataSpec();

  it('getMetadata() returns name and isActive', () => {
    const location = new Location(createTestLocationProps({
      name: 'Downtown',
      isActive: true,
    }));

    const meta = spec.getMetadata(location);
    expect(meta).toEqual({ name: 'Downtown', isActive: true });
  });

  it('getMetadata() reflects inactive location', () => {
    const location = new Location(createTestLocationProps({
      name: 'Closed Branch',
      isActive: false,
    }));

    const meta = spec.getMetadata(location);
    expect(meta).toEqual({ name: 'Closed Branch', isActive: false });
  });

  it('getMetaLinks() returns correct document path and field path', () => {
    const location = new Location(createTestLocationProps({
      Id: 'loc-42',
      businessId: 'biz-1',
    }));

    const links = spec.getMetaLinks(location, 'biz-1');
    expect(links).toHaveLength(1);
    expect(links[0].documentPath).toBe('businesses/biz-1/public/locations');
    expect(links[0].fieldPath).toBe('locations.loc-42');
  });

  it('getMetaLinks() uses provided businessId', () => {
    const location = new Location(createTestLocationProps({ Id: 'loc-1' }));

    const links = spec.getMetaLinks(location, 'biz-other');
    expect(links[0].documentPath).toBe('businesses/biz-other/public/locations');
  });

});
