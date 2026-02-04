import { describe, it, expect } from 'vitest';
import { OnboardingOrder, InvoiceStatus } from '../OnboardingOrder';
import { createTestOnboardingOrderProps } from '../../__tests__/helpers/SurfacesFixtures';
import { OrderState } from '../../orders/OrderSymbols';
import { emptyAddress } from '../../misc/Address';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('OnboardingOrder (domain)', () => {
  it('constructs with all props', () => {
    const now = new Date('2024-01-15T10:00:00Z');
    const addr = { addressLine1: '123 Main St', addressLine2: '', city: 'LA', state: 'CA', zip: '90001', country: 'US' };
    const oo = new OnboardingOrder(createTestOnboardingOrderProps({
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

  it('auto-generates UUID', () => {
    const oo = new OnboardingOrder(createTestOnboardingOrderProps());
    expect(oo.Id).toMatch(UUID_REGEX);
  });

  it('InvoiceStatus enum has expected values', () => {
    expect(InvoiceStatus.draft).toBe('draft');
    expect(InvoiceStatus.open).toBe('open');
    expect(InvoiceStatus.paid).toBe('paid');
    expect(InvoiceStatus.void).toBe('void');
    expect(InvoiceStatus.uncollectible).toBe('uncollectible');
  });

  it('defaults lineItems to []', () => {
    const oo = new OnboardingOrder(createTestOnboardingOrderProps());
    expect(oo.lineItems).toEqual([]);
  });

  it('stores Address', () => {
    const addr = { addressLine1: '456 Oak Ave', addressLine2: 'Suite B', city: 'SF', state: 'CA', zip: '94102', country: 'US' };
    const oo = new OnboardingOrder(createTestOnboardingOrderProps({ shipmentAddress: addr }));
    expect(oo.shipmentAddress.addressLine1).toBe('456 Oak Ave');
    expect(oo.shipmentAddress.city).toBe('SF');
  });

  it('stores OrderState', () => {
    const oo = new OnboardingOrder(createTestOnboardingOrderProps({ orderStatus: OrderState.inProgress }));
    expect(oo.orderStatus).toBe(OrderState.inProgress);
  });

  it('inherits DomainEntity fields', () => {
    const now = new Date('2024-06-01T12:00:00Z');
    const oo = new OnboardingOrder(createTestOnboardingOrderProps({ created: now, updated: now, isDeleted: true }));
    expect(oo.created).toEqual(now);
    expect(oo.updated).toEqual(now);
    expect(oo.isDeleted).toBe(true);
  });

  it('instantiates without Firebase', () => {
    const oo = new OnboardingOrder(createTestOnboardingOrderProps());
    expect(oo).toBeDefined();
  });
});
