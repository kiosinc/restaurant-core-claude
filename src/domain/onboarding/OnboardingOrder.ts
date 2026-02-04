import { DomainEntity, DomainEntityProps } from '../DomainEntity';
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

export interface OnboardingOrderProps extends DomainEntityProps {
  invoiceId: string;
  invoiceStatus: InvoiceStatus;
  shippingTrackingNumber: string;
  shipmentCarrier: string;
  shipmentAddress: Address;
  totalAmount: number;
  orderStatus: OrderState;
  lineItems: OrderLineItem[];
}

export class OnboardingOrder extends DomainEntity {
  invoiceId: string;
  invoiceStatus: InvoiceStatus;
  shippingTrackingNumber: string;
  shipmentCarrier: string;
  shipmentAddress: Address;
  totalAmount: number;
  orderStatus: OrderState;
  lineItems: OrderLineItem[];

  constructor(props: OnboardingOrderProps) {
    super(props);
    this.invoiceId = props.invoiceId;
    this.invoiceStatus = props.invoiceStatus;
    this.shippingTrackingNumber = props.shippingTrackingNumber;
    this.shipmentCarrier = props.shipmentCarrier;
    this.shipmentAddress = props.shipmentAddress;
    this.totalAmount = props.totalAmount;
    this.orderStatus = props.orderStatus;
    this.lineItems = props.lineItems ?? [];
  }
}
