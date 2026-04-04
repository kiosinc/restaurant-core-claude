import { describe, it, expect, vi } from 'vitest';
import { createLocation } from '../../../domain/locations/Location';
import { locationMetadataSpec } from '../LocationMetadataSpec';
import { createTestLocationInput } from '../../../domain/__tests__/helpers/LocationFixtures';

// Mock firebase-admin/firestore with proper chain for PathResolver
// PathResolver does: db.collection('businesses').doc(businessId).collection('public').doc('locations')
let capturedBusinessId = '';

const mockLocationsDocRef = {
  get path() {
    return `businesses/${capturedBusinessId}/public/locations`;
  },
};

const mockPublicCollectionRef = {
  doc: vi.fn(() => mockLocationsDocRef),
};

const mockBusinessDocRef = {
  collection: vi.fn(() => mockPublicCollectionRef),
};

const mockBusinessesCollectionRef = {
  doc: vi.fn((businessId: string) => {
    capturedBusinessId = businessId;
    return mockBusinessDocRef;
  }),
};

const mockDb = {
  collection: vi.fn(() => mockBusinessesCollectionRef),
};

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => mockDb,
}));

describe('LocationMetadataSpec', () => {
  const spec = locationMetadataSpec;

  it('getMetadata() returns name and isActive', () => {
    const location = createLocation(createTestLocationInput({
      name: 'Downtown',
      isActive: true,
    }));

    const meta = spec.getMetadata(location);
    expect(meta).toEqual({ name: 'Downtown', isActive: true });
  });

  it('getMetadata() reflects inactive location', () => {
    const location = createLocation(createTestLocationInput({
      name: 'Closed Branch',
      isActive: false,
    }));

    const meta = spec.getMetadata(location);
    expect(meta).toEqual({ name: 'Closed Branch', isActive: false });
  });

  it('getMetaLinks() returns correct document path and field path', () => {
    const location = createLocation(createTestLocationInput({
      Id: 'loc-42',
      businessId: 'biz-1',
    }));

    const links = spec.getMetaLinks(location, 'biz-1');
    expect(links).toHaveLength(1);
    expect(links[0].documentPath).toBe('businesses/biz-1/public/locations');
    expect(links[0].fieldPath).toBe('locations.loc-42');
  });

  it('getMetaLinks() uses provided businessId', () => {
    const location = createLocation(createTestLocationInput({ Id: 'loc-1' }));

    const links = spec.getMetaLinks(location, 'biz-other');
    expect(links[0].documentPath).toBe('businesses/biz-other/public/locations');
  });

});
