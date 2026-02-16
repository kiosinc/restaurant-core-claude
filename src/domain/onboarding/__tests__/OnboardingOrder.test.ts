import { describe, it, expect } from 'vitest';
import { createOnboardingOrder, InvoiceStatus } from '../OnboardingOrder';
import { createTestOnboardingOrderInput } from '../../__tests__/helpers/SurfacesFixtures';
import { OrderState } from '../../orders/OrderSymbols';
import { ValidationError } from '../../validation';

describe('OnboardingOrder (domain)', () => {
  it('constructs with all props', () => {
    const now = new Date('2024-01-15T10:00:00Z');
    const addr = { addressLine1: '123 Main St', addressLine2: '', city: 'LA', state: 'CA', zip: '90001', country: 'US' };
    const oo = createOnboardingOrder(createTestOnboardingOrderInput({
      Id: 'oo-1',
      invoiceId: 'inv-42',
      invoiceStatus: InvoiceStatus.paid,
      shippingTrackingNumber: 'TRACK123',
      shipmentCarrier: 'UPS',
      shipmentAddress: addr,
      totalAmount: 5000,
      orderStatus: OrderState.completed,
      lineItems: [{
        Id: 'li-1',
        item: { productId: 'prod-1', productName: 'Tablet', optionSetsSelected: [], price: 5000 },
        quantity: 1,
        taxes: [],
        discounts: [],
        surcharges: [],
        note: null,
      }],
      created: now,
      updated: now,
    }));

    expect(oo.Id).toBe('oo-1');
    expect(oo.invoiceId).toBe('inv-42');
    expect(oo.invoiceStatus).toBe(InvoiceStatus.paid);
    expect(oo.shippingTrackingNumber).toBe('TRACK123');
    expect(oo.shipmentCarrier).toBe('UPS');
    expect(oo.shipmentAddress.city).toBe('LA');
    expect(oo.totalAmount).toBe(5000);
    expect(oo.orderStatus).toBe(OrderState.completed);
    expect(oo.lineItems).toHaveLength(1);
  });

  it('InvoiceStatus enum has expected values', () => {
    expect(InvoiceStatus.draft).toBe('draft');
    expect(InvoiceStatus.open).toBe('open');
    expect(InvoiceStatus.paid).toBe('paid');
    expect(InvoiceStatus.void).toBe('void');
    expect(InvoiceStatus.uncollectible).toBe('uncollectible');
  });

  it('defaults lineItems to []', () => {
    const oo = createOnboardingOrder(createTestOnboardingOrderInput());
    expect(oo.lineItems).toEqual([]);
  });

  it('stores Address', () => {
    const addr = { addressLine1: '456 Oak Ave', addressLine2: 'Suite B', city: 'SF', state: 'CA', zip: '94102', country: 'US' };
    const oo = createOnboardingOrder(createTestOnboardingOrderInput({ shipmentAddress: addr }));
    expect(oo.shipmentAddress.addressLine1).toBe('456 Oak Ave');
    expect(oo.shipmentAddress.city).toBe('SF');
  });

  it('stores OrderState', () => {
    const oo = createOnboardingOrder(createTestOnboardingOrderInput({ orderStatus: OrderState.inProgress }));
    expect(oo.orderStatus).toBe(OrderState.inProgress);
  });

  describe('validation', () => {
    it('throws for empty invoiceId', () => {
      expect(() => createOnboardingOrder(createTestOnboardingOrderInput({ invoiceId: '' }))).toThrow(ValidationError);
    });

    it('throws for negative totalAmount', () => {
      expect(() => createOnboardingOrder(createTestOnboardingOrderInput({ totalAmount: -1 }))).toThrow(ValidationError);
    });

    it('allows zero totalAmount', () => {
      expect(() => createOnboardingOrder(createTestOnboardingOrderInput({ totalAmount: 0 }))).not.toThrow();
    });
  });

});
