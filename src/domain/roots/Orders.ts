import { DomainEntity, DomainEntityProps } from '../DomainEntity';

export interface OrderSettingsProps extends DomainEntityProps {
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

export class OrderSettings extends DomainEntity {
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

  constructor(props: OrderSettingsProps) {
    super(props);
    this.isSMSStateUpdate = props.isSMSStateUpdate;
    this.isLoyaltyAccrue = props.isLoyaltyAccrue;
    this.isStateAutoNewToInProgress = props.isStateAutoNewToInProgress;
    this.gratuityRates = props.gratuityRates ?? DEFAULT_GRATUITY_RATES;
    this.isSquareDiscountCodeAPI = props.isSquareDiscountCodeAPI ?? false;
    this.isSquareAutoApplyDiscounts = props.isSquareAutoApplyDiscounts ?? false;
    this.isSquareAutoApplyTaxes = props.isSquareAutoApplyTaxes ?? true;
    this.isSquareDiscountCodeAutoEnabled = props.isSquareDiscountCodeAutoEnabled ?? false;
    this.isKioskSessionIdleTimerOn = props.isKioskSessionIdleTimerOn ?? true;
    this.isFreeOrdersEnabled = props.isFreeOrdersEnabled ?? true;
    this.isSingleLineItemsOnly = props.isSingleLineItemsOnly ?? false;
    this.ticketHeaderFormat = props.ticketHeaderFormat ?? null;
    this.smsReadyTextFormat = props.smsReadyTextFormat ?? null;
    this.smsReceiptTextFormat = props.smsReceiptTextFormat ?? null;
  }
}
