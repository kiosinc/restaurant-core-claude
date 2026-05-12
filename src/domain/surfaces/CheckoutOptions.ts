import { BaseEntity, baseEntityDefaults } from '../BaseEntity';
import { requireString } from '../validation';

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

export interface CheckoutOptions extends BaseEntity {
  name: string;
  discounts: DiscountOptions;
  giftCards: GiftCardOptions;
  referralCodes: ReferralCodeOptions;
  tipOptions: TipOptions | null;
  fulfillmentOptions: { [orderType: string]: FulfillmentOption | undefined };
}

export function createCheckoutOptions(input: Partial<CheckoutOptions> & {
  name: string;
  discounts: DiscountOptions;
  giftCards: GiftCardOptions;
  referralCodes: ReferralCodeOptions;
}): CheckoutOptions {
  requireString('name', input.name);
  return {
    ...baseEntityDefaults(input),
    name: input.name,
    discounts: input.discounts,
    giftCards: input.giftCards,
    referralCodes: input.referralCodes,
    tipOptions: input.tipOptions ?? null,
    fulfillmentOptions: input.fulfillmentOptions ?? {},
  };
}
