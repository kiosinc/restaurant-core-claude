import { DomainEntity, DomainEntityProps } from '../DomainEntity';
import { OrderState, OrderType, OrderTypeMeta, PaymentState } from './OrderSymbols';
import { LinkedObjectRef, LinkedObjectMap } from '../LinkedObjectRef';

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

export { LinkedObjectRef, LinkedObjectMap };

export interface OrderProps extends DomainEntityProps {
  businessId: string;
  locationId: string;
  menuId: string;
  timestamp?: Date;
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

export class Order extends DomainEntity {
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

  constructor(props: OrderProps) {
    super(props);
    this.version = props.version ?? '3';
    this.businessId = props.businessId;
    this.locationId = props.locationId;
    this.menuId = props.menuId;
    this.timestamp = props.timestamp ?? new Date();
    this.channel = props.channel;
    this.agent = props.agent;
    this.deviceId = props.deviceId;
    this.posProvider = props.posProvider ?? 'system';
    this.totalAmount = props.totalAmount;
    this.totalDiscountAmount = props.totalDiscountAmount;
    this.totalTaxAmount = props.totalTaxAmount;
    this.totalSurchargeAmount = props.totalSurchargeAmount;
    this.totalTipAmount = props.totalTipAmount;
    this.customerId = props.customerId;
    this.fulfillment = props.fulfillment;
    this.lineItems = props.lineItems;
    this.currency = props.currency;
    this.taxes = props.taxes;
    this.discounts = props.discounts;
    this.surcharges = props.surcharges;
    this.state = props.state ?? OrderState.new;
    this.referralCode = props.referralCode;
    this.source = props.source;
    this.note = props.note;
    this.payment = props.payment;
    this.linkedObjects = props.linkedObjects;
    this.isAvailable = props.isAvailable ?? true;
    this.tags = props.tags;
  }
}
