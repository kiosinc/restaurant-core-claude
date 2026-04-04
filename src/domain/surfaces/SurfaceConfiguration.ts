import { BaseEntity, baseEntityDefaults } from '../BaseEntity';
import { requireString } from '../validation';

export interface CoverConfiguration {
  isCoverNoticeEnabled: boolean;
  coverNoticeText: string | null;
}

export interface CheckoutFlowConfiguration {
  isCouponsEnabled: boolean;
  isSquareGiftCardEnabled: boolean;
  isOrderNoteEnabled: boolean;
  checkoutCustomerNamePromptText: string | null;
  checkoutCustomerPhoneNumberPromptHeading: string | null;
  checkoutCustomerPhoneNumberPromptText: string | null;
  isDineInEnabled: boolean;
  isDineInNoticeEnabled: boolean;
  dineInNoticeText: string | null;
  isDineInCustomerEnterIdEnabled: boolean;
  dineInCustomerEnterIdPrompt: string | null;
  isDineInCustomerNameRequired: boolean;
  dineInCustomerNameRequiredPrompt: string | null;
  isToGoEnabled: boolean;
  isToGoNoticeEnabled: boolean;
  toGoNoticeText: string | null;
  orderConfirmationText: string | null;
  isReferralCodeEnabled: boolean;
  referralCodePromptText: string | null;
}

export interface TipConfiguration {
  isTipsEnabled: boolean;
  isSmartTipsEnabled: boolean;
}

export interface SurfaceConfiguration extends BaseEntity {
  name: string;
  isChargeCustomerServiceFee: boolean;
  coverConfiguration: CoverConfiguration | null;
  tipConfiguration: TipConfiguration | null;
  checkoutFlowConfiguration: CheckoutFlowConfiguration | null;
  version: string;
}

export function createSurfaceConfiguration(input: Partial<SurfaceConfiguration> & {
  name: string;
  isChargeCustomerServiceFee: boolean;
}): SurfaceConfiguration {
  requireString('name', input.name);
  return {
    ...baseEntityDefaults(input),
    name: input.name,
    isChargeCustomerServiceFee: input.isChargeCustomerServiceFee,
    coverConfiguration: input.coverConfiguration ?? null,
    tipConfiguration: input.tipConfiguration ?? null,
    checkoutFlowConfiguration: input.checkoutFlowConfiguration ?? null,
    version: input.version ?? '0.0',
  };
}
