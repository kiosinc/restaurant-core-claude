import { BaseEntity, baseEntityDefaults } from '../BaseEntity';
import { OrderState, OrderType, OrderTypeMeta, PaymentState } from './OrderSymbols';
import { LinkedObjectRef } from '../LinkedObjectRef';
import { requireNonEmptyString, requireNonNegativeNumber } from '../validation';

export interface SelectedValue {
  optionId: string;
  name: string;
  price: number;
  ordinal: number;
}

export interface OptionSetSelected {
  optionSetId: string;
  name: string;
  selectedValues: SelectedValue[];
  ordinal: number;
}

export interface OrderItem {
  readonly productId: string;
  readonly productName: string;
  readonly optionSetsSelected: OptionSetSelected[];
  readonly price: number;
}

export interface OrderPriceAdjustmentMeta {
  Id: string;
  name: string;
  value: number;
}

export interface OrderLineItem {
  readonly Id: string;
  item: OrderItem;
  quantity: number;
  taxes: OrderPriceAdjustmentMeta[];
  discounts: OrderPriceAdjustmentMeta[];
  surcharges: OrderPriceAdjustmentMeta[];
  note: string | null;
}

export interface OrderFulfillmentContact {
  phoneNumber: string | null;
  email: string | null;
  name: string | null;
}

export interface OrderFulfillment {
  type: OrderType;
  typeMetaData: OrderTypeMeta | null;
  scheduledTime: Date | null;
  contact: OrderFulfillmentContact | null;
  displayId: string | null;
}

export interface OrderPayment {
  paymentState: PaymentState;
  paymentTimestamp: Date;
  receiptUrl: string | null;
}

export interface OrderInput {
  businessId: string;
  locationId: string;
  menuId: string;
  timestamp?: Date;
  channel: string;
  agent: string;
  deviceId: string | null;
  posProvider?: string;
  totalAmount: number;
  totalDiscountAmount: number;
  totalTaxAmount: number;
  totalSurchargeAmount: number;
  totalTipAmount: number;
  customerId: string | null;
  fulfillment: OrderFulfillment;
  lineItems: OrderLineItem[];
  currency: string;
  taxes: OrderPriceAdjustmentMeta[];
  discounts: OrderPriceAdjustmentMeta[];
  surcharges: OrderPriceAdjustmentMeta[];
  note: string | null;
  payment: OrderPayment | null;
  linkedObjects: { [Id: string]: LinkedObjectRef } | null;
  state?: OrderState;
  referralCode: string | null;
  source: string | null;
  tags: string[] | null;
  version?: string;
  isAvailable?: boolean;
}

export interface Order extends BaseEntity {
  readonly version: string;
  businessId: string;
  locationId: string;
  menuId: string;
  timestamp: Date;
  channel: string;
  agent: string;
  deviceId: string | null;
  posProvider: string;
  totalAmount: number;
  totalDiscountAmount: number;
  totalTaxAmount: number;
  totalSurchargeAmount: number;
  totalTipAmount: number;
  customerId: string | null;
  fulfillment: OrderFulfillment;
  lineItems: OrderLineItem[];
  currency: string;
  taxes: OrderPriceAdjustmentMeta[];
  discounts: OrderPriceAdjustmentMeta[];
  surcharges: OrderPriceAdjustmentMeta[];
  state: OrderState;
  referralCode: string | null;
  source: string | null;
  note: string | null;
  payment: OrderPayment | null;
  linkedObjects: { [Id: string]: LinkedObjectRef } | null;
  isAvailable: boolean;
  tags: string[] | null;
}

export function createOrder(input: OrderInput & Partial<BaseEntity>): Order {
  requireNonEmptyString('businessId', input.businessId);
  requireNonEmptyString('locationId', input.locationId);
  requireNonEmptyString('menuId', input.menuId);
  requireNonEmptyString('channel', input.channel);
  requireNonEmptyString('agent', input.agent);
  requireNonEmptyString('currency', input.currency);
  requireNonNegativeNumber('totalAmount', input.totalAmount);
  requireNonNegativeNumber('totalDiscountAmount', input.totalDiscountAmount);
  requireNonNegativeNumber('totalTaxAmount', input.totalTaxAmount);
  requireNonNegativeNumber('totalSurchargeAmount', input.totalSurchargeAmount);
  requireNonNegativeNumber('totalTipAmount', input.totalTipAmount);
  return {
    ...baseEntityDefaults(input),
    version: input.version ?? '3',
    businessId: input.businessId,
    locationId: input.locationId,
    menuId: input.menuId,
    timestamp: input.timestamp ?? new Date(),
    channel: input.channel,
    agent: input.agent,
    deviceId: input.deviceId,
    posProvider: input.posProvider ?? 'system',
    totalAmount: input.totalAmount,
    totalDiscountAmount: input.totalDiscountAmount,
    totalTaxAmount: input.totalTaxAmount,
    totalSurchargeAmount: input.totalSurchargeAmount,
    totalTipAmount: input.totalTipAmount,
    customerId: input.customerId,
    fulfillment: input.fulfillment,
    lineItems: input.lineItems,
    currency: input.currency,
    taxes: input.taxes,
    discounts: input.discounts,
    surcharges: input.surcharges,
    state: input.state ?? OrderState.new,
    referralCode: input.referralCode,
    source: input.source,
    note: input.note,
    payment: input.payment,
    linkedObjects: input.linkedObjects,
    isAvailable: input.isAvailable ?? true,
    tags: input.tags,
  };
}
