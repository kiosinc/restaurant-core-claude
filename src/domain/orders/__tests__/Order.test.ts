import { describe, it, expect } from 'vitest';
import { createOrder, OrderPayment, LinkedObjectRef } from '../Order';
import { OrderState, OrderType, PaymentState } from '../OrderSymbols';
import {
  createTestOrderInput,
  createTestFulfillment,
} from '../../__tests__/helpers/OrderFixtures';
import { ValidationError } from '../../validation';

describe('Order (domain)', () => {
  it('constructs with all props', () => {
    const now = new Date('2024-01-15T10:00:00Z');
    const fulfillment = createTestFulfillment();
    const order = createOrder(createTestOrderInput({
      Id: 'order-1',
      created: now,
      updated: now,
      timestamp: now,
    }));

    expect(order.Id).toBe('order-1');
    expect(order.businessId).toBe('biz-1');
    expect(order.locationId).toBe('loc-1');
    expect(order.menuId).toBe('menu-1');
    expect(order.channel).toBe('kiosk');
    expect(order.agent).toBe('mobile-app');
    expect(order.posProvider).toBe('system');
    expect(order.totalAmount).toBe(1099);
    expect(order.totalDiscountAmount).toBe(0);
    expect(order.totalTaxAmount).toBe(100);
    expect(order.totalSurchargeAmount).toBe(0);
    expect(order.totalTipAmount).toBe(0);
    expect(order.customerId).toBeNull();
    expect(order.fulfillment).toEqual(fulfillment);
    expect(order.lineItems).toEqual([]);
    expect(order.currency).toBe('USD');
    expect(order.taxes).toEqual([]);
    expect(order.discounts).toEqual([]);
    expect(order.surcharges).toEqual([]);
    expect(order.note).toBeNull();
    expect(order.payment).toBeNull();
    expect(order.linkedObjects).toBeNull();
    expect(order.referralCode).toBeNull();
    expect(order.source).toBeNull();
    expect(order.tags).toBeNull();
  });

  it('uses provided Id', () => {
    const order = createOrder(createTestOrderInput({ Id: 'order-123' }));
    expect(order.Id).toBe('order-123');
  });

  it('defaults state to OrderState.new', () => {
    const order = createOrder(createTestOrderInput());
    expect(order.state).toBe('new');
  });

  it('uses provided state', () => {
    const order = createOrder(createTestOrderInput({ state: OrderState.completed }));
    expect(order.state).toBe('completed');
  });

  it('defaults version to "3"', () => {
    const order = createOrder(createTestOrderInput());
    expect(order.version).toBe('3');
  });

  it('uses provided version', () => {
    const order = createOrder(createTestOrderInput({ version: '2' }));
    expect(order.version).toBe('2');
  });

  it('defaults isAvailable to true', () => {
    const order = createOrder(createTestOrderInput());
    expect(order.isAvailable).toBe(true);
  });

  it('defaults timestamp to now', () => {
    const before = Date.now();
    const order = createOrder(createTestOrderInput());
    const after = Date.now();

    expect(order.timestamp.getTime()).toBeGreaterThanOrEqual(before);
    expect(order.timestamp.getTime()).toBeLessThanOrEqual(after);
  });

  it('uses provided timestamp', () => {
    const ts = new Date('2024-06-01T12:00:00Z');
    const order = createOrder(createTestOrderInput({ timestamp: ts }));
    expect(order.timestamp).toBe(ts);
  });

  it('defaults posProvider to "system"', () => {
    const order = createOrder(createTestOrderInput());
    expect(order.posProvider).toBe('system');
  });

  it('uses provided posProvider', () => {
    const order = createOrder(createTestOrderInput({ posProvider: 'square' }));
    expect(order.posProvider).toBe('square');
  });

  it('nullable fields accept null', () => {
    const order = createOrder(createTestOrderInput());
    expect(order.deviceId).toBeNull();
    expect(order.customerId).toBeNull();
    expect(order.note).toBeNull();
    expect(order.payment).toBeNull();
    expect(order.linkedObjects).toBeNull();
    expect(order.referralCode).toBeNull();
    expect(order.source).toBeNull();
    expect(order.tags).toBeNull();
  });

  it('linkedObjects stores LinkedObjectRef', () => {
    const linked: { [Id: string]: LinkedObjectRef } = {
      square: { linkedObjectId: 'sq-123' },
    };
    const order = createOrder(createTestOrderInput({ linkedObjects: linked }));
    expect(order.linkedObjects!['square'].linkedObjectId).toBe('sq-123');
  });

  it('fulfillment sub-interface works', () => {
    const fulfillment = createTestFulfillment({
      type: OrderType.dineIn,
      typeMetaData: { table: 'A1' },
      scheduledTime: new Date('2024-06-01T18:00:00Z'),
      contact: { phoneNumber: '555-1234', email: 'test@test.com', name: 'John' },
      displayId: 'D-42',
    });
    const order = createOrder(createTestOrderInput({ fulfillment }));

    expect(order.fulfillment.type).toBe(OrderType.dineIn);
    expect(order.fulfillment.typeMetaData!.table).toBe('A1');
    expect(order.fulfillment.scheduledTime).toBeInstanceOf(Date);
    expect(order.fulfillment.contact!.phoneNumber).toBe('555-1234');
    expect(order.fulfillment.displayId).toBe('D-42');
  });

  it('lineItems sub-interface works', () => {
    const order = createOrder(createTestOrderInput({
      lineItems: [
        {
          Id: 'li-1',
          item: {
            productId: 'prod-1',
            productName: 'Burger',
            optionSetsSelected: [
              {
                optionSetId: 'os-1',
                name: 'Size',
                selectedValues: [{ optionId: 'opt-1', name: 'Large', price: 200, ordinal: 0 }],
                ordinal: 0,
              },
            ],
            price: 999,
          },
          quantity: 2,
          taxes: [{ Id: 'tax-1', name: 'Sales Tax', value: 80 }],
          discounts: [{ Id: 'disc-1', name: '10% Off', value: 100 }],
          surcharges: [{ Id: 'sc-1', name: 'Service', value: 50 }],
          note: 'No onions',
        },
      ],
    }));

    expect(order.lineItems).toHaveLength(1);
    const li = order.lineItems[0];
    expect(li.item.productName).toBe('Burger');
    expect(li.item.optionSetsSelected[0].selectedValues[0].name).toBe('Large');
    expect(li.quantity).toBe(2);
    expect(li.note).toBe('No onions');
  });

  it('payment sub-interface works', () => {
    const paymentTs = new Date('2024-06-01T12:30:00Z');
    const payment: OrderPayment = {
      paymentState: PaymentState.completed,
      paymentTimestamp: paymentTs,
      receiptUrl: 'https://receipt.example.com/123',
    };
    const order = createOrder(createTestOrderInput({ payment }));

    expect(order.payment!.paymentState).toBe('completed');
    expect(order.payment!.paymentTimestamp).toBe(paymentTs);
    expect(order.payment!.receiptUrl).toBe('https://receipt.example.com/123');
  });

  it('state is mutable', () => {
    const order = createOrder(createTestOrderInput());
    order.state = OrderState.completed;
    expect(order.state).toBe('completed');
  });

  it('totalAmount is mutable', () => {
    const order = createOrder(createTestOrderInput());
    order.totalAmount = 2000;
    expect(order.totalAmount).toBe(2000);
  });

  describe('validation', () => {
    it('throws for empty businessId', () => {
      expect(() => createOrder(createTestOrderInput({ businessId: '' }))).toThrow(ValidationError);
    });

    it('throws for empty locationId', () => {
      expect(() => createOrder(createTestOrderInput({ locationId: '' }))).toThrow(ValidationError);
    });

    it('throws for empty menuId', () => {
      expect(() => createOrder(createTestOrderInput({ menuId: '' }))).toThrow(ValidationError);
    });

    it('throws for empty channel', () => {
      expect(() => createOrder(createTestOrderInput({ channel: '' }))).toThrow(ValidationError);
    });

    it('throws for empty agent', () => {
      expect(() => createOrder(createTestOrderInput({ agent: '' }))).toThrow(ValidationError);
    });

    it('throws for empty currency', () => {
      expect(() => createOrder(createTestOrderInput({ currency: '' }))).toThrow(ValidationError);
    });

    it('throws for negative totalAmount', () => {
      expect(() => createOrder(createTestOrderInput({ totalAmount: -1 }))).toThrow(ValidationError);
    });

    it('throws for negative totalDiscountAmount', () => {
      expect(() => createOrder(createTestOrderInput({ totalDiscountAmount: -1 }))).toThrow(ValidationError);
    });

    it('throws for negative totalTaxAmount', () => {
      expect(() => createOrder(createTestOrderInput({ totalTaxAmount: -1 }))).toThrow(ValidationError);
    });

    it('throws for negative totalSurchargeAmount', () => {
      expect(() => createOrder(createTestOrderInput({ totalSurchargeAmount: -1 }))).toThrow(ValidationError);
    });

    it('throws for negative totalTipAmount', () => {
      expect(() => createOrder(createTestOrderInput({ totalTipAmount: -1 }))).toThrow(ValidationError);
    });

    it('allows zero amounts', () => {
      expect(() => createOrder(createTestOrderInput({
        totalAmount: 0, totalDiscountAmount: 0, totalTaxAmount: 0,
        totalSurchargeAmount: 0, totalTipAmount: 0,
      }))).not.toThrow();
    });
  });
});
