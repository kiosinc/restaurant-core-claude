import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Option } from '../../../domain/catalog/Option';
import { MetadataRegistry } from '../../MetadataRegistry';
import { OptionRepository } from '../OptionRepository';
import { createTestOptionProps, createTestInventoryCount } from '../../../domain/__tests__/helpers/CatalogFixtures';
import { InventoryCountState } from '../../../domain/catalog/InventoryCount';

const mockTransaction = { set: vi.fn(), update: vi.fn(), delete: vi.fn() };
const mockDocRef = { get: vi.fn(), update: vi.fn() };
const mockQuery = { get: vi.fn() };
const mockCollectionRef = {
  doc: vi.fn(() => mockDocRef),
  where: vi.fn(() => mockQuery),
};
const mockDb = {
  runTransaction: vi.fn(async (fn: (t: any) => Promise<void>) => fn(mockTransaction)),
  doc: vi.fn(() => mockDocRef),
};

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => mockDb,
  FieldValue: { delete: () => '$$FIELD_DELETE$$' },
}));

vi.mock('../../../restaurant/roots/Catalog', () => ({
  default: {
    docRef: (_businessId: string) => ({
      collection: (_name: string) => mockCollectionRef,
    }),
  },
}));

function createFullSerializedOption() {
  const ts = '2024-01-15T10:00:00.000Z';
  return {
    name: 'Large', price: 250, sku: 'SKU-001', gtin: 'GTIN-001',
    imageUrls: ['img1.jpg'], imageGsls: ['gs://img1'],
    locationPrices: { 'loc-1': 300 },
    locationInventory: { 'loc-1': { count: 5, state: 'instock', isAvailable: true } },
    isActive: true,
    linkedObjects: { square: { linkedObjectId: 'sq-1' } },
    created: ts, updated: ts, isDeleted: false,
  };
}

describe('OptionRepository', () => {
  let registry: MetadataRegistry;
  let repo: OptionRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new MetadataRegistry();
    repo = new OptionRepository(registry);
  });

  it('get() returns Option when exists', async () => {
    mockDocRef.get.mockResolvedValue({
      exists: true, data: () => createFullSerializedOption(), id: 'opt-1',
    });
    const result = await repo.get('biz-1', 'opt-1');
    expect(result).not.toBeNull();
    expect(result!.Id).toBe('opt-1');
    expect(result!.name).toBe('Large');
    expect(result!.price).toBe(250);
    expect(result!.sku).toBe('SKU-001');
    expect(result!.locationInventory['loc-1'].state).toBe(InventoryCountState.inStock);
  });

  it('get() returns null when missing', async () => {
    mockDocRef.get.mockResolvedValue({ exists: false });
    const result = await repo.get('biz-1', 'missing');
    expect(result).toBeNull();
  });

  it('set() serializes all fields correctly', async () => {
    const ts = new Date('2024-01-15T10:00:00Z');
    const option = new Option(createTestOptionProps({
      Id: 'opt-1', name: 'Large', price: 250, sku: 'SKU-001', gtin: 'GTIN-001',
      imageUrls: ['img1.jpg'], imageGsls: ['gs://img1'],
      locationPrices: { 'loc-1': 300 },
      locationInventory: { 'loc-1': createTestInventoryCount() },
      isActive: true, linkedObjects: { square: { linkedObjectId: 'sq-1' } },
      created: ts, updated: ts,
    }));
    await repo.set(option, 'biz-1');
    const data = mockTransaction.set.mock.calls[0][1];
    expect(data.name).toBe('Large');
    expect(data.price).toBe(250);
    expect(data.sku).toBe('SKU-001');
    expect(data.gtin).toBe('GTIN-001');
    expect(data.isActive).toBe(true);
    expect(data.created).toBe('2024-01-15T10:00:00.000Z');
  });

  it('set() uses locationInventoryToFirestore', async () => {
    const option = new Option(createTestOptionProps({
      locationInventory: { 'loc-1': createTestInventoryCount() },
    }));
    await repo.set(option, 'biz-1');
    const data = mockTransaction.set.mock.calls[0][1];
    expect(data.locationInventory['loc-1'].state).toBe('instock');
  });

  it('set() deep-clones nested objects', async () => {
    const option = new Option(createTestOptionProps({
      linkedObjects: { square: { linkedObjectId: 'sq-1' } },
      locationPrices: { 'loc-1': 300 },
    }));
    await repo.set(option, 'biz-1');
    const data = mockTransaction.set.mock.calls[0][1];
    expect(data.linkedObjects).not.toBe(option.linkedObjects);
    expect(data.locationPrices).not.toBe(option.locationPrices);
    expect(data.linkedObjects.square.linkedObjectId).toBe('sq-1');
  });

  it('set() runs transaction', async () => {
    const option = new Option(createTestOptionProps());
    await repo.set(option, 'biz-1');
    expect(mockDb.runTransaction).toHaveBeenCalledTimes(1);
    expect(mockTransaction.set).toHaveBeenCalledTimes(1);
  });

  it('round-trip preserves data', async () => {
    const ts = new Date('2024-06-01T12:00:00Z');
    const original = new Option(createTestOptionProps({
      Id: 'opt-rt', name: 'Round Trip', price: 999, sku: 'RT-SKU', gtin: 'RT-GTIN',
      imageUrls: ['rt.jpg'], imageGsls: ['gs://rt'],
      locationPrices: { 'loc-1': 1000 },
      locationInventory: { 'loc-1': { count: 5, state: InventoryCountState.inStock, isAvailable: true } },
      isActive: false, linkedObjects: { square: { linkedObjectId: 'sq-rt' } },
      created: ts, updated: ts,
    }));
    await repo.set(original, 'biz-1');
    const serialized = mockTransaction.set.mock.calls[0][1];
    mockDocRef.get.mockResolvedValue({ exists: true, data: () => serialized, id: 'opt-rt' });
    const restored = await repo.get('biz-1', 'opt-rt');
    expect(restored!.Id).toBe(original.Id);
    expect(restored!.name).toBe(original.name);
    expect(restored!.price).toBe(original.price);
    expect(restored!.sku).toBe(original.sku);
    expect(restored!.isActive).toBe(original.isActive);
  });

  it('fromFirestore defaults sku to null', async () => {
    const data = createFullSerializedOption();
    delete (data as any).sku;
    mockDocRef.get.mockResolvedValue({ exists: true, data: () => data, id: 'opt-1' });
    const result = await repo.get('biz-1', 'opt-1');
    expect(result!.sku).toBeNull();
  });

  it('fromFirestore defaults gtin to null', async () => {
    const data = createFullSerializedOption();
    delete (data as any).gtin;
    mockDocRef.get.mockResolvedValue({ exists: true, data: () => data, id: 'opt-1' });
    const result = await repo.get('biz-1', 'opt-1');
    expect(result!.gtin).toBeNull();
  });

  it('findByLinkedObject queries correct field', async () => {
    mockQuery.get.mockResolvedValue({
      docs: [{ data: () => createFullSerializedOption(), id: 'opt-linked' }],
    });
    const result = await repo.findByLinkedObject('biz-1', 'sq-opt-1', 'square');
    expect(mockCollectionRef.where).toHaveBeenCalledWith(
      'linkedObjects.square.linkedObjectId', '==', 'sq-opt-1',
    );
    expect(result).not.toBeNull();
  });
});
