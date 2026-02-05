import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Location } from '../../../domain/locations/Location';
import { MetadataRegistry } from '../../MetadataRegistry';
import { LocationRepository } from '../LocationRepository';
import { LocationMetadataSpec } from '../LocationMetadataSpec';
import { createTestLocationProps } from '../../../domain/__tests__/helpers/LocationFixtures';

// Mock firebase-admin/firestore
const mockTransaction = { set: vi.fn(), update: vi.fn(), delete: vi.fn() };
const mockDocRef = { get: vi.fn(), update: vi.fn(), path: 'businesses/biz-1/public/locations' };
const mockQuery = { get: vi.fn() };
const mockCollectionRef = {
  doc: vi.fn(() => mockDocRef),
  where: vi.fn(() => mockQuery),
};

const mockDb = {
  collection: vi.fn(() => mockCollectionRef),
  doc: vi.fn(() => mockDocRef),
  runTransaction: vi.fn(async (fn: (t: any) => Promise<void>) => fn(mockTransaction)),
};

// Make chaining work: collection().doc() returns something with .collection()
mockCollectionRef.doc.mockReturnValue({
  ...mockDocRef,
  collection: vi.fn(() => mockCollectionRef),
  path: 'businesses/biz-1/public/locations',
});

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => mockDb,
  FieldValue: {
    delete: () => '$$FIELD_DELETE$$',
  },
}));

function createFullSerializedLocation() {
  const ts = '2024-01-15T10:00:00.000Z';
  return {
    name: 'Main Street',
    isActive: true,
    linkedObjects: {},
    address: {
      addressLine1: '123 Main St',
      addressLine2: '',
      city: 'Portland',
      state: 'OR',
      zip: '97201',
      country: 'US',
    },
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
    created: ts,
    updated: ts,
    isDeleted: false,
  };
}

describe('LocationRepository', () => {
  let registry: MetadataRegistry;
  let repo: LocationRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new MetadataRegistry();
    repo = new LocationRepository(registry);
  });

  it('get() returns Location when doc exists', async () => {
    const serialized = createFullSerializedLocation();
    mockDocRef.get.mockResolvedValue({
      exists: true,
      data: () => serialized,
      id: 'loc-1',
    });

    const result = await repo.get('biz-1', 'loc-1');
    expect(result).not.toBeNull();
    expect(result!.Id).toBe('loc-1');
    expect(result!.businessId).toBe('biz-1');
    expect(result!.name).toBe('Main Street');
    expect(result!.isActive).toBe(true);
    expect(result!.address.city).toBe('Portland');
  });

  it('get() returns null when doc missing', async () => {
    mockDocRef.get.mockResolvedValue({ exists: false });
    const result = await repo.get('biz-1', 'missing');
    expect(result).toBeNull();
  });

  it('set() serializes all fields correctly', async () => {
    const ts = new Date('2024-01-15T10:00:00Z');
    const location = new Location(createTestLocationProps({
      Id: 'loc-1',
      name: 'Downtown',
      isActive: true,
      isPrimary: true,
      dailyOrderCounter: 42,
      formattedAddress: '123 Main St, Portland',
      displayName: 'Downtown Store',
      phoneNumber: '555-1234',
      email: 'test@example.com',
      currency: 'USD',
      isAcceptsMobileOrders: true,
      created: ts,
      updated: ts,
    }));

    await repo.set(location, 'biz-1');

    expect(mockTransaction.set).toHaveBeenCalledTimes(1);
    const data = mockTransaction.set.mock.calls[0][1];
    expect(data.name).toBe('Downtown');
    expect(data.isActive).toBe(true);
    expect(data.isPrimary).toBe(true);
    expect(data.dailyOrderCounter).toBe(42);
    expect(data.formattedAddress).toBe('123 Main St, Portland');
    expect(data.displayName).toBe('Downtown Store');
    expect(data.phoneNumber).toBe('555-1234');
    expect(data.email).toBe('test@example.com');
    expect(data.currency).toBe('USD');
    expect(data.isAcceptsMobileOrders).toBe(true);
    expect(data.created).toBe('2024-01-15T10:00:00.000Z');
    expect(data.updated).toBe('2024-01-15T10:00:00.000Z');
    expect(data.isDeleted).toBe(false);
  });

  it('set() deep-clones nested objects', async () => {
    const location = new Location(createTestLocationProps({
      linkedObjects: { square: { linkedObjectId: 'sq-1' } },
      address: { addressLine1: '123 Main', addressLine2: '', city: 'Portland', state: 'OR', zip: '97201', country: 'US' },
      geoCoordinates: { geohash: 'abc', lat: 45.5, lng: -122.6 },
      businessHours: { periods: [{ open: { day: 1, time: '0900' }, close: { day: 1, time: '1700' } }] },
    }));

    await repo.set(location, 'biz-1');

    const data = mockTransaction.set.mock.calls[0][1];
    expect(data.linkedObjects).not.toBe(location.linkedObjects);
    expect(data.address).not.toBe(location.address);
    expect(data.geoCoordinates).not.toBe(location.geoCoordinates);
    expect(data.businessHours).not.toBe(location.businessHours);
    // But values should match
    expect(data.linkedObjects.square.linkedObjectId).toBe('sq-1');
    expect(data.address.city).toBe('Portland');
    expect(data.geoCoordinates.lat).toBe(45.5);
  });

  it('set() handles null geoCoordinates and businessHours', async () => {
    const location = new Location(createTestLocationProps());
    await repo.set(location, 'biz-1');

    const data = mockTransaction.set.mock.calls[0][1];
    expect(data.geoCoordinates).toBeNull();
    expect(data.businessHours).toBeNull();
  });

  it('set() runs transaction with metadata when spec registered', async () => {
    const spec = new LocationMetadataSpec();
    registry.register(Location, spec);

    const location = new Location(createTestLocationProps({
      Id: 'loc-1',
      name: 'Test',
      isActive: true,
    }));

    await repo.set(location, 'biz-1');

    expect(mockDb.runTransaction).toHaveBeenCalledTimes(1);
    expect(mockTransaction.set).toHaveBeenCalledTimes(1);
    // Metadata should be written to the meta link
    expect(mockTransaction.update).toHaveBeenCalledTimes(1);
    const updateArgs = mockTransaction.update.mock.calls[0];
    expect(updateArgs[1]).toEqual({
      'locations.loc-1': { name: 'Test', isActive: true },
    });
  });

  it('set() runs transaction without metadata when no spec', async () => {
    const location = new Location(createTestLocationProps());
    await repo.set(location, 'biz-1');

    expect(mockDb.runTransaction).toHaveBeenCalledTimes(1);
    expect(mockTransaction.set).toHaveBeenCalledTimes(1);
    expect(mockTransaction.update).not.toHaveBeenCalled();
  });

  it('round-trip: toFirestore -> fromFirestore preserves data', async () => {
    const ts = new Date('2024-06-01T12:00:00Z');
    const original = new Location(createTestLocationProps({
      Id: 'loc-rt',
      name: 'Round Trip',
      isActive: false,
      isPrimary: true,
      dailyOrderCounter: 99,
      formattedAddress: '456 Oak Ave',
      displayName: 'RT Store',
      imageUrls: ['img1.jpg', 'img2.jpg'],
      geoCoordinates: { geohash: 'xyz', lat: 40.7, lng: -74.0 },
      utcOffset: -5,
      businessHours: { periods: [{ open: { day: 0, time: '0800' }, close: { day: 0, time: '2200' } }] },
      phoneNumber: '555-9999',
      email: 'rt@example.com',
      currency: 'CAD',
      isAcceptsMobileOrders: false,
      created: ts,
      updated: ts,
    }));

    // Capture toFirestore output via set
    await repo.set(original, 'biz-1');
    const serialized = mockTransaction.set.mock.calls[0][1];

    // Feed it back through get (fromFirestore)
    mockDocRef.get.mockResolvedValue({
      exists: true,
      data: () => serialized,
      id: 'loc-rt',
    });
    const restored = await repo.get('biz-1', 'loc-rt');

    expect(restored!.Id).toBe(original.Id);
    expect(restored!.businessId).toBe('biz-1');
    expect(restored!.name).toBe(original.name);
    expect(restored!.isActive).toBe(original.isActive);
    expect(restored!.isPrimary).toBe(original.isPrimary);
    expect(restored!.dailyOrderCounter).toBe(original.dailyOrderCounter);
    expect(restored!.formattedAddress).toBe(original.formattedAddress);
    expect(restored!.displayName).toBe(original.displayName);
    expect(restored!.imageUrls).toEqual(original.imageUrls);
    expect(restored!.geoCoordinates).toEqual(original.geoCoordinates);
    expect(restored!.utcOffset).toBe(original.utcOffset);
    expect(restored!.businessHours).toEqual(original.businessHours);
    expect(restored!.phoneNumber).toBe(original.phoneNumber);
    expect(restored!.email).toBe(original.email);
    expect(restored!.currency).toBe(original.currency);
    expect(restored!.isAcceptsMobileOrders).toBe(original.isAcceptsMobileOrders);
    expect(restored!.created.getTime()).toBe(original.created.getTime());
    expect(restored!.updated.getTime()).toBe(original.updated.getTime());
  });

  it('fromFirestore handles missing optional fields', async () => {
    mockDocRef.get.mockResolvedValue({
      exists: true,
      data: () => ({
        name: 'Minimal',
        isActive: true,
        address: { addressLine1: '', addressLine2: '', city: '', state: '', zip: '', country: '' },
        created: '2024-01-01T00:00:00.000Z',
        updated: '2024-01-01T00:00:00.000Z',
        isDeleted: false,
      }),
      id: 'loc-minimal',
    });

    const result = await repo.get('biz-1', 'loc-minimal');
    expect(result!.linkedObjects).toEqual({});
    expect(result!.isPrimary).toBe(false);
    expect(result!.dailyOrderCounter).toBe(0);
    expect(result!.formattedAddress).toBeNull();
    expect(result!.displayName).toBeNull();
    expect(result!.imageUrls).toEqual([]);
    expect(result!.geoCoordinates).toBeNull();
    expect(result!.utcOffset).toBeNull();
    expect(result!.businessHours).toBeNull();
    expect(result!.phoneNumber).toBeNull();
    expect(result!.email).toBeNull();
    expect(result!.currency).toBeNull();
    expect(result!.isAcceptsMobileOrders).toBeNull();
  });

  it('findByLinkedObject() queries correct field path', async () => {
    mockQuery.get.mockResolvedValue({
      docs: [{
        data: () => createFullSerializedLocation(),
        id: 'loc-linked',
      }],
    });

    const result = await repo.findByLinkedObject('biz-1', 'sq-loc-1', 'square');

    expect(mockCollectionRef.where).toHaveBeenCalledWith(
      'linkedObjects.square.linkedObjectId',
      '==',
      'sq-loc-1',
    );
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Main Street');
  });
});
