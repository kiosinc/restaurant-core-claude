import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServiceCharge, ServiceChargeType, createServiceCharge } from '../../../domain/catalog/ServiceCharge';
import { MetadataRegistry } from '../../MetadataRegistry';
import { FirestoreRepository } from '../FirestoreRepository';
import { serviceChargeConverter } from '../converters/serviceChargeConverter';
import { createTestServiceChargeInput } from '../../../domain/__tests__/helpers/CatalogFixtures';
import { mockTransaction, mockDocRef, mockCollectionRef, mockDb } from './helpers/firestoreMocks';

vi.mock('firebase-admin/firestore', () => ({ getFirestore: () => mockDb, FieldValue: { delete: () => '$$FIELD_DELETE$$' } }));

let lastCollectionName = '';
mockCollectionRef.doc.mockReturnValue({
  ...mockDocRef,
  collection: (name: string) => {
    lastCollectionName = name;
    return mockCollectionRef;
  },
  path: 'mocked/path',
});

describe('ServiceChargeRepository', () => {
  let registry: MetadataRegistry;
  let repo: FirestoreRepository<ServiceCharge>;

  beforeEach(() => {
    vi.clearAllMocks();
    lastCollectionName = '';
    registry = new MetadataRegistry();
    repo = new FirestoreRepository<ServiceCharge>(serviceChargeConverter, registry);
  });

  it('get() returns ServiceCharge when exists', async () => {
    const ts = '2024-01-15T10:00:00.000Z';
    mockDocRef.get.mockResolvedValue({
      exists: true,
      data: () => ({
        name: 'Delivery Fee', value: 500, type: 'number',
        isCalculatedSubTotalPhase: false, isTaxable: true,
        linkedObjects: {}, created: ts, updated: ts, isDeleted: false,
      }),
      id: 'sc-1',
    });
    const result = await repo.get('biz-1', 'sc-1');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Delivery Fee');
    expect(result!.value).toBe(500);
    expect(result!.type).toBe(ServiceChargeType.amount);
  });

  it('get() returns null when missing', async () => {
    mockDocRef.get.mockResolvedValue({ exists: false });
    expect(await repo.get('biz-1', 'missing')).toBeNull();
  });

  it('set() serializes type amount as number for Firestore', async () => {
    const sc = createServiceCharge({
      ...createTestServiceChargeInput(),
      Id: 'sc-1', type: ServiceChargeType.amount,
    });
    await repo.set(sc, 'biz-1');
    const data = mockTransaction.set.mock.calls[0][1];
    expect(data.type).toBe('number');
  });

  it('set() serializes type percentage unchanged', async () => {
    const sc = createServiceCharge({
      ...createTestServiceChargeInput(),
      Id: 'sc-1', type: ServiceChargeType.percentage, value: 15,
    });
    await repo.set(sc, 'biz-1');
    const data = mockTransaction.set.mock.calls[0][1];
    expect(data.type).toBe('percentage');
  });

  it('fromFirestore maps type number to ServiceChargeType.amount', async () => {
    const ts = '2024-01-15T10:00:00.000Z';
    mockDocRef.get.mockResolvedValue({
      exists: true,
      data: () => ({
        name: 'Fee', value: 100, type: 'number',
        isCalculatedSubTotalPhase: false, isTaxable: false,
        linkedObjects: {}, created: ts, updated: ts, isDeleted: false,
      }),
      id: 'sc-1',
    });
    const result = await repo.get('biz-1', 'sc-1');
    expect(result!.type).toBe(ServiceChargeType.amount);
  });

  it('fromFirestore reads value field, falls back to rate', async () => {
    const ts = '2024-01-15T10:00:00.000Z';
    mockDocRef.get.mockResolvedValue({
      exists: true,
      data: () => ({
        name: 'Fee', rate: 250, type: 'number',
        isCalculatedSubTotalPhase: false, isTaxable: false,
        linkedObjects: {}, created: ts, updated: ts, isDeleted: false,
      }),
      id: 'sc-1',
    });
    const result = await repo.get('biz-1', 'sc-1');
    expect(result!.value).toBe(250);
  });

  it('round-trip preserves data', async () => {
    const ts = new Date('2024-06-01T12:00:00Z');
    const original = createServiceCharge({
      ...createTestServiceChargeInput(),
      Id: 'sc-rt', name: 'RT Fee', value: 300, type: ServiceChargeType.percentage,
      isCalculatedSubTotalPhase: true, isTaxable: true,
      created: ts, updated: ts,
    });
    await repo.set(original, 'biz-1');
    const serialized = mockTransaction.set.mock.calls[0][1];
    mockDocRef.get.mockResolvedValue({ exists: true, data: () => serialized, id: 'sc-rt' });
    const restored = await repo.get('biz-1', 'sc-rt');
    expect(restored!.name).toBe(original.name);
    expect(restored!.value).toBe(original.value);
    expect(restored!.type).toBe(original.type);
  });

  it('collectionRef uses serviceCharges not taxRates', async () => {
    const sc = createServiceCharge(createTestServiceChargeInput());
    await repo.set(sc, 'biz-1');
    expect(lastCollectionName).toBe('serviceCharges');
  });
});
