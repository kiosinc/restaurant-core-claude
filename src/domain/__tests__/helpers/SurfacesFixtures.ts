import { MenuInput } from '../../surfaces/Menu';
import { MenuGroupInput } from '../../surfaces/MenuGroup';
import { SurfaceConfiguration } from '../../surfaces/SurfaceConfiguration';
import { KioskConfiguration } from '../../surfaces/KioskConfiguration';
import { CheckoutOptions } from '../../surfaces/CheckoutOptions';
import { Token } from '../../connected-accounts/Token';
import { OnboardingOrderInput, InvoiceStatus } from '../../onboarding/OnboardingOrder';
import { OrderState } from '../../orders/OrderSymbols';
import { emptyAddress } from '../../misc/Address';

export function createTestMenuInput(overrides?: Partial<MenuInput>): MenuInput {
  return {
    name: 'Test Menu',
    ...overrides,
  };
}

export function createTestMenuGroupInput(overrides?: Partial<MenuGroupInput>): MenuGroupInput {
  return {
    name: 'Test Menu Group',
    ...overrides,
  };
}

export function createTestSurfaceConfigurationInput(
  overrides?: Partial<SurfaceConfiguration>,
): Partial<SurfaceConfiguration> & { name: string; isChargeCustomerServiceFee: boolean } {
  return {
    name: 'Test Surface Config',
    isChargeCustomerServiceFee: false,
    ...overrides,
  };
}

export function createTestKioskConfigurationInput(
  overrides?: Partial<KioskConfiguration>,
): Partial<KioskConfiguration> & { name: string } {
  return {
    name: 'Test Kiosk Config',
    ...overrides,
  };
}

export function createTestCheckoutOptionsInput(
  overrides?: Partial<CheckoutOptions>,
): Partial<CheckoutOptions> & {
  name: string;
  discounts: { isEnabled: boolean };
  giftCards: { isEnabled: boolean };
  referralCodes: { isEnabled: boolean };
} {
  return {
    name: 'Test Checkout Options',
    discounts: { isEnabled: false },
    giftCards: { isEnabled: false },
    referralCodes: { isEnabled: false },
    ...overrides,
  };
}

export function createTestTokenInput(
  overrides?: Partial<Token>,
): Partial<Token> & { createdBy: string; businessId: string; provider: string } {
  return {
    createdBy: 'user-1',
    businessId: 'biz-1',
    provider: 'square',
    ...overrides,
  };
}

export function createTestOnboardingOrderInput(
  overrides?: Partial<OnboardingOrderInput>,
): OnboardingOrderInput {
  return {
    invoiceId: 'inv-1',
    invoiceStatus: InvoiceStatus.draft,
    shippingTrackingNumber: '',
    shipmentCarrier: '',
    shipmentAddress: emptyAddress,
    totalAmount: 0,
    orderStatus: OrderState.new,
    ...overrides,
  };
}
