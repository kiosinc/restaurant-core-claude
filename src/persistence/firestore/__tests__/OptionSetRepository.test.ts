import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OptionSet } from '../../../domain/catalog/OptionSet';
import { MetadataRegistry } from '../../MetadataRegistry';
import { OptionSetRepository } from '../OptionSetRepository';
import { createTestOptionSetProps } from '../../../domain/__tests__/helpers/CatalogFixtures';
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

function createFullSerializedOptionSet() {
  const ts = '2024-01-15T10:00:00.000Z';
  return {
    name: 'Size', options: { 'opt-1': { name: 'Small', isActive: true } },
    minSelection: 1, maxSelection: 3, displayOrder: 2, displayTier: 1,
    optionDisplayOrder: ['opt-1'], preselectedOptionIds: ['opt-1'],
    imageUrls: ['os.jpg'], imageGsls: ['gs://os'],
    locationInventory: { 'loc-1': { count: 5, state: 'instock', isAvailable: true } },
    isActive: true, linkedObjects: { square: { linkedObjectId: 'sq-1' } },
    created: ts, updated: ts, isDeleted: false,
  };
}

describe('OptionSetRepository', () => {
  let registry: MetadataRegistry;
  let repo: OptionSetRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new MetadataRegistry();
    repo = new OptionSetRepository(registry);
  });

  it('get() returns OptionSet when exists', async () => {
    mockDocRef.get.mockResolvedValue({
      exists: true, data: () => createFullSerializedOptionSet(), id: 'os-1',
    });
    const result = await repo.get('biz-1', 'os-1');
    expect(result).not.toBeNull();
    expect(result!.Id).toBe('os-1');
    expect(result!.name).toBe('Size');
    expect(result!.options['opt-1'].name).toBe('Small');
    expect(result!.minSelection).toBe(1);
    expect(result!.displayOrder).toBe(2);
  });

  it('get() returns null when missing', async () => {
    mockDocRef.get.mockResolvedValue({ exists: false });
    const result = await repo.get('biz-1', 'missing');
    expect(result).toBeNull();
  });

  it('set() serializes all fields', async () => {
    const os = new OptionSet(createTestOptionSetProps({
      Id: 'os-1', name: 'Size', minSelection: 1, maxSelection: 3,
      displayOrder: 2, displayTier: 1,
    }));
    await repo.set(os, 'biz-1');
    const data = mockTransaction.set.mock.calls[0][1];
    expect(data.name).toBe('Size');
    expect(data.minSelection).toBe(1);
    expect(data.maxSelection).toBe(3);
  });

  it('set() uses locationInventoryToFirestore', async () => {
    const os = new OptionSet(createTestOptionSetProps({
      locationInventory: { 'loc-1': { count: 5, state: InventoryCountState.inStock, isAvailable: true } },
    }));
    await repo.set(os, 'biz-1');
    const data = mockTransaction.set.mock.calls[0][1];
    expect(data.locationInventory['loc-1'].state).toBe('instock');
  });

  it('round-trip preserves data', async () => {
    const ts = new Date('2024-06-01T12:00:00Z');
    const original = new OptionSet(createTestOptionSetProps({
      Id: 'os-rt', name: 'Toppings', minSelection: 0, maxSelection: 5,
      displayOrder: 3, displayTier: 2,
      options: { 'opt-1': { name: 'Cheese', isActive: true } },
      optionDisplayOrder: ['opt-1'], preselectedOptionIds: ['opt-1'],
      created: ts, updated: ts,
    }));
    await repo.set(original, 'biz-1');
    const serialized = mockTransaction.set.mock.calls[0][1];
    mockDocRef.get.mockResolvedValue({ exists: true, data: () => serialized, id: 'os-rt' });
    const restored = await repo.get('biz-1', 'os-rt');
    expect(restored!.name).toBe(original.name);
    expect(restored!.minSelection).toBe(original.minSelection);
    expect(restored!.optionDisplayOrder).toEqual(original.optionDisplayOrder);
  });

  it('fromFirestore defaults optionDisplayOrder to []', async () => {
    const data = createFullSerializedOptionSet();
    delete (data as any).optionDisplayOrder;
    mockDocRef.get.mockResolvedValue({ exists: true, data: () => data, id: 'os-1' });
    const result = await repo.get('biz-1', 'os-1');
    expect(result!.optionDisplayOrder).toEqual([]);
  });

  it('fromFirestore defaults preselectedOptionIds to []', async () => {
    const data = createFullSerializedOptionSet();
    delete (data as any).preselectedOptionIds;
    mockDocRef.get.mockResolvedValue({ exists: true, data: () => data, id: 'os-1' });
    const result = await repo.get('biz-1', 'os-1');
    expect(result!.preselectedOptionIds).toEqual([]);
  });
});
