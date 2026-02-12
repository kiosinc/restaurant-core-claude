import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MenuGroup } from '../../../domain/surfaces/MenuGroup';
import { MetadataRegistry } from '../../MetadataRegistry';
import { MenuGroupRepository } from '../MenuGroupRepository';
import { createTestMenuGroupProps } from '../../../domain/__tests__/helpers/SurfacesFixtures';

const mockTransaction = { set: vi.fn(), update: vi.fn(), delete: vi.fn() };
const mockDocRef = { get: vi.fn(), update: vi.fn(), path: '' };
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
  path: 'mocked/path',
});

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => mockDb,
  FieldValue: { delete: () => '$$FIELD_DELETE$$' },
}));

function createFullSerializedMenuGroup() {
  const ts = '2024-01-15T10:00:00.000Z';
  return {
    name: 'Appetizers',
    products: { 'prod-1': { name: 'Fries', isActive: true, imageUrls: [], imageGsls: [], minPrice: 500, maxPrice: 500, variationCount: 1 } },
    productDisplayOrder: ['prod-1'],
    displayName: 'Starters',
    parentGroup: null, childGroup: null, mirrorCategoryId: null,
    managedBy: null,
    created: ts, updated: ts, isDeleted: false,
  };
}

describe('MenuGroupRepository', () => {
  let registry: MetadataRegistry;
  let repo: MenuGroupRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new MetadataRegistry();
    repo = new MenuGroupRepository(registry);
  });

  it('get() returns MenuGroup when exists', async () => {
    mockDocRef.get.mockResolvedValue({
      exists: true, data: () => createFullSerializedMenuGroup(), id: 'mg-1',
    });
    const result = await repo.get('biz-1', 'mg-1');
    expect(result).not.toBeNull();
    expect(result!.Id).toBe('mg-1');
    expect(result!.name).toBe('Appetizers');
    expect(result!.products['prod-1'].name).toBe('Fries');
  });

  it('get() returns null when missing', async () => {
    mockDocRef.get.mockResolvedValue({ exists: false });
    expect(await repo.get('biz-1', 'missing')).toBeNull();
  });

  it('set() serializes all fields correctly', async () => {
    const mg = new MenuGroup(createTestMenuGroupProps({
      Id: 'mg-1', name: 'Entrees', displayName: 'Main Dishes',
      products: { 'prod-1': { name: 'Burger', isActive: true, imageUrls: [], imageGsls: [], minPrice: 1000, maxPrice: 1000, variationCount: 1 } },
    }));
    await repo.set(mg, 'biz-1');
    const data = mockTransaction.set.mock.calls[0][1];
    expect(data.name).toBe('Entrees');
    expect(data.displayName).toBe('Main Dishes');
    expect(data.products['prod-1'].name).toBe('Burger');
  });

  it('round-trip preserves data', async () => {
    const ts = new Date('2024-06-01T12:00:00Z');
    const original = new MenuGroup(createTestMenuGroupProps({
      Id: 'mg-rt', name: 'Desserts', displayName: 'Sweets',
      parentGroup: 'mg-parent', created: ts, updated: ts,
    }));
    await repo.set(original, 'biz-1');
    const serialized = mockTransaction.set.mock.calls[0][1];
    mockDocRef.get.mockResolvedValue({ exists: true, data: () => serialized, id: 'mg-rt' });
    const restored = await repo.get('biz-1', 'mg-rt');
    expect(restored!.name).toBe(original.name);
    expect(restored!.displayName).toBe(original.displayName);
    expect(restored!.parentGroup).toBe(original.parentGroup);
    expect(restored!.managedBy).toBe(original.managedBy);
  });

  it('fromFirestore defaults products to {}', async () => {
    const data = createFullSerializedMenuGroup();
    delete (data as any).products;
    mockDocRef.get.mockResolvedValue({ exists: true, data: () => data, id: 'mg-1' });
    const result = await repo.get('biz-1', 'mg-1');
    expect(result!.products).toEqual({});
  });

  it('fromFirestore defaults productDisplayOrder to []', async () => {
    const data = createFullSerializedMenuGroup();
    delete (data as any).productDisplayOrder;
    mockDocRef.get.mockResolvedValue({ exists: true, data: () => data, id: 'mg-1' });
    const result = await repo.get('biz-1', 'mg-1');
    expect(result!.productDisplayOrder).toEqual([]);
  });
});
