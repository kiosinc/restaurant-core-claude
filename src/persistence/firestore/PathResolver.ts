import { getFirestore } from 'firebase-admin/firestore';
import * as Paths from '../../firestore-core/Paths';

/**
 * Centralizes all Firestore document path resolution.
 * Replaces scattered Business.publicCollectionRef / Catalog.docRef / etc.
 */
export class PathResolver {
  private static db() {
    return getFirestore();
  }

  // Business root
  static businessDoc(businessId: string): FirebaseFirestore.DocumentReference {
    return this.db().collection(Paths.CollectionNames.businesses).doc(businessId);
  }

  static businessCollection(): FirebaseFirestore.CollectionReference {
    return this.db().collection(Paths.CollectionNames.businesses);
  }

  // Environment sub-collections
  static publicCollection(businessId: string): FirebaseFirestore.CollectionReference {
    return this.businessDoc(businessId).collection(Paths.Environment.public);
  }

  static privateCollection(businessId: string): FirebaseFirestore.CollectionReference {
    return this.businessDoc(businessId).collection(Paths.Environment.private);
  }

  static featurelistCollection(businessId: string): FirebaseFirestore.CollectionReference {
    return this.businessDoc(businessId).collection(Paths.Environment.featurelist);
  }

  static sandboxCollection(businessId: string): FirebaseFirestore.CollectionReference {
    return this.businessDoc(businessId).collection(Paths.Environment.sandbox);
  }

  // Singleton root docs
  static catalogDoc(businessId: string): FirebaseFirestore.DocumentReference {
    return this.publicCollection(businessId).doc(Paths.CollectionNames.catalog);
  }

  static surfacesDoc(businessId: string): FirebaseFirestore.DocumentReference {
    return this.publicCollection(businessId).doc(Paths.CollectionNames.surfaces);
  }

  static locationsDoc(businessId: string): FirebaseFirestore.DocumentReference {
    return this.publicCollection(businessId).doc(Paths.CollectionNames.locations);
  }

  static ordersDoc(businessId: string): FirebaseFirestore.DocumentReference {
    return this.privateCollection(businessId).doc(Paths.CollectionNames.orders);
  }

  static connectedAccountsDoc(businessId: string): FirebaseFirestore.DocumentReference {
    return this.privateCollection(businessId).doc(Paths.CollectionNames.connectedAccounts);
  }

  static servicesDoc(businessId: string): FirebaseFirestore.DocumentReference {
    return this.privateCollection(businessId).doc(Paths.CollectionNames.services);
  }

  static onboardingDoc(businessId: string): FirebaseFirestore.DocumentReference {
    return this.privateCollection(businessId).doc(Paths.CollectionNames.onboarding);
  }

  static varsDoc(businessId: string): FirebaseFirestore.DocumentReference {
    return this.privateCollection(businessId).doc(Paths.CollectionNames.vars);
  }

  // Child collection helpers
  static productsCollection(businessId: string): FirebaseFirestore.CollectionReference {
    return this.catalogDoc(businessId).collection(Paths.CollectionNames.products);
  }

  static categoriesCollection(businessId: string): FirebaseFirestore.CollectionReference {
    return this.catalogDoc(businessId).collection(Paths.CollectionNames.categories);
  }

  static optionsCollection(businessId: string): FirebaseFirestore.CollectionReference {
    return this.catalogDoc(businessId).collection(Paths.CollectionNames.options);
  }

  static optionSetsCollection(businessId: string): FirebaseFirestore.CollectionReference {
    return this.catalogDoc(businessId).collection(Paths.CollectionNames.optionSets);
  }

  static taxRatesCollection(businessId: string): FirebaseFirestore.CollectionReference {
    return this.catalogDoc(businessId).collection(Paths.CollectionNames.taxRates);
  }

  static discountsCollection(businessId: string): FirebaseFirestore.CollectionReference {
    return this.catalogDoc(businessId).collection(Paths.CollectionNames.discounts);
  }

  static serviceChargesCollection(businessId: string): FirebaseFirestore.CollectionReference {
    return this.catalogDoc(businessId).collection(Paths.CollectionNames.serviceCharges);
  }

  static menusCollection(businessId: string): FirebaseFirestore.CollectionReference {
    return this.surfacesDoc(businessId).collection(Paths.CollectionNames.menus);
  }

  static menuGroupsCollection(businessId: string): FirebaseFirestore.CollectionReference {
    return this.surfacesDoc(businessId).collection(Paths.CollectionNames.menuGroups);
  }

  static surfaceConfigurationsCollection(businessId: string): FirebaseFirestore.CollectionReference {
    return this.surfacesDoc(businessId).collection(Paths.CollectionNames.surfaceConfigurations);
  }

  static kioskConfigurationsCollection(businessId: string): FirebaseFirestore.CollectionReference {
    return this.surfacesDoc(businessId).collection(Paths.CollectionNames.kioskConfigurations);
  }

  static checkoutOptionsCollection(businessId: string): FirebaseFirestore.CollectionReference {
    return this.surfacesDoc(businessId).collection(Paths.CollectionNames.checkoutOptions);
  }

  static collectionsCollection(businessId: string): FirebaseFirestore.CollectionReference {
    return this.surfacesDoc(businessId).collection(Paths.CollectionNames.collections);
  }

  static inventoryRootDoc(businessId: string): FirebaseFirestore.DocumentReference {
    return this.publicCollection(businessId).doc(Paths.CollectionNames.inventory);
  }

  static availabilityDoc(businessId: string, locationId: string): FirebaseFirestore.DocumentReference {
    return this.catalogDoc(businessId).collection(Paths.CollectionNames.inventory).doc(locationId);
  }

  /**
   * P41 per-entity availability entries (rcc#162 §1):
   * `businesses/{businessId}/public/catalog/inventory/{locationId}/entries`.
   * Parented on `availabilityDoc` — the legacy per-location megadoc — so the two stores coexist
   * during dual-write, and because Firestore subcollections do not cascade the entries survive
   * the legacy doc's deletion at retirement. The same non-cascade means a location teardown
   * that deletes the legacy doc must also delete this collection (e.g. the SDK's
   * `recursiveDelete` on it), or the entries linger under a phantom parent.
   * Not `inventoryRootDoc` (`public/inventory`).
   * Each location owns its own collection: sequential `updatedAt` indexing caps a collection at
   * ~500 sustained writes/s (contract §1 "Indexes").
   */
  static inventoryEntriesCollection(businessId: string, locationId: string): FirebaseFirestore.CollectionReference {
    return this.availabilityDoc(businessId, locationId).collection(Paths.CollectionNames.entries);
  }

  /** `…/entries/{entityId}` — doc id is the KIOS entity `Id` (Product.Id or Option.Id). */
  static inventoryEntryDoc(businessId: string, locationId: string, entityId: string): FirebaseFirestore.DocumentReference {
    return this.inventoryEntriesCollection(businessId, locationId).doc(entityId);
  }

  static locationsCollection(businessId: string): FirebaseFirestore.CollectionReference {
    return this.locationsDoc(businessId).collection(Paths.CollectionNames.locations);
  }

  static ordersCollection(businessId: string): FirebaseFirestore.CollectionReference {
    return this.ordersDoc(businessId).collection(Paths.CollectionNames.orders);
  }

  static eventsCollection(businessId: string): FirebaseFirestore.CollectionReference {
    return this.connectedAccountsDoc(businessId).collection(Paths.CollectionNames.events);
  }

  static tokensCollection(businessId: string): FirebaseFirestore.CollectionReference {
    return this.connectedAccountsDoc(businessId).collection(Paths.CollectionNames.tokens);
  }

  static onboardingOrdersCollection(businessId: string): FirebaseFirestore.CollectionReference {
    return this.onboardingDoc(businessId).collection(Paths.CollectionNames.onboardingOrders);
  }

  static semaphoresCollection(): FirebaseFirestore.CollectionReference {
    return this.db().collection(Paths.CollectionNames.semaphores);
  }

  /**
   * P42 webhook claim/lease docs, keyed by Square's globally unique `event_id`.
   * Top-level (not under `businesses/{businessId}`) like `semaphores`: claims are
   * delivery plumbing rather than tenant data, may be created before the tenant is
   * resolved, and the sweeper's only query is cross-tenant. See rcc#166.
   */
  static webhookClaimsCollection(): FirebaseFirestore.CollectionReference {
    return this.db().collection(Paths.CollectionNames.webhookClaims);
  }
}
