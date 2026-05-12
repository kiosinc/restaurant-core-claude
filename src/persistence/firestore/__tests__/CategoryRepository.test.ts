import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCategory } from '../../../domain/catalog/Category';
import { MetadataRegistry } from '../../MetadataRegistry';
import { FirestoreRepository } from '../FirestoreRepository';
import { categoryConverter } from '../converters';
import { createTestCategoryInput } from '../../../domain/__tests__/helpers/CatalogFixtures';
import { mockTransaction, mockDocRef, mockDb } from './helpers/firestoreMocks';

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => mockDb,
  FieldValue: { delete: () => '$$FIELD_DELETE$$' },
}));

function createFullSerializedCategory() {
  const ts = '2024-01-15T10:00:00.000Z';
  return {
    name: 'Entrees',
    products: { 'prod-1': { name: 'Burger', isActive: true, imageUrls: [], imageGsls: [], minPrice: 500, maxPrice: 500, variationCount: 1 } },
    productDisplayOrder: ['prod-1'],
    imageUrls: ['cat.jpg'], imageGsls: ['gs://cat'],
    linkedObjects: { square: { linkedObjectId: 'sq-1' } },
    created: ts, updated: ts, isDeleted: false,
  };
}

describe('CategoryRepository', () => {
  let registry: MetadataRegistry;
  let repo: FirestoreRepository<any>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new MetadataRegistry();
    repo = new FirestoreRepository(categoryConverter, registry);
  });

  it('get() returns Category when exists', async () => {
    mockDocRef.get.mockResolvedValue({
      exists: true, data: () => createFullSerializedCategory(), id: 'cat-1',
    });
    const result = await repo.get('biz-1', 'cat-1');
    expect(result).not.toBeNull();
    expect(result!.Id).toBe('cat-1');
    expect(result!.name).toBe('Entrees');
    expect(result!.products['prod-1'].name).toBe('Burger');
    expect(result!.productDisplayOrder).toEqual(['prod-1']);
  });

  it('get() returns null when missing', async () => {
    mockDocRef.get.mockResolvedValue({ exists: false });
    expect(await repo.get('biz-1', 'missing')).toBeNull();
  });

  it('set() serializes all fields', async () => {
    const category = createCategory({
      ...createTestCategoryInput(),
      Id: 'cat-1', name: 'Entrees',
      products: { 'prod-1': { name: 'Burger', isActive: true, imageUrls: [], imageGsls: [], minPrice: 500, maxPrice: 500, variationCount: 1 } },
      productDisplayOrder: ['prod-1'],
    });
    await repo.set(category, 'biz-1');
    const data = mockTransaction.set.mock.calls[0][1];
    expect(data.name).toBe('Entrees');
    expect(data.productDisplayOrder).toEqual(['prod-1']);
  });

  it('round-trip preserves data', async () => {
    const ts = new Date('2024-06-01T12:00:00Z');
    const original = createCategory({
      ...createTestCategoryInput(),
      Id: 'cat-rt', name: 'Desserts',
      imageUrls: ['dessert.jpg'], imageGsls: ['gs://dessert'],
      created: ts, updated: ts,
    });
    await repo.set(original, 'biz-1');
    const serialized = mockTransaction.set.mock.calls[0][1];
    mockDocRef.get.mockResolvedValue({ exists: true, data: () => serialized, id: 'cat-rt' });
    const restored = await repo.get('biz-1', 'cat-rt');
    expect(restored!.name).toBe(original.name);
    expect(restored!.imageUrls).toEqual(original.imageUrls);
  });

  it('fromFirestore defaults products to {}', async () => {
    const data = createFullSerializedCategory();
    delete (data as any).products;
    mockDocRef.get.mockResolvedValue({ exists: true, data: () => data, id: 'cat-1' });
    const result = await repo.get('biz-1', 'cat-1');
    expect(result!.products).toEqual({});
  });

  it('fromFirestore defaults productDisplayOrder to []', async () => {
    const data = createFullSerializedCategory();
    delete (data as any).productDisplayOrder;
    mockDocRef.get.mockResolvedValue({ exists: true, data: () => data, id: 'cat-1' });
    const result = await repo.get('biz-1', 'cat-1');
    expect(result!.productDisplayOrder).toEqual([]);
  });
});
