import { OrderProps, OrderFulfillment } from '../../orders/Order';
import { OrderType } from '../../orders/OrderSymbols';

export function createTestFulfillment(overrides?: Partial<OrderFulfillment>): OrderFulfillment {
  return {
    type: OrderType.toGo,
    typeMetaData: null,
    scheduledTime: null,
    contact: null,
    displayId: null,
    ...overrides,
  };
}

export function createTestOrderProps(overrides?: Partial<OrderProps>): OrderProps {
  return {
    businessId: 'biz-1',
    locationId: 'loc-1',
    menuId: 'menu-1',
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
    fulfillment: createTestFulfillment(),
    lineItems: [],
    currency: 'USD',
    taxes: [],
    discounts: [],
    surcharges: [],
    note: null,
    payment: null,
    linkedObjects: null,
    referralCode: null,
    source: null,
    tags: null,
    ...overrides,
  };
}
