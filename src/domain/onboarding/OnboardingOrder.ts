import { BaseEntity, baseEntityDefaults } from '../BaseEntity';
import { requireNonEmptyString, requireNonNegativeNumber } from '../validation';
import { Address } from '../misc/Address';
import { OrderState } from '../orders/OrderSymbols';
import { OrderLineItem } from '../orders/Order';

export enum InvoiceStatus {
  draft = 'draft',
  open = 'open',
  paid = 'paid',
  void = 'void',
  uncollectible = 'uncollectible',
}

export interface OnboardingOrderInput {
  invoiceId: string;
  invoiceStatus: InvoiceStatus;
  shippingTrackingNumber: string;
  shipmentCarrier: string;
  shipmentAddress: Address;
  totalAmount: number;
  orderStatus: OrderState;
  lineItems?: OrderLineItem[];
}

export interface OnboardingOrder extends BaseEntity {
  invoiceId: string;
  invoiceStatus: InvoiceStatus;
  shippingTrackingNumber: string;
  shipmentCarrier: string;
  shipmentAddress: Address;
  totalAmount: number;
  orderStatus: OrderState;
  lineItems: OrderLineItem[];
}

export function createOnboardingOrder(input: OnboardingOrderInput & Partial<BaseEntity>): OnboardingOrder {
  requireNonEmptyString('invoiceId', input.invoiceId);
  requireNonNegativeNumber('totalAmount', input.totalAmount);
  return {
    ...baseEntityDefaults(input),
    invoiceId: input.invoiceId,
    invoiceStatus: input.invoiceStatus,
    shippingTrackingNumber: input.shippingTrackingNumber,
    shipmentCarrier: input.shipmentCarrier,
    shipmentAddress: input.shipmentAddress,
    totalAmount: input.totalAmount,
    orderStatus: input.orderStatus,
    lineItems: input.lineItems ?? [],
  };
}
