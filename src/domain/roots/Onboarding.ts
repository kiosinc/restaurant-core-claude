import { DomainEntity, DomainEntityProps } from '../DomainEntity';

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

export const DEFAULT_ONBOARDING_STATUS: { [stage in OnboardingStage]: OnboardingStageStatus } = {
  [OnboardingStage.createBusiness]: OnboardingStageStatus.pending,
  [OnboardingStage.squareIntegration]: OnboardingStageStatus.pending,
  [OnboardingStage.categorySync]: OnboardingStageStatus.pending,
  [OnboardingStage.scheduleMeeting]: OnboardingStageStatus.pending,
  [OnboardingStage.configMenu]: OnboardingStageStatus.pending,
  [OnboardingStage.menuCreate]: OnboardingStageStatus.pending,
  [OnboardingStage.onboardingSync]: OnboardingStageStatus.pending,
  [OnboardingStage.shippingInfo]: OnboardingStageStatus.pending,
  [OnboardingStage.kioskCheckout]: OnboardingStageStatus.pending,
  [OnboardingStage.previewKiosk]: OnboardingStageStatus.pending,
  [OnboardingStage.kioskPurchase]: OnboardingStageStatus.pending,
  [OnboardingStage.onboardingComplete]: OnboardingStageStatus.pending,
};

export interface OnboardingProps extends DomainEntityProps {
  stripeCustomerId: string | null;
  onboardingStatus: { [stage in OnboardingStage]?: OnboardingStageStatus } | null;
  onboardingOrderId: string | null;
  menuCategories: string[] | null;
}

export class Onboarding extends DomainEntity {
  stripeCustomerId: string | null;
  onboardingStatus: { [stage in OnboardingStage]?: OnboardingStageStatus };
  onboardingOrderId: string | null;
  menuCategories: string[] | null;

  constructor(props: OnboardingProps) {
    super(props);
    this.stripeCustomerId = props.stripeCustomerId ?? null;
    this.onboardingStatus = props.onboardingStatus ?? { ...DEFAULT_ONBOARDING_STATUS };
    this.onboardingOrderId = props.onboardingOrderId ?? null;
    this.menuCategories = props.menuCategories ?? null;
  }
}
