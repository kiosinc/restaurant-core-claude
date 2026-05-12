import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createProduct } from '../../../domain/catalog/Product';
import { MetadataRegistry } from '../../MetadataRegistry';
import { FirestoreRepository } from '../FirestoreRepository';
import { productConverter } from '../converters';
import { createTestProductInput } from '../../../domain/__tests__/helpers/CatalogFixtures';
import { mockTransaction, mockDocRef, mockDb } from './helpers/firestoreMocks';

vi.mock('firebase-admin/firestore', () => ({ getFirestore: () => mockDb, FieldValue: { delete: () => '$$FIELD_DELETE$$' } }));

function createFullSerializedProduct() {
  const ts = '2024-01-15T10:00:00.000Z';
  return {
    name: 'Burger', caption: 'Delicious', description: 'A great burger',
    imageUrls: ['burger.jpg'], imageGsls: ['gs://burger'],
    optionSets: { 'os-1': { name: 'Size', displayOrder: 0, displayTier: 0 } },
    optionSetsSelection: { 'os-1': { minSelection: 1, maxSelection: 1, preSelected: [], isActive: true } },
    minPrice: 500, maxPrice: 800, variationCount: 3,
    locationInventory: { 'loc-1': { count: 5, state: 'instock', isAvailable: true } },
    isActive: true, linkedObjects: { square: { linkedObjectId: 'sq-1' } },
    created: ts, updated: ts, isDeleted: false,
  };
}

describe('ProductRepository', () => {
  let registry: MetadataRegistry;
  let repo: FirestoreRepository<any>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new MetadataRegistry();
    repo = new FirestoreRepository(productConverter, registry);
  });

  it('get() returns Product when exists', async () => {
    mockDocRef.get.mockResolvedValue({
      exists: true, data: () => createFullSerializedProduct(), id: 'prod-1',
    });
    const result = await repo.get('biz-1', 'prod-1');
    expect(result).not.toBeNull();
    expect(result!.Id).toBe('prod-1');
    expect(result!.name).toBe('Burger');
    expect(result!.optionSets['os-1'].name).toBe('Size');
  });

  it('get() returns null when missing', async () => {
    mockDocRef.get.mockResolvedValue({ exists: false });
    expect(await repo.get('biz-1', 'missing')).toBeNull();
  });

  it('set() serializes all fields', async () => {
    const product = createProduct(createTestProductInput({
      Id: 'prod-1', name: 'Burger', caption: 'Tasty', description: 'Good',
      minPrice: 500, maxPrice: 800, variationCount: 3,
    }));
    await repo.set(product, 'biz-1');
    const data = mockTransaction.set.mock.calls[0][1];
    expect(data.name).toBe('Burger');
    expect(data.caption).toBe('Tasty');
    expect(data.minPrice).toBe(500);
  });

  it('set() deep-clones optionSets and optionSetsSelection', async () => {
    const product = createProduct(createTestProductInput({
      optionSets: { 'os-1': { name: 'Size', displayOrder: 0, displayTier: 0 } },
      optionSetsSelection: { 'os-1': { minSelection: 1, maxSelection: 1, preSelected: [], isActive: true } },
    }));
    await repo.set(product, 'biz-1');
    const data = mockTransaction.set.mock.calls[0][1];
    expect(data.optionSets).not.toBe(product.optionSets);
    expect(data.optionSetsSelection).not.toBe(product.optionSetsSelection);
    expect(data.optionSets['os-1'].name).toBe('Size');
  });

  it('round-trip preserves data', async () => {
    const ts = new Date('2024-06-01T12:00:00Z');
    const original = createProduct(createTestProductInput({
      Id: 'prod-rt', name: 'Pizza', caption: 'Hot', description: 'Fresh',
      minPrice: 1000, maxPrice: 1500, variationCount: 2,
      imageUrls: ['pizza.jpg'], created: ts, updated: ts,
    }));
    await repo.set(original, 'biz-1');
    const serialized = mockTransaction.set.mock.calls[0][1];
    mockDocRef.get.mockResolvedValue({ exists: true, data: () => serialized, id: 'prod-rt' });
    const restored = await repo.get('biz-1', 'prod-rt');
    expect(restored!.name).toBe(original.name);
    expect(restored!.caption).toBe(original.caption);
    expect(restored!.minPrice).toBe(original.minPrice);
  });

  it('fromFirestore defaults caption to empty string', async () => {
    const data = createFullSerializedProduct();
    delete (data as any).caption;
    mockDocRef.get.mockResolvedValue({ exists: true, data: () => data, id: 'prod-1' });
    const result = await repo.get('biz-1', 'prod-1');
    expect(result!.caption).toBe('');
  });

  it('fromFirestore defaults description to empty string', async () => {
    const data = createFullSerializedProduct();
    delete (data as any).description;
    mockDocRef.get.mockResolvedValue({ exists: true, data: () => data, id: 'prod-1' });
    const result = await repo.get('biz-1', 'prod-1');
    expect(result!.description).toBe('');
  });
});
