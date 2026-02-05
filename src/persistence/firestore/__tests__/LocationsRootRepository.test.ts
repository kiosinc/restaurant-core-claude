import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocationsRoot } from '../../../domain/roots/Locations';
import { MetadataRegistry } from '../../MetadataRegistry';
import { LocationsRootRepository } from '../LocationsRootRepository';

const mockTransaction = { set: vi.fn(), update: vi.fn(), delete: vi.fn() };
const mockDocRef = { get: vi.fn(), update: vi.fn(), path: '' };
const mockCollectionRef = {
  doc: vi.fn(() => mockDocRef),
  where: vi.fn(() => ({ get: vi.fn() })),
};

const mockDb = {
  collection: vi.fn(() => mockCollectionRef),
  doc: vi.fn(() => mockDocRef),
  runTransaction: vi.fn(async (fn: (t: any) => Promise<void>) => fn(mockTransaction)),
};

mockCollectionRef.doc.mockReturnValue({
  ...mockDocRef,
  collection: vi.fn(() => mockCollectionRef),
  path: 'mocked/path',
});

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => mockDb,
  FieldValue: { delete: () => '$$FIELD_DELETE$$' },
}));

describe('LocationsRootRepository', () => {
  let repo: LocationsRootRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new LocationsRootRepository(new MetadataRegistry());
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
    const lr = new LocationsRoot({ Id: 'locations', locations });
    await repo.set(lr, 'biz-1');
    const data = mockTransaction.set.mock.calls[0][1];
    expect(data.locations).toEqual(locations);
    expect(data.locations).not.toBe(locations);
  });

  it('round-trip preserves data', async () => {
    const ts = new Date('2024-06-01T12:00:00Z');
    const original = new LocationsRoot({
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
