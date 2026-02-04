import { DomainEntity, DomainEntityProps } from '../DomainEntity';

export interface TipOptions {
  isEnabled: boolean;
  isSmartTipEnabled: boolean;
  tipAmounts: number[];
  preselectedIdx: number;
}

export interface DiscountOptions {
  isEnabled: boolean;
}

export interface GiftCardOptions {
  isEnabled: boolean;
}

export interface ReferralCodeOptions {
  isEnabled: boolean;
}

export interface ScheduleOptions {
  isEnabled: boolean;
}

export interface ContactOptions {
  isEnabled: boolean;
}

export interface ManualIdConfig {
  title: string;
  text: string;
  isQREnabled: boolean;
}

export interface ManualIdOptions {
  isEnabled: boolean;
  config?: ManualIdConfig;
}

export enum CheckoutOptionType {
  switch = 'switch',
  quantity = 'quantity',
}

export interface OptionConfig {
  name: string;
  type: CheckoutOptionType;
  productId: string;
}

export interface FulfillmentOption {
  isEnabled: boolean;
  scheduleOptions: ScheduleOptions;
  contactOptions: ContactOptions;
  manualIdOptions: ManualIdOptions;
  options: OptionConfig[];
}

export interface CheckoutOptionsProps extends DomainEntityProps {
  name: string;
  discounts: DiscountOptions;
  giftCards: GiftCardOptions;
  referralCodes: ReferralCodeOptions;
  tipOptions: TipOptions | null;
  fulfillmentOptions: { [orderType: string]: FulfillmentOption | undefined };
}

export class CheckoutOptions extends DomainEntity {
  name: string;
  discounts: DiscountOptions;
  giftCards: GiftCardOptions;
  referralCodes: ReferralCodeOptions;
  tipOptions: TipOptions | null;
  fulfillmentOptions: { [orderType: string]: FulfillmentOption | undefined };

  constructor(props: CheckoutOptionsProps) {
    super(props);
    this.name = props.name;
    this.discounts = props.discounts;
    this.giftCards = props.giftCards;
    this.referralCodes = props.referralCodes;
    this.tipOptions = props.tipOptions ?? null;
    this.fulfillmentOptions = props.fulfillmentOptions ?? {};
  }
}
