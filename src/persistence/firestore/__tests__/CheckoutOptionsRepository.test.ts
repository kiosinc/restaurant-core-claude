import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CheckoutOptions, createCheckoutOptions } from '../../../domain/surfaces/CheckoutOptions';
import { MetadataRegistry } from '../../MetadataRegistry';
import { FirestoreRepository } from '../FirestoreRepository';
import { checkoutOptionsConverter } from '../converters';
import { createTestCheckoutOptionsInput } from '../../../domain/__tests__/helpers/SurfacesFixtures';
import { mockTransaction, mockDocRef, mockDb } from './helpers/firestoreMocks';

vi.mock('firebase-admin/firestore', () => ({ getFirestore: () => mockDb, FieldValue: { delete: () => '$$FIELD_DELETE$$' } }));

function createFullSerializedCheckoutOptions() {
  const ts = '2024-01-15T10:00:00.000Z';
  return {
    name: 'Default Checkout',
    discounts: { isEnabled: true },
    giftCards: { isEnabled: false },
    referralCodes: { isEnabled: false },
    tipOptions: { isEnabled: true, isSmartTipEnabled: false, tipAmounts: [15, 18, 20], preselectedIdx: 1 },
    fulfillmentOptions: {
      toGo: {
        isEnabled: true,
        scheduleOptions: { isEnabled: false },
        contactOptions: { isEnabled: true },
        manualIdOptions: { isEnabled: false },
        options: [],
      },
    },
    created: ts, updated: ts, isDeleted: false,
  };
}

describe('CheckoutOptionsRepository', () => {
  let registry: MetadataRegistry;
  let repo: FirestoreRepository<CheckoutOptions>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new MetadataRegistry();
    repo = new FirestoreRepository<CheckoutOptions>(checkoutOptionsConverter, registry);
  });

  it('get() returns CheckoutOptions when exists', async () => {
    mockDocRef.get.mockResolvedValue({
      exists: true, data: () => createFullSerializedCheckoutOptions(), id: 'co-1',
    });
    const result = await repo.get('biz-1', 'co-1');
    expect(result).not.toBeNull();
    expect(result!.Id).toBe('co-1');
    expect(result!.name).toBe('Default Checkout');
    expect(result!.tipOptions!.tipAmounts).toEqual([15, 18, 20]);
  });

  it('get() returns null when missing', async () => {
    mockDocRef.get.mockResolvedValue({ exists: false });
    expect(await repo.get('biz-1', 'missing')).toBeNull();
  });

  it('set() deep-clones fulfillmentOptions', async () => {
    const co = createCheckoutOptions(createTestCheckoutOptionsInput({
      fulfillmentOptions: {
        toGo: {
          isEnabled: true,
          scheduleOptions: { isEnabled: false },
          contactOptions: { isEnabled: false },
          manualIdOptions: { isEnabled: false },
          options: [],
        },
      },
    }));
    await repo.set(co, 'biz-1');
    const data = mockTransaction.set.mock.calls[0][1];
    expect(data.fulfillmentOptions).not.toBe(co.fulfillmentOptions);
    expect(data.fulfillmentOptions.toGo.isEnabled).toBe(true);
  });

  it('round-trip preserves data', async () => {
    const ts = new Date('2024-06-01T12:00:00Z');
    const original = createCheckoutOptions(createTestCheckoutOptionsInput({
      Id: 'co-rt', name: 'Custom Checkout',
      discounts: { isEnabled: true },
      tipOptions: { isEnabled: true, isSmartTipEnabled: true, tipAmounts: [10, 20], preselectedIdx: 0 },
      created: ts, updated: ts,
    }));
    await repo.set(original, 'biz-1');
    const serialized = mockTransaction.set.mock.calls[0][1];
    mockDocRef.get.mockResolvedValue({ exists: true, data: () => serialized, id: 'co-rt' });
    const restored = await repo.get('biz-1', 'co-rt');
    expect(restored!.name).toBe(original.name);
    expect(restored!.discounts.isEnabled).toBe(original.discounts.isEnabled);
    expect(restored!.tipOptions!.tipAmounts).toEqual(original.tipOptions!.tipAmounts);
  });

  it('fromFirestore defaults tipOptions to null', async () => {
    const data = createFullSerializedCheckoutOptions();
    delete (data as any).tipOptions;
    mockDocRef.get.mockResolvedValue({ exists: true, data: () => data, id: 'co-1' });
    const result = await repo.get('biz-1', 'co-1');
    expect(result!.tipOptions).toBeNull();
  });
});
