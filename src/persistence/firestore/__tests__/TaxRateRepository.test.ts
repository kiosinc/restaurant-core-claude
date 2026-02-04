import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaxRate } from '../../../domain/catalog/TaxRate';
import { MetadataRegistry } from '../../MetadataRegistry';
import { TaxRateRepository } from '../TaxRateRepository';
import { createTestTaxRateProps } from '../../../domain/__tests__/helpers/CatalogFixtures';

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

describe('TaxRateRepository', () => {
  let registry: MetadataRegistry;
  let repo: TaxRateRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new MetadataRegistry();
    repo = new TaxRateRepository(registry);
  });

  it('get() returns TaxRate when exists', async () => {
    const ts = '2024-01-15T10:00:00.000Z';
    mockDocRef.get.mockResolvedValue({
      exists: true,
      data: () => ({
        name: 'State Tax', rate: 0.075, isCalculatedSubTotalPhase: true, isInclusive: false,
        linkedObjects: { square: { linkedObjectId: 'sq-1' } },
        created: ts, updated: ts, isDeleted: false,
      }),
      id: 'tax-1',
    });
    const result = await repo.get('biz-1', 'tax-1');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('State Tax');
    expect(result!.rate).toBe(0.075);
  });

  it('get() returns null when missing', async () => {
    mockDocRef.get.mockResolvedValue({ exists: false });
    expect(await repo.get('biz-1', 'missing')).toBeNull();
  });

  it('set() serializes all fields', async () => {
    const taxRate = new TaxRate(createTestTaxRateProps({ Id: 'tax-1' }));
    await repo.set(taxRate, 'biz-1');
    const data = mockTransaction.set.mock.calls[0][1];
    expect(data.name).toBe('Test Tax');
    expect(data.rate).toBe(0.08);
    expect(data.isCalculatedSubTotalPhase).toBe(true);
    expect(data.isInclusive).toBe(false);
  });

  it('round-trip preserves data', async () => {
    const ts = new Date('2024-06-01T12:00:00Z');
    const original = new TaxRate(createTestTaxRateProps({
      Id: 'tax-rt', name: 'RT Tax', rate: 0.05,
      isCalculatedSubTotalPhase: false, isInclusive: true,
      created: ts, updated: ts,
    }));
    await repo.set(original, 'biz-1');
    const serialized = mockTransaction.set.mock.calls[0][1];
    mockDocRef.get.mockResolvedValue({ exists: true, data: () => serialized, id: 'tax-rt' });
    const restored = await repo.get('biz-1', 'tax-rt');
    expect(restored!.name).toBe(original.name);
    expect(restored!.rate).toBe(original.rate);
    expect(restored!.isInclusive).toBe(original.isInclusive);
  });
});
