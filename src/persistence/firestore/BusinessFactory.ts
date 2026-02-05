import { getFirestore } from 'firebase-admin/firestore';
import { Business, BusinessType, Role } from '../../domain/roots/Business';
import { Catalog } from '../../domain/roots/Catalog';
import { Onboarding } from '../../domain/roots/Onboarding';
import { OrderSettings } from '../../domain/roots/Orders';
import { Services } from '../../domain/roots/Services';
import { LocationsRoot } from '../../domain/roots/Locations';
import { ConnectedAccounts } from '../../domain/roots/ConnectedAccounts';
import { Surfaces } from '../../domain/roots/Surfaces';
import { PathResolver } from './PathResolver';
import * as Paths from '../../firestore-core/Paths';

const FEATURELIST_PATH = '/_firebase_ext_/defaultFeatureList';

export interface CreateBusinessInput {
  uid: string;
  device: string;
  type: BusinessType;
  name?: string;
}

/**
 * Creates a new business with all root aggregate documents.
 * Replaces BusinessUtilities.createBusiness().
 */
export async function createBusiness(input: CreateBusinessInput): Promise<string> {
  const { uid, device, type, name } = input;
  const now = new Date();

  const business = new Business({
    agent: device,
    createdBy: uid,
    type,
    businessProfile: { name: name ?? '' },
    roles: { [uid]: Role.owner },
  });

  const businessId = business.Id;

  const catalog = new Catalog({ Id: Paths.CollectionNames.catalog });
  const connectedAccounts = new ConnectedAccounts({ tokens: {}, Id: Paths.CollectionNames.connectedAccounts });
  const surfaces = new Surfaces({ menus: {}, menuGroups: {}, Id: Paths.CollectionNames.surfaces });
  const onboarding = new Onboarding({
    stripeCustomerId: null,
    onboardingStatus: null,
    onboardingOrderId: null,
    menuCategories: null,
    Id: Paths.CollectionNames.onboarding,
  });
  const orderSettings = new OrderSettings({
    isSMSStateUpdate: true,
    isLoyaltyAccrue: false,
    isStateAutoNewToInProgress: false,
    gratuityRates: [10, 15, 20],
    isSquareDiscountCodeAPI: false,
    isSquareAutoApplyDiscounts: false,
    isSquareAutoApplyTaxes: true,
    isSquareDiscountCodeAutoEnabled: false,
    isKioskSessionIdleTimerOn: true,
    isFreeOrdersEnabled: true,
    isSingleLineItemsOnly: false,
    ticketHeaderFormat: null,
    smsReadyTextFormat: null,
    smsReceiptTextFormat: null,
    Id: Paths.CollectionNames.orders,
  });
  const services = new Services({
    kioskFeeRate: 1.5,
    experiments: {},
    Id: Paths.CollectionNames.services,
  });
  const locationsRoot = new LocationsRoot({ locations: {}, Id: Paths.CollectionNames.locations });

  await getFirestore().runTransaction(async (t) => {
    // Feature list
    const featureListQuery = getFirestore().doc(FEATURELIST_PATH);
    const featureList = await t.get(featureListQuery).then((d) => d.data());

    t.set(PathResolver.businessDoc(businessId), businessToFirestore(business));
    t.set(PathResolver.catalogDoc(businessId), rootToFirestore(catalog));
    t.set(PathResolver.connectedAccountsDoc(businessId), connectedAccountsToFirestore(connectedAccounts));
    t.set(PathResolver.surfacesDoc(businessId), surfacesToFirestore(surfaces));
    t.set(PathResolver.onboardingDoc(businessId), onboardingToFirestore(onboarding));
    t.set(PathResolver.ordersDoc(businessId), orderSettingsToFirestore(orderSettings));
    t.set(PathResolver.servicesDoc(businessId), servicesToFirestore(services));
    t.set(PathResolver.locationsDoc(businessId), locationsRootToFirestore(locationsRoot));

    if (featureList) {
      const update = {
        created: now.toISOString(),
        isDeleted: false,
        locationId: null,
        updated: now.toISOString(),
        enabled: { ...featureList },
      };
      const featureListPath = `/businesses/${businessId}/featurelist`;
      t.set(getFirestore().collection(featureListPath).doc(), update);
    }
  });

  return businessId;
}

function businessToFirestore(b: Business): FirebaseFirestore.DocumentData {
  return {
    agent: b.agent,
    createdBy: b.createdBy,
    type: b.type,
    businessProfile: {
      name: b.businessProfile.name,
      address: b.businessProfile.address ?? null,
      shippingAddress: b.businessProfile.shippingAddress ?? null,
    },
    roles: JSON.parse(JSON.stringify(b.roles)),
    created: b.created.toISOString(),
    updated: b.updated.toISOString(),
    isDeleted: b.isDeleted,
  };
}

function rootToFirestore(c: Catalog): FirebaseFirestore.DocumentData {
  return {
    created: c.created.toISOString(),
    updated: c.updated.toISOString(),
    isDeleted: c.isDeleted,
  };
}

function connectedAccountsToFirestore(ca: ConnectedAccounts): FirebaseFirestore.DocumentData {
  return {
    tokens: JSON.parse(JSON.stringify(ca.tokens)),
    created: ca.created.toISOString(),
    updated: ca.updated.toISOString(),
    isDeleted: ca.isDeleted,
  };
}

function surfacesToFirestore(s: Surfaces): FirebaseFirestore.DocumentData {
  return {
    menus: JSON.parse(JSON.stringify(s.menus)),
    menuGroups: JSON.parse(JSON.stringify(s.menuGroups)),
    created: s.created.toISOString(),
    updated: s.updated.toISOString(),
    isDeleted: s.isDeleted,
  };
}

function onboardingToFirestore(ob: Onboarding): FirebaseFirestore.DocumentData {
  return {
    stripeCustomerId: ob.stripeCustomerId,
    onboardingStatus: ob.onboardingStatus,
    onboardingOrderId: ob.onboardingOrderId ?? null,
    menuCategories: ob.menuCategories ?? null,
    created: ob.created.toISOString(),
    updated: ob.updated.toISOString(),
    isDeleted: ob.isDeleted,
  };
}

function orderSettingsToFirestore(os: OrderSettings): FirebaseFirestore.DocumentData {
  return {
    isSMSStateUpdate: os.isSMSStateUpdate,
    isLoyaltyAccrue: os.isLoyaltyAccrue,
    isStateAutoNewToInProgress: os.isStateAutoNewToInProgress,
    gratuityRates: JSON.parse(JSON.stringify(os.gratuityRates)),
    isSquareDiscountCodeAPI: os.isSquareDiscountCodeAPI,
    isSquareAutoApplyDiscounts: os.isSquareAutoApplyDiscounts,
    isSquareAutoApplyTaxes: os.isSquareAutoApplyTaxes,
    isSquareDiscountCodeAutoEnabled: os.isSquareDiscountCodeAutoEnabled,
    isKioskSessionIdleTimerOn: os.isKioskSessionIdleTimerOn,
    isFreeOrdersEnabled: os.isFreeOrdersEnabled,
    isSingleLineItemsOnly: os.isSingleLineItemsOnly,
    ticketHeaderFormat: os.ticketHeaderFormat,
    smsReadyTextFormat: os.smsReadyTextFormat,
    smsReceiptTextFormat: os.smsReceiptTextFormat,
    created: os.created.toISOString(),
    updated: os.updated.toISOString(),
    isDeleted: os.isDeleted,
  };
}

function servicesToFirestore(svc: Services): FirebaseFirestore.DocumentData {
  return {
    kioskFeeRate: svc.kioskFeeRate,
    experiments: svc.experiments,
    created: svc.created.toISOString(),
    updated: svc.updated.toISOString(),
    isDeleted: svc.isDeleted,
  };
}

function locationsRootToFirestore(lr: LocationsRoot): FirebaseFirestore.DocumentData {
  return {
    locations: JSON.parse(JSON.stringify(lr.locations)),
    created: lr.created.toISOString(),
    updated: lr.updated.toISOString(),
    isDeleted: lr.isDeleted,
  };
}
