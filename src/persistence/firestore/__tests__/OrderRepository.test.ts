import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createOrder } from '../../../domain/orders/Order';
import { OrderState } from '../../../domain/orders/OrderSymbols';
import { MetadataRegistry } from '../../MetadataRegistry';
import { FirestoreRepository } from '../FirestoreRepository';
import { orderConverter } from '../converters/orderConverter';
import {
  createTestOrderInput,
  createTestFulfillment,
} from '../../../domain/__tests__/helpers/OrderFixtures';
import { mockTransaction, mockDocRef, mockQuery, mockCollectionRef, mockDb } from './helpers/firestoreMocks';

vi.mock('firebase-admin/firestore', () => ({ getFirestore: () => mockDb, FieldValue: { delete: () => '$$FIELD_DELETE$$' } }));

function createFullSerializedOrder() {
  const ts = '2024-01-15T10:00:00.000Z';
  return {
    businessId: 'biz-1',
    locationId: 'loc-1',
    menuId: 'menu-1',
    timestamp: ts,
    channel: 'kiosk',
    agent: 'mobile-app',
    deviceId: null,
    posProvider: 'system',
    totalAmount: 1099,
    totalDiscountAmount: 0,
    totalTaxAmount: 100,
    totalSurchargeAmount: 0,
    totalTipAmount: 0,
    customerId: null,
    fulfillment: {
      type: 'toGo',
      typeMetaData: null,
      scheduledTime: null,
      contact: null,
      displayId: null,
    },
    lineItems: [],
    currency: 'USD',
    taxes: [],
    discounts: [],
    surcharges: [],
    note: null,
    payment: null,
    linkedObjects: null,
    state: 'new',
    referralCode: null,
    source: null,
    tags: null,
    version: '3',
    isAvailable: true,
    created: ts,
    updated: ts,
    isDeleted: false,
  };
}

describe('OrderRepository', () => {
  let registry: MetadataRegistry;
  let repo: FirestoreRepository<any>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new MetadataRegistry();
    repo = new FirestoreRepository(orderConverter, registry);
  });

  it('get() returns Order when doc exists', async () => {
    const serialized = createFullSerializedOrder();
    mockDocRef.get.mockResolvedValue({
      exists: true,
      data: () => serialized,
      id: 'order-1',
    });

    const result = await repo.get('biz-1', 'order-1');
    expect(result).not.toBeNull();
    expect(result!.Id).toBe('order-1');
    expect(result!.businessId).toBe('biz-1');
    expect(result!.locationId).toBe('loc-1');
    expect(result!.totalAmount).toBe(1099);
    expect(result!.state).toBe('new');
    expect(result!.version).toBe('3');
  });

  it('get() returns null when doc missing', async () => {
    mockDocRef.get.mockResolvedValue({ exists: false });
    const result = await repo.get('biz-1', 'missing');
    expect(result).toBeNull();
  });

  it('set() serializes all fields correctly', async () => {
    const ts = new Date('2024-01-15T10:00:00Z');
    const order = createOrder(createTestOrderInput({
      Id: 'order-1',
      timestamp: ts,
      created: ts,
      updated: ts,
    }));

    await repo.set(order, 'biz-1');

    expect(mockTransaction.set).toHaveBeenCalledTimes(1);
    const data = mockTransaction.set.mock.calls[0][1];
    expect(data.businessId).toBe('biz-1');
    expect(data.locationId).toBe('loc-1');
    expect(data.timestamp).toBe('2024-01-15T10:00:00.000Z');
    expect(data.created).toBe('2024-01-15T10:00:00.000Z');
    expect(data.state).toBe('new');
    expect(data.version).toBe('3');
    expect(data.isAvailable).toBe(true);
  });

  it('set() deep-clones nested objects', async () => {
    const fulfillment = createTestFulfillment({
      contact: { phoneNumber: '555', email: null, name: null },
    });
    const order = createOrder(createTestOrderInput({
      fulfillment,
      lineItems: [
        {
          Id: 'li-1',
          item: { productId: 'p-1', productName: 'Burger', optionSetsSelected: [], price: 999 },
          quantity: 1,
          taxes: [{ Id: 't-1', name: 'Tax', value: 80 }],
          discounts: [],
          surcharges: [],
          note: null,
        },
      ],
    }));

    await repo.set(order, 'biz-1');

    const data = mockTransaction.set.mock.calls[0][1];
    // Deep-cloned objects should not be the same reference
    expect(data.fulfillment).not.toBe(order.fulfillment);
    expect(data.lineItems).not.toBe(order.lineItems);
    // But should have same values
    expect(data.fulfillment.contact.phoneNumber).toBe('555');
    expect(data.lineItems[0].item.productName).toBe('Burger');
  });

  it('set() handles null deviceId', async () => {
    const order = createOrder(createTestOrderInput({ deviceId: null }));
    await repo.set(order, 'biz-1');

    const data = mockTransaction.set.mock.calls[0][1];
    expect(data.deviceId).toBeNull();
  });

  it('set() defaults totalTipAmount to 0', async () => {
    const order = createOrder(createTestOrderInput({ totalTipAmount: 0 }));
    await repo.set(order, 'biz-1');

    const data = mockTransaction.set.mock.calls[0][1];
    expect(data.totalTipAmount).toBe(0);
  });

  it('set() runs transaction (no metadata)', async () => {
    const order = createOrder(createTestOrderInput());
    await repo.set(order, 'biz-1');

    expect(mockDb.runTransaction).toHaveBeenCalledTimes(1);
    expect(mockTransaction.set).toHaveBeenCalledTimes(1);
    expect(mockTransaction.update).not.toHaveBeenCalled();
  });

  it('round-trip: toFirestore -> fromFirestore preserves data', async () => {
    const ts = new Date('2024-06-01T12:00:00Z');
    const original = createOrder(createTestOrderInput({
      Id: 'order-rt',
      timestamp: ts,
      created: ts,
      updated: ts,
      posProvider: 'square',
      state: OrderState.inProgress,
      tags: ['vip', 'online'],
      referralCode: 'REF123',
      source: 'web',
    }));

    // Capture toFirestore output via set
    await repo.set(original, 'biz-1');
    const serialized = mockTransaction.set.mock.calls[0][1];

    // Feed it back through get (fromFirestore)
    mockDocRef.get.mockResolvedValue({
      exists: true,
      data: () => serialized,
      id: 'order-rt',
    });
    const restored = await repo.get('biz-1', 'order-rt');

    expect(restored!.Id).toBe(original.Id);
    expect(restored!.businessId).toBe(original.businessId);
    expect(restored!.posProvider).toBe(original.posProvider);
    expect(restored!.state).toBe(original.state);
    expect(restored!.tags).toEqual(original.tags);
    expect(restored!.referralCode).toBe(original.referralCode);
    expect(restored!.source).toBe(original.source);
    expect(restored!.timestamp.getTime()).toBe(original.timestamp.getTime());
  });

  it('fromFirestore handles null referralCode', async () => {
    const serialized = createFullSerializedOrder();
    delete (serialized as any).referralCode;
    mockDocRef.get.mockResolvedValue({
      exists: true,
      data: () => serialized,
      id: 'order-1',
    });

    const result = await repo.get('biz-1', 'order-1');
    expect(result!.referralCode).toBeNull();
  });

  it('fromFirestore handles null source', async () => {
    const serialized = createFullSerializedOrder();
    delete (serialized as any).source;
    mockDocRef.get.mockResolvedValue({
      exists: true,
      data: () => serialized,
      id: 'order-1',
    });

    const result = await repo.get('biz-1', 'order-1');
    expect(result!.source).toBeNull();
  });

  it('fromFirestore handles null tags', async () => {
    const serialized = createFullSerializedOrder();
    delete (serialized as any).tags;
    mockDocRef.get.mockResolvedValue({
      exists: true,
      data: () => serialized,
      id: 'order-1',
    });

    const result = await repo.get('biz-1', 'order-1');
    expect(result!.tags).toBeNull();
  });

  it('fromFirestore handles missing totalTipAmount', async () => {
    const serialized = createFullSerializedOrder();
    delete (serialized as any).totalTipAmount;
    mockDocRef.get.mockResolvedValue({
      exists: true,
      data: () => serialized,
      id: 'order-1',
    });

    const result = await repo.get('biz-1', 'order-1');
    expect(result!.totalTipAmount).toBe(0);
  });

  it('findByLinkedObject() queries correct field path', async () => {
    mockQuery.get.mockResolvedValue({
      docs: [{
        data: () => createFullSerializedOrder(),
        id: 'order-linked',
      }],
    });

    const result = await repo.findByLinkedObject('biz-1', 'sq-123', 'square');

    expect(mockCollectionRef.where).toHaveBeenCalledWith(
      'linkedObjects.square.linkedObjectId',
      '==',
      'sq-123',
    );
    expect(result).not.toBeNull();
    expect(result!.businessId).toBe('biz-1');
  });
});
