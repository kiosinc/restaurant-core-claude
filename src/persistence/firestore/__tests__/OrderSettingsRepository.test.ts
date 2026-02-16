import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrderSettings, createOrderSettings } from '../../../domain/roots/Orders';
import { MetadataRegistry } from '../../MetadataRegistry';
import { FirestoreRepository } from '../FirestoreRepository';
import { orderSettingsConverter } from '../converters/orderSettingsConverter';
import { mockTransaction, mockDocRef, mockDb } from './helpers/firestoreMocks';

vi.mock('firebase-admin/firestore', () => ({ getFirestore: () => mockDb, FieldValue: { delete: () => '$$FIELD_DELETE$$' } }));

function createFullSerializedOrderSettings() {
  const ts = '2024-01-15T10:00:00.000Z';
  return {
    isSMSStateUpdate: true,
    isLoyaltyAccrue: true,
    isStateAutoNewToInProgress: false,
    gratuityRates: [10, 15, 20],
    isSquareDiscountCodeAPI: false,
    isSquareAutoApplyDiscounts: false,
    isSquareAutoApplyTaxes: true,
    isSquareDiscountCodeAutoEnabled: false,
    isKioskSessionIdleTimerOn: true,
    isFreeOrdersEnabled: true,
    isSingleLineItemsOnly: false,
    ticketHeaderFormat: null,
    smsReadyTextFormat: null,
    smsReceiptTextFormat: null,
    created: ts, updated: ts, isDeleted: false,
  };
}

describe('OrderSettingsRepository', () => {
  let repo: FirestoreRepository<OrderSettings>;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new FirestoreRepository<OrderSettings>(orderSettingsConverter, new MetadataRegistry());
  });

  it('get() returns OrderSettings when exists', async () => {
    mockDocRef.get.mockResolvedValue({
      exists: true, data: () => createFullSerializedOrderSettings(), id: 'orders',
    });
    const result = await repo.get('biz-1', 'orders');
    expect(result).not.toBeNull();
    expect(result!.Id).toBe('orders');
    expect(result!.isSMSStateUpdate).toBe(true);
    expect(result!.gratuityRates).toEqual([10, 15, 20]);
    expect(result!.isSquareAutoApplyTaxes).toBe(true);
  });

  it('set() serializes all fields', async () => {
    const os = createOrderSettings({
      Id: 'orders',
      isSMSStateUpdate: true,
      isLoyaltyAccrue: false,
      isStateAutoNewToInProgress: false,
      gratuityRates: [5, 10],
      isSquareDiscountCodeAPI: false,
      isSquareAutoApplyDiscounts: false,
      isSquareAutoApplyTaxes: true,
      isSquareDiscountCodeAutoEnabled: false,
      isKioskSessionIdleTimerOn: true,
      isFreeOrdersEnabled: true,
      isSingleLineItemsOnly: false,
      ticketHeaderFormat: { dineIn: 'Header' },
      smsReadyTextFormat: null,
      smsReceiptTextFormat: null,
    });
    await repo.set(os, 'biz-1');
    const data = mockTransaction.set.mock.calls[0][1];
    expect(data.isSMSStateUpdate).toBe(true);
    expect(data.gratuityRates).toEqual([5, 10]);
    expect(data.ticketHeaderFormat).toEqual({ dineIn: 'Header' });
  });

  it('fromFirestore applies defaults for missing fields', async () => {
    const ts = '2024-01-15T10:00:00.000Z';
    const sparse = { isSMSStateUpdate: true, created: ts, updated: ts, isDeleted: false };
    mockDocRef.get.mockResolvedValue({ exists: true, data: () => sparse, id: 'orders' });
    const result = await repo.get('biz-1', 'orders');
    expect(result!.isLoyaltyAccrue).toBe(true);
    expect(result!.isStateAutoNewToInProgress).toBe(false);
    expect(result!.ticketHeaderFormat).toBeNull();
  });

  it('round-trip preserves data', async () => {
    const ts = new Date('2024-06-01T12:00:00Z');
    const original = createOrderSettings({
      Id: 'orders',
      isSMSStateUpdate: false,
      isLoyaltyAccrue: true,
      isStateAutoNewToInProgress: true,
      gratuityRates: [18, 20, 25],
      isSquareDiscountCodeAPI: true,
      isSquareAutoApplyDiscounts: true,
      isSquareAutoApplyTaxes: false,
      isSquareDiscountCodeAutoEnabled: true,
      isKioskSessionIdleTimerOn: false,
      isFreeOrdersEnabled: false,
      isSingleLineItemsOnly: true,
      ticketHeaderFormat: { pickup: 'PU' },
      smsReadyTextFormat: { pickup: 'Ready' },
      smsReceiptTextFormat: { delivery: 'Done' },
      created: ts, updated: ts,
    });
    await repo.set(original, 'biz-1');
    const serialized = mockTransaction.set.mock.calls[0][1];
    mockDocRef.get.mockResolvedValue({ exists: true, data: () => serialized, id: 'orders' });
    const restored = await repo.get('biz-1', 'orders');
    expect(restored!.isSMSStateUpdate).toBe(original.isSMSStateUpdate);
    expect(restored!.gratuityRates).toEqual(original.gratuityRates);
    expect(restored!.ticketHeaderFormat).toEqual(original.ticketHeaderFormat);
  });
});
