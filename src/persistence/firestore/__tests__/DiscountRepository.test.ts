import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Discount, DiscountType, createDiscount } from '../../../domain/catalog/Discount';
import { MetadataRegistry } from '../../MetadataRegistry';
import { FirestoreRepository } from '../FirestoreRepository';
import { discountConverter } from '../converters';
import { createTestDiscountInput } from '../../../domain/__tests__/helpers/CatalogFixtures';
import { mockTransaction, mockDocRef, mockDb } from './helpers/firestoreMocks';

vi.mock('firebase-admin/firestore', () => ({ getFirestore: () => mockDb, FieldValue: { delete: () => '$$FIELD_DELETE$$' } }));

describe('DiscountRepository', () => {
  let registry: MetadataRegistry;
  let repo: FirestoreRepository<Discount>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new MetadataRegistry();
    repo = new FirestoreRepository<Discount>(discountConverter, registry);
  });

  it('get() returns Discount when exists', async () => {
    const ts = '2024-01-15T10:00:00.000Z';
    mockDocRef.get.mockResolvedValue({
      exists: true,
      data: () => ({
        name: '10% Off', description: 'Holiday', couponCode: 'SAVE10',
        type: 'percentage', value: 10, isActive: true,
        linkedObjects: {}, created: ts, updated: ts, isDeleted: false,
      }),
      id: 'disc-1',
    });
    const result = await repo.get('biz-1', 'disc-1');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('10% Off');
    expect(result!.type).toBe(DiscountType.percentage);
  });

  it('get() returns null when missing', async () => {
    mockDocRef.get.mockResolvedValue({ exists: false });
    expect(await repo.get('biz-1', 'missing')).toBeNull();
  });

  it('set() serializes all fields', async () => {
    const discount = createDiscount({
      ...createTestDiscountInput(),
      Id: 'disc-1', name: '10% Off', description: 'Holiday', couponCode: 'SAVE10',
      type: DiscountType.percentage, value: 10,
    });
    await repo.set(discount, 'biz-1');
    const data = mockTransaction.set.mock.calls[0][1];
    expect(data.name).toBe('10% Off');
    expect(data.type).toBe('percentage');
    expect(data.value).toBe(10);
  });

  it('round-trip preserves data', async () => {
    const ts = new Date('2024-06-01T12:00:00Z');
    const original = createDiscount({
      ...createTestDiscountInput(),
      Id: 'disc-rt', name: '$5 Off', type: DiscountType.amount, value: 500,
      description: 'Test', couponCode: 'FIVE',
      created: ts, updated: ts,
    });
    await repo.set(original, 'biz-1');
    const serialized = mockTransaction.set.mock.calls[0][1];
    mockDocRef.get.mockResolvedValue({ exists: true, data: () => serialized, id: 'disc-rt' });
    const restored = await repo.get('biz-1', 'disc-rt');
    expect(restored!.name).toBe(original.name);
    expect(restored!.type).toBe(original.type);
    expect(restored!.value).toBe(original.value);
  });

  it('fromFirestore casts type as DiscountType', async () => {
    const ts = '2024-01-15T10:00:00.000Z';
    mockDocRef.get.mockResolvedValue({
      exists: true,
      data: () => ({
        name: 'Test', description: '', couponCode: '', type: 'amount', value: 100,
        isActive: true, linkedObjects: {}, created: ts, updated: ts, isDeleted: false,
      }),
      id: 'disc-1',
    });
    const result = await repo.get('biz-1', 'disc-1');
    expect(result!.type).toBe(DiscountType.amount);
  });

  it('fromFirestore defaults description to empty string', async () => {
    const ts = '2024-01-15T10:00:00.000Z';
    mockDocRef.get.mockResolvedValue({
      exists: true,
      data: () => ({
        name: 'Test', couponCode: '', type: 'percentage', value: 10,
        isActive: true, linkedObjects: {}, created: ts, updated: ts, isDeleted: false,
      }),
      id: 'disc-1',
    });
    const result = await repo.get('biz-1', 'disc-1');
    expect(result!.description).toBe('');
  });
});
