import { User } from '../../user/User';
import BusinessProfile from '../misc/BusinessProfile';
import { emptyAddress } from '../misc/Address';
import * as Constants from '../../firestore-core/Constants';
import { BusinessType, Business } from './Business';
import Catalog from "./Catalog";
import ConnectedAccounts from "./ConnectedAccounts";
import Surfaces from "./Surfaces";
import {Onboarding} from "./Onboarding";
import Orders from "./Orders";
import Services from "./Services";
import Locations from "./Locations";
import { getFirestore} from "firebase-admin/firestore";

const FEATURELIST_PATH = '/_firebase_ext_/defaultFeatureList'

// export function createBusiness(user: User, type: BusinessType, device: string, name?: string) {
//   const profile: BusinessProfile = new BusinessProfile(name ?? '', emptyAddress);
//
//   const { uid } = user.token;
//   const newBusiness = new Business(device,
//     uid,
//     type,
//     profile,
//     { [uid]: Constants.Role.owner });
//
//   return Writer.setObject(newBusiness, Business.firestoreConverter, newBusiness.Id);
// }

export async function createBusiness(user: User, type: BusinessType, device: string, name?: string) {
  const now = new Date()

  // Business root
  const profile: BusinessProfile = new BusinessProfile(name ?? '', emptyAddress);
  const { uid } = user.token;
  const newBusiness = new Business(device,
      uid,
      type,
      profile,
      { [uid]: Constants.Role.owner });

  const businessId = newBusiness.Id;
  // newBusiness.updated = now;

  const newCatalog = new Catalog({}, {});
  const newConnectedAccounts = new ConnectedAccounts({});
  const newSurface = new Surfaces({}, {});
  const newOnboarding = new Onboarding(null, null, null, null);
  const newOrders = new Orders(true, false, false, null, null, null, null, null, null, null, null, null, null, null);
  const newServices = new Services(null, null);
  const newLocations = new Locations({});

  return getFirestore().runTransaction(async t => {
    // Feature List
    const featureListQuery = getFirestore().doc(FEATURELIST_PATH)
    const featureList = await t.get(featureListQuery).then(d => d.data())

    t.set(
        Business.docRef(businessId).withConverter(Business.firestoreConverter),
        newBusiness,
    )
    t.set(
        Catalog.docRef(businessId).withConverter(Catalog.firestoreConverter),
        newCatalog
    )
    t.set(
        ConnectedAccounts.docRef(businessId).withConverter(ConnectedAccounts.firestoreConverter),
        newConnectedAccounts
    )
    t.set(
        Surfaces.docRef(businessId).withConverter(Surfaces.firestoreConverter),
        newSurface
    )
    t.set(
        Onboarding.docRef(businessId).withConverter(Onboarding.firestoreConverter),
        newOnboarding
    )
    t.set(
        Orders.docRef(businessId).withConverter(Orders.firestoreConverter),
        newOrders
    )
    t.set(
        Services.docRef(businessId).withConverter(Services.firestoreConverter),
        newServices
    )
    t.set(
        Locations.docRef(businessId).withConverter(Locations.firestoreConverter),
        newLocations
    )
    if (featureList) {
      const update = {
        created: now.toISOString(),
        isDeleted: false,
        locationId: null,
        updated: now.toISOString(),
        ...featureList,
      }
      const featureListBusinessPath = `/businesses/${businessId}/featurelist`
      t.set(getFirestore().collection(featureListBusinessPath).doc(), update)
    }

    return Business.docRef(businessId)
  });
}