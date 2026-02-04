import { DomainEntity, DomainEntityProps } from '../DomainEntity';

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

export interface SurfaceConfigurationProps extends DomainEntityProps {
  name: string;
  isChargeCustomerServiceFee: boolean;
  coverConfiguration: CoverConfiguration | null;
  tipConfiguration: TipConfiguration | null;
  checkoutFlowConfiguration: CheckoutFlowConfiguration | null;
  version?: string;
}

export class SurfaceConfiguration extends DomainEntity {
  name: string;
  isChargeCustomerServiceFee: boolean;
  coverConfiguration: CoverConfiguration | null;
  tipConfiguration: TipConfiguration | null;
  checkoutFlowConfiguration: CheckoutFlowConfiguration | null;
  version: string;

  constructor(props: SurfaceConfigurationProps) {
    super(props);
    this.name = props.name;
    this.isChargeCustomerServiceFee = props.isChargeCustomerServiceFee;
    this.coverConfiguration = props.coverConfiguration ?? null;
    this.tipConfiguration = props.tipConfiguration ?? null;
    this.checkoutFlowConfiguration = props.checkoutFlowConfiguration ?? null;
    this.version = props.version ?? '0.0';
  }
}
