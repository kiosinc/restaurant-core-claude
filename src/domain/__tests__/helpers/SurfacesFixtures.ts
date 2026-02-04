import { MenuProps } from '../../surfaces/Menu';
import { MenuGroupProps } from '../../surfaces/MenuGroup';
import { SurfaceConfigurationProps } from '../../surfaces/SurfaceConfiguration';
import { KioskConfigurationProps } from '../../surfaces/KioskConfiguration';
import { CheckoutOptionsProps } from '../../surfaces/CheckoutOptions';
import { TokenProps } from '../../connected-accounts/Token';
import { OnboardingOrderProps, InvoiceStatus } from '../../onboarding/OnboardingOrder';
import { OrderState } from '../../orders/OrderSymbols';
import { emptyAddress } from '../../misc/Address';

export function createTestMenuProps(overrides?: Partial<MenuProps>): MenuProps {
  return {
    name: 'Test Menu',
    displayName: null,
    groups: {},
    groupDisplayOrder: [],
    coverImageGsl: null,
    coverBackgroundImageGsl: null,
    coverVideoGsl: null,
    logoImageGsl: null,
    gratuityRates: [],
    ...overrides,
  };
}

export function createTestMenuGroupProps(overrides?: Partial<MenuGroupProps>): MenuGroupProps {
  return {
    name: 'Test Menu Group',
    displayName: null,
    products: {},
    productDisplayOrder: [],
    parentGroup: null,
    childGroup: null,
    mirrorCategoryId: null,
    ...overrides,
  };
}

export function createTestSurfaceConfigurationProps(
  overrides?: Partial<SurfaceConfigurationProps>,
): SurfaceConfigurationProps {
  return {
    name: 'Test Surface Config',
    isChargeCustomerServiceFee: false,
    coverConfiguration: null,
    tipConfiguration: null,
    checkoutFlowConfiguration: null,
    ...overrides,
  };
}

export function createTestKioskConfigurationProps(
  overrides?: Partial<KioskConfigurationProps>,
): KioskConfigurationProps {
  return {
    name: 'Test Kiosk Config',
    unlockCode: null,
    checkoutOptionId: null,
    ...overrides,
  };
}

export function createTestCheckoutOptionsProps(
  overrides?: Partial<CheckoutOptionsProps>,
): CheckoutOptionsProps {
  return {
    name: 'Test Checkout Options',
    discounts: { isEnabled: false },
    giftCards: { isEnabled: false },
    referralCodes: { isEnabled: false },
    tipOptions: null,
    fulfillmentOptions: {},
    ...overrides,
  };
}

export function createTestTokenProps(overrides?: Partial<TokenProps>): TokenProps {
  return {
    createdBy: 'user-1',
    businessId: 'biz-1',
    provider: 'square',
    ...overrides,
  };
}

export function createTestOnboardingOrderProps(
  overrides?: Partial<OnboardingOrderProps>,
): OnboardingOrderProps {
  return {
    invoiceId: 'inv-1',
    invoiceStatus: InvoiceStatus.draft,
    shippingTrackingNumber: '',
    shipmentCarrier: '',
    shipmentAddress: emptyAddress,
    totalAmount: 0,
    orderStatus: OrderState.new,
    lineItems: [],
    ...overrides,
  };
}
