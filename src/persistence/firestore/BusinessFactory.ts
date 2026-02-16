import { getFirestore } from 'firebase-admin/firestore';
import { createBusinessRoot, BusinessType, Role } from '../../domain/roots/Business';
import { createCatalog } from '../../domain/roots/Catalog';
import { createOnboarding } from '../../domain/roots/Onboarding';
import { createOrderSettings } from '../../domain/roots/Orders';
import { createServices } from '../../domain/roots/Services';
import { createLocationsRoot } from '../../domain/roots/Locations';
import { createConnectedAccounts } from '../../domain/roots/ConnectedAccounts';
import { createSurfaces } from '../../domain/roots/Surfaces';
import { PathResolver } from './PathResolver';
import * as Paths from '../../firestore-core/Paths';
import {
  businessConverter, catalogConverter, connectedAccountsConverter,
  surfacesRootConverter, onboardingConverter, servicesConverter,
  locationsRootConverter, orderSettingsConverter,
} from './converters';

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

  const business = createBusinessRoot({
    agent: device,
    createdBy: uid,
    type,
    businessProfile: { name: name ?? '' },
    roles: { [uid]: Role.owner },
  });

  const businessId = business.Id;

  const catalog = createCatalog({ Id: Paths.CollectionNames.catalog });
  const connectedAccounts = createConnectedAccounts({ tokens: {}, Id: Paths.CollectionNames.connectedAccounts });
  const surfaces = createSurfaces({ menus: {}, menuGroups: {}, Id: Paths.CollectionNames.surfaces });
  const onboarding = createOnboarding({
    stripeCustomerId: null,
    onboardingStatus: null,
    onboardingOrderId: null,
    menuCategories: null,
    Id: Paths.CollectionNames.onboarding,
  });
  const orderSettings = createOrderSettings({
    isSMSStateUpdate: true,
    isLoyaltyAccrue: false,
    isStateAutoNewToInProgress: false,
    Id: Paths.CollectionNames.orders,
  });
  const services = createServices({
    kioskFeeRate: 1.5,
    experiments: {},
    Id: Paths.CollectionNames.services,
  });
  const locationsRoot = createLocationsRoot({ locations: {}, Id: Paths.CollectionNames.locations });

  await getFirestore().runTransaction(async (t) => {
    // Feature list
    const featureListQuery = getFirestore().doc(FEATURELIST_PATH);
    const featureList = await t.get(featureListQuery).then((d) => d.data());

    t.set(PathResolver.businessDoc(businessId), businessConverter.toFirestore(business));
    t.set(PathResolver.catalogDoc(businessId), catalogConverter.toFirestore(catalog));
    t.set(PathResolver.connectedAccountsDoc(businessId), connectedAccountsConverter.toFirestore(connectedAccounts));
    t.set(PathResolver.surfacesDoc(businessId), surfacesRootConverter.toFirestore(surfaces));
    t.set(PathResolver.onboardingDoc(businessId), onboardingConverter.toFirestore(onboarding));
    t.set(PathResolver.ordersDoc(businessId), orderSettingsConverter.toFirestore(orderSettings));
    t.set(PathResolver.servicesDoc(businessId), servicesConverter.toFirestore(services));
    t.set(PathResolver.locationsDoc(businessId), locationsRootConverter.toFirestore(locationsRoot));

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
