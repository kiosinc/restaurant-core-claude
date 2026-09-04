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
  /**
   * Operator permission for a guest to complete a checkout whose grand total is
   * $0 (a reward or coupon covered the cart). Read by django only; the gateway
   * does not consult it. Free Order Lane does NOT depend on this flag — the two
   * are mutually exclusive, so a free-lane business always has this false.
   *
   * Historically this was written by the gateway's Square-loyalty enable route
   * and read by nobody. That write is removed in
   * kiosinc/square-gateway-claude (P48).
   */
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
    isFreeOrdersEnabled: input.isFreeOrdersEnabled ?? false,
    isSingleLineItemsOnly: input.isSingleLineItemsOnly ?? false,
    ticketHeaderFormat: input.ticketHeaderFormat ?? null,
    smsReadyTextFormat: input.smsReadyTextFormat ?? null,
    smsReceiptTextFormat: input.smsReceiptTextFormat ?? null,
  };
}
