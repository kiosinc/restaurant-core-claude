import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Surfaces } from '../../../domain/roots/Surfaces';
import { MetadataRegistry } from '../../MetadataRegistry';
import { SurfacesRootRepository } from '../SurfacesRootRepository';

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

describe('SurfacesRootRepository', () => {
  let repo: SurfacesRootRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new SurfacesRootRepository(new MetadataRegistry());
  });

  it('get() returns SurfacesRoot when exists', async () => {
    const ts = '2024-01-15T10:00:00.000Z';
    const data = {
      menus: { 'm-1': { name: 'Lunch', displayName: null } },
      menuGroups: { 'mg-1': { name: 'Sides', displayName: null } },
      created: ts, updated: ts, isDeleted: false,
    };
    mockDocRef.get.mockResolvedValue({ exists: true, data: () => data, id: 'surfaces' });
    const result = await repo.get('biz-1', 'surfaces');
    expect(result).not.toBeNull();
    expect(result!.menus['m-1'].name).toBe('Lunch');
    expect(result!.menuGroups['mg-1'].name).toBe('Sides');
  });

  it('set() deep-clones menus and menuGroups', async () => {
    const menus = { 'm-1': { name: 'Dinner', displayName: 'Dinner Menu' } };
    const surfaces = new Surfaces({ Id: 'surfaces', menus, menuGroups: {} });
    await repo.set(surfaces, 'biz-1');
    const data = mockTransaction.set.mock.calls[0][1];
    expect(data.menus).toEqual(menus);
    expect(data.menus).not.toBe(menus);
  });

  it('round-trip preserves data', async () => {
    const ts = new Date('2024-06-01T12:00:00Z');
    const original = new Surfaces({
      Id: 'surfaces',
      menus: { 'm-1': { name: 'Brunch', displayName: null } },
      menuGroups: { 'mg-1': { name: 'Apps', displayName: 'Appetizers' } },
      created: ts, updated: ts,
    });
    await repo.set(original, 'biz-1');
    const serialized = mockTransaction.set.mock.calls[0][1];
    mockDocRef.get.mockResolvedValue({ exists: true, data: () => serialized, id: 'surfaces' });
    const restored = await repo.get('biz-1', 'surfaces');
    expect(restored!.menus).toEqual(original.menus);
    expect(restored!.menuGroups).toEqual(original.menuGroups);
  });
});
