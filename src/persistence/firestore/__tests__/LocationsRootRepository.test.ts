import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocationsRoot, createLocationsRoot } from '../../../domain/roots/Locations';
import { MetadataRegistry } from '../../MetadataRegistry';
import { FirestoreRepository } from '../FirestoreRepository';
import { locationsRootConverter } from '../converters';
import { mockTransaction, mockDocRef, mockDb } from './helpers/firestoreMocks';

vi.mock('firebase-admin/firestore', () => ({ getFirestore: () => mockDb, FieldValue: { delete: () => '$$FIELD_DELETE$$' } }));

describe('LocationsRootRepository', () => {
  let repo: FirestoreRepository<LocationsRoot>;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new FirestoreRepository<LocationsRoot>(locationsRootConverter, new MetadataRegistry());
  });

  it('get() returns LocationsRoot when exists', async () => {
    const ts = '2024-01-15T10:00:00.000Z';
    const data = {
      locations: { 'loc-1': { name: 'Downtown', isActive: true } },
      created: ts, updated: ts, isDeleted: false,
    };
    mockDocRef.get.mockResolvedValue({ exists: true, data: () => data, id: 'locations' });
    const result = await repo.get('biz-1', 'locations');
    expect(result).not.toBeNull();
    expect(result!.locations['loc-1'].name).toBe('Downtown');
  });

  it('set() deep-clones locations', async () => {
    const locations = { 'loc-1': { name: 'Airport', isActive: true } };
    const lr = createLocationsRoot({ Id: 'locations', locations });
    await repo.set(lr, 'biz-1');
    const data = mockTransaction.set.mock.calls[0][1];
    expect(data.locations).toEqual(locations);
    expect(data.locations).not.toBe(locations);
  });

  it('round-trip preserves data', async () => {
    const ts = new Date('2024-06-01T12:00:00Z');
    const original = createLocationsRoot({
      Id: 'locations',
      locations: { 'loc-1': { name: 'Mall', isActive: false } },
      created: ts, updated: ts,
    });
    await repo.set(original, 'biz-1');
    const serialized = mockTransaction.set.mock.calls[0][1];
    mockDocRef.get.mockResolvedValue({ exists: true, data: () => serialized, id: 'locations' });
    const restored = await repo.get('biz-1', 'locations');
    expect(restored!.locations).toEqual(original.locations);
  });
});
