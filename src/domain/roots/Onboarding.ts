import { BaseEntity, baseEntityDefaults } from '../BaseEntity';

export enum OnboardingStage {
  createBusiness = 'createBusiness',
  squareIntegration = 'squareIntegration',
  categorySync = 'categorySync',
  scheduleMeeting = 'scheduleMeeting',
  configMenu = 'configMenu',
  menuCreate = 'menuCreate',
  onboardingSync = 'onboardingSync',
  shippingInfo = 'shippingInfo',
  kioskPurchase = 'kioskPurchase',
  kioskCheckout = 'kioskCheckout',
  previewKiosk = 'previewKiosk',
  onboardingComplete = 'onboardingComplete',
}

export enum OnboardingStageStatus {
  pending = 'pending',
  complete = 'complete',
  skipped = 'skipped',
}

export const DEFAULT_ONBOARDING_STATUS = Object.fromEntries(
  Object.values(OnboardingStage).map((stage) => [stage, OnboardingStageStatus.pending]),
) as { [stage in OnboardingStage]: OnboardingStageStatus };

export interface Onboarding extends BaseEntity {
  stripeCustomerId: string | null;
  onboardingStatus: { [stage in OnboardingStage]?: OnboardingStageStatus };
  onboardingOrderId: string | null;
  menuCategories: string[] | null;
}

export interface OnboardingInput {
  stripeCustomerId: string | null;
  onboardingStatus: { [stage in OnboardingStage]?: OnboardingStageStatus } | null;
  onboardingOrderId: string | null;
  menuCategories: string[] | null;
}

export function createOnboarding(input: OnboardingInput & Partial<BaseEntity>): Onboarding {
  return {
    ...baseEntityDefaults(input),
    stripeCustomerId: input.stripeCustomerId ?? null,
    onboardingStatus: input.onboardingStatus ?? { ...DEFAULT_ONBOARDING_STATUS },
    onboardingOrderId: input.onboardingOrderId ?? null,
    menuCategories: input.menuCategories ?? null,
  };
}
