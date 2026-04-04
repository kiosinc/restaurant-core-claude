import { BaseEntity, baseEntityDefaults } from '../BaseEntity';

export interface OrderSettings extends BaseEntity {
  isSMSStateUpdate: boolean;
  isLoyaltyAccrue: boolean;
  isStateAutoNewToInProgress: boolean;
  gratuityRates: number[];
  isSquareDiscountCodeAPI: boolean;
  isSquareAutoApplyDiscounts: boolean;
  isSquareAutoApplyTaxes: boolean;
  isSquareDiscountCodeAutoEnabled: boolean;
  isKioskSessionIdleTimerOn: boolean;
  isFreeOrdersEnabled: boolean;
  isSingleLineItemsOnly: boolean;
  ticketHeaderFormat: { [orderType: string]: string } | null;
  smsReadyTextFormat: { [orderType: string]: string } | null;
  smsReceiptTextFormat: { [orderType: string]: string } | null;
}

const DEFAULT_GRATUITY_RATES = [10, 15, 20];

export function createOrderSettings(input: Partial<OrderSettings> & {
  isSMSStateUpdate: boolean;
  isLoyaltyAccrue: boolean;
  isStateAutoNewToInProgress: boolean;
}): OrderSettings {
  return {
    ...baseEntityDefaults(input),
    isSMSStateUpdate: input.isSMSStateUpdate,
    isLoyaltyAccrue: input.isLoyaltyAccrue,
    isStateAutoNewToInProgress: input.isStateAutoNewToInProgress,
    gratuityRates: input.gratuityRates ?? DEFAULT_GRATUITY_RATES,
    isSquareDiscountCodeAPI: input.isSquareDiscountCodeAPI ?? false,
    isSquareAutoApplyDiscounts: input.isSquareAutoApplyDiscounts ?? false,
    isSquareAutoApplyTaxes: input.isSquareAutoApplyTaxes ?? true,
    isSquareDiscountCodeAutoEnabled: input.isSquareDiscountCodeAutoEnabled ?? false,
    isKioskSessionIdleTimerOn: input.isKioskSessionIdleTimerOn ?? true,
    isFreeOrdersEnabled: input.isFreeOrdersEnabled ?? true,
    isSingleLineItemsOnly: input.isSingleLineItemsOnly ?? false,
    ticketHeaderFormat: input.ticketHeaderFormat ?? null,
    smsReadyTextFormat: input.smsReadyTextFormat ?? null,
    smsReceiptTextFormat: input.smsReceiptTextFormat ?? null,
  };
}
