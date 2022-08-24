/**
 * FirestoreWriter functions
 * Helps write and delete FirestoreObjectTypes to the db
 */

import { Query } from 'firebase-admin/database';
import { firestore } from '../firebaseApp';
import Category from '../../restaurant/catalog/Category';
import { Product } from '../../restaurant/catalog/Product';
import MenuGroup from '../../restaurant/surfaces/MenuGroup';
import { Business } from '../../restaurant/roots/Business';
import FirestoreObjectType from './FirestoreObjectType';
import Catalog from '../../restaurant/roots/Catalog';
import ConnectedAccounts from '../../restaurant/roots/ConnectedAccounts';
import Surfaces from '../../restaurant/roots/Surfaces';
import Services from '../../restaurant/roots/Services';
import Orders from '../../restaurant/roots/Orders';
import Vars from '../../restaurant/roots/Vars';
import Locations from '../../restaurant/roots/Locations';
import OptionSet from '../../restaurant/catalog/OptionSet';
import Option from '../../restaurant/catalog/Option';
import { Onboarding } from '../../restaurant/roots/Onboarding';

export interface BatchUpdateInfo {
  ref: FirebaseFirestore.DocumentReference;
  field: string;
  data: any
}

function batchUpdateInfo(
  ref: FirebaseFirestore.DocumentReference,
  field: string,
  data: any,
): BatchUpdateInfo {
  return {
    ref,
    field,
    data,
  };
}

/**
 * Delete a firestore object using recursive (if needed) batched transactions
 * Factory writer to the store
 * Writes this object and it's metadata to the store,
 * and also updates relevant relationships
 */
export async function setT<C extends FirestoreObjectType>(
  object: C,
  converter: FirebaseFirestore.FirestoreDataConverter<C>,
  businessId: string,
  t: FirebaseFirestore.Transaction,
  merge: boolean = false,
): Promise<BatchUpdateInfo[]> {
  const id = object.Id;
  const updatedObject = object;
  updatedObject.updated = new Date();
  const metadata = JSON.parse(JSON.stringify(object.metadata()));

  const batchedUpdates: BatchUpdateInfo[] = [];

  /**
   * Make applicable updates for relationships
   * depending on the type of the object
   */

  /** Product */
  if (object instanceof Product) {
    /** Update menu group, category, attribute relationships */
    // Setup reads first
    // MenuGroups
    const menuGroupQuery = MenuGroup.collectionRef(businessId)
      .where('productDisplayOrder', 'array-contains', id)
      .withConverter(MenuGroup.firestoreConverter);
    const menuGroupQuerySnapshots = await t.get(menuGroupQuery);
    // Category
    const categoryQuery = Category.collectionRef(businessId)
      .where('productDisplayOrder', 'array-contains', id)
      .withConverter(Category.firestoreConverter);
    const categoryQuerySnapshots = await t.get(categoryQuery);
    // End reads

    // Setup writes second
    // Update from each menu group
    batchedUpdates.push(...menuGroupQuerySnapshots.docs.map((s) => batchUpdateInfo(s.ref, `products.${id}`, metadata)));

    // Update each category group
    batchedUpdates.push(...categoryQuerySnapshots.docs.map((s) => batchUpdateInfo(s.ref, `products.${id}`, metadata)));
  }
  /** OptionSet */
  if (object instanceof OptionSet) {
    const productConverter = Product.firestoreConverter;
    const fieldPath = `optionSets.${id}.name`;
    const query = Product.collectionRef(businessId)
      .where(fieldPath, '>=', '')
      .withConverter(productConverter);
    const querySnapshots = await t.get(query);

    batchedUpdates.push(...querySnapshots.docs.map((s) => batchUpdateInfo(s.ref, `optionSets.${id}`, metadata)));
  }

  /* Option */
  if (object instanceof Option) {
    const optionSetConverter = OptionSet.firestoreConverter;
    const fieldPath = `options.${id}.name`;
    const query = OptionSet.collectionRef(businessId)
      .where(fieldPath, '>=', '')
      .withConverter(optionSetConverter);
    const querySnapshots = await t.get(query);

    batchedUpdates.push(...querySnapshots.docs.map((s) => batchUpdateInfo(s.ref, `options.${id}`, metadata)));
  }

  /** FINALIZE and set basic object and it's metadata */
  t.set(
    object.collectionRef(businessId).doc(id).withConverter(converter),
    updatedObject,
    { merge },
  );

  const metaLinks = object.metaLinks(businessId);

  Object.keys(metaLinks).forEach((key) => {
    const value = metaLinks[key] as string;
    const docRef = firestore.getFirestore().doc(key);

    const fields = {
      [value]: metadata,
    };

    t.update(docRef, fields);
  });

  /**
   * Business
   * The scaffolding for the business objects needs to be done after the
   * business is created
   * */
  if (object instanceof Business) {
    const newCatalog = new Catalog({}, {}, {}, {}, {}, {});
    const newConnectedAccounts = new ConnectedAccounts({});
    const newSurface = new Surfaces({}, {});
    const newOnboarding = new Onboarding(null, null, null, null);
    const newOrders = new Orders(true, false, false, null, null, null, null, null);
    const newServices = new Services(null, null);
    const newVar = new Vars();
    const newLocations = new Locations({});

    // TODO security is disabled
    // .then(() => {
    //     let claims = user.claims
    //     claims.businessRole[newBusiness.Id] = Role.owner
    //     return auth().setCustomUserClaims(uid, Claims.wrapper(claims))
    // })

    await setT(newCatalog, Catalog.firestoreConverter, id, t);
    await setT(newConnectedAccounts, ConnectedAccounts.firestoreConverter, id, t);
    await setT(newSurface, Surfaces.firestoreConverter, id, t);
    await setT(newOnboarding, Onboarding.firestoreConverter, id, t);
    await setT(newOrders, Orders.firestoreConverter, id, t);
    await setT(newServices, Services.firestoreConverter, id, t);
    await setT(newVar, Vars.firestoreConverter, id, t);
    await setT(newLocations, Locations.firestoreConverter, id, t);
  }

  return batchedUpdates;
}

async function deleteQueryBatch(query: FirebaseFirestore.Query,
  resolve: (value: number) => void,
  reject: (reason?: any) => void,
  count: number = 0) {
  const snapshot = await query.get();

  const batchSize = snapshot.size;
  if (batchSize === 0) {
    // When there are no documents left, we are done
    resolve(count);
    return;
  }

  // Delete documents in a batch
  const batch = firestore.getFirestore().batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  // Recurse on the next process tick, to avoid
  // exploding the stack.
  process.nextTick(() => {
    deleteQueryBatch(query, resolve, reject, count + batchSize).catch(reject);
  });
}

export async function deleteQuery(query: FirebaseFirestore.Query, batchSize: number) {
  const limitedQuery = query.limit(batchSize);

  return new Promise<number>((resolve, reject) => {
    deleteQueryBatch(limitedQuery, resolve, reject).catch(reject);
  });
}

async function updateQueryBatch(
  query: FirebaseFirestore.Query,
  data: FirebaseFirestore.UpdateData,
  resolve: (value: number) => void,
  reject: (reason?: any) => void,
  count: number = 0,
) {
  const snapshot = await query.get();

  const batchSize = snapshot.size;
  if (batchSize === 0) {
    // When there are no documents left, we are done
    resolve(count);
    return;
  }

  // Update documents in a batch
  const batch = firestore.getFirestore().batch();
  snapshot.docs.forEach((doc) => {
    batch.update(doc.ref, data);
  });
  await batch.commit();

  // Recurse on the next process tick, to avoid
  // exploding the stack.
  process.nextTick(() => {
    updateQueryBatch(query.startAfter(snapshot.docs[snapshot.docs.length - 1]),
      data,
      resolve,
      reject,
      count + batchSize).catch(reject);
  });
}

export function updateQuery(query: FirebaseFirestore.Query,
  data: FirebaseFirestore.UpdateData,
  batchSize: number) {
  const limitedQuery = query.limit(batchSize);

  return new Promise<number>((resolve, reject) => {
    updateQueryBatch(limitedQuery, data, resolve, reject).catch(reject);
  });
}
async function updateBatchInfo(updates: BatchUpdateInfo[],
  batchSize: number,
  resolve: (value: number) => void,
  reject: (reason?: any) => void,
  count: number = 0) {
  const updatesThisTick = updates.splice(0, Math.min(updates.length, batchSize));
  const thisBatchSize = updatesThisTick.length;

  if (thisBatchSize === 0) {
    // When there are no updates left, we are done
    resolve(count);
    return;
  }

  // Update documents in a batch
  const batch = firestore.getFirestore().batch();
  updatesThisTick.forEach((info) => {
    batch.update(info.ref, info.field, info.data);
  });
  await batch.commit();

  // Recurse on the next process tick, to avoid
  // exploding the stack.
  process.nextTick(() => {
    updateBatchInfo(updates, batchSize, resolve, reject, count + thisBatchSize).catch(reject);
  });
}

async function deleteFirebaseQueryBatch(query: Query,
  resolve: (value: number) => void,
  reject: (reason?: any) => void,
  count: number = 0) {
  query.once('value', async (snapshot) => {
    const batchSize = snapshot.numChildren();
    if (batchSize === 0) {
      // When there are no documents left, we are done
      resolve(count);
      return;
    }

    const update: any = {};
    snapshot.forEach((data) => {
      if (data.key) {
        update[data.key] = null;
      }
    });
    await query.ref.update(update);

    // Recurse on the next process tick, to avoid
    // exploding the stack.
    process.nextTick(() => {
      deleteFirebaseQueryBatch(query, resolve, reject, count + batchSize)
        .catch(reject);
    });
  });
}

export async function deleteFirebaseQuery(query: Query, batchSize: number) {
  const limitedQuery = query.limitToFirst(batchSize);

  return new Promise<number>((resolve, reject) => {
    deleteFirebaseQueryBatch(limitedQuery, resolve, reject).catch(reject);
  });
}

/**
 * Usage: await updateBatch(batchedUpdates, limit);
 * @param updates: BatchUpdateInfo
 * @param batchSize: number
 */
export async function updateBatch(updates: BatchUpdateInfo[], batchSize: number) {
  return new Promise<number>((resolve, reject) => {
    updateBatchInfo(updates, batchSize, resolve, reject).catch(reject);
  });
}

/**
 * Factory writer to the store
 * Writes this object and it's metadata to the store,
 * and also updates relevant relationships
 */
export async function setObject<C extends FirestoreObjectType>(
  object: C,
  converter: FirebaseFirestore.FirestoreDataConverter<C>,
  businessId: string,
  merge: boolean = false,
) {
  const id = object.Id;
  const result = object.collectionRef(businessId).doc(id).withConverter(converter);

  const batchedUpdates = await firestore.getFirestore()
    .runTransaction(async (t) => setT(object, converter, businessId, t, merge));

  // Batch update

  const batchedUpdatesCount = batchedUpdates.length;
  if (batchedUpdatesCount > 0) {
    const limit = 100;
    await updateBatch(batchedUpdates, limit);
  }

  return result;
}

/**
 * Delete a firestore object using recursive (if needed) batched transactions
 */
async function deleteT<C extends FirestoreObjectType>(
  object: C,
  businessId: string,
  t: FirebaseFirestore.Transaction,
) {
  const id = object.Id;

  /** Category */
  if (object instanceof Category) {
    const snapshot = await Catalog.docRef(businessId)
      .withConverter(Catalog.firestoreConverter).get();
    const catalog = snapshot.data();
    if (catalog) {
      delete catalog.categories[id];
      t.set(snapshot.ref, catalog);
    }
  }

  /** OptionSet */
  if (object instanceof OptionSet) {
    const productConverter = Product.firestoreConverter;
    const fieldPath = `optionSets.${id}.name`;
    const query = Product.collectionRef(businessId)
      .where(fieldPath, '>=', '')
      .withConverter(productConverter);
    const querySnapshots = await t.get(query);

    const catalogSnapshot = await Catalog.docRef(businessId)
      .withConverter(Catalog.firestoreConverter).get();

    // Update the related objects that were successfully queried
    querySnapshots.docs.forEach((snapshot) => {
      const product = snapshot.data();
      if (product.optionSets[id]) {
        delete product.optionSets[id];
      }
      if (product.optionSetsSelection[id]) {
        delete product.optionSetsSelection[id];
      }
      t.set(snapshot.ref, product);
    });

    const catalog = catalogSnapshot.data();
    if (catalog) {
      delete catalog.optionSets[id];
      t.set(catalogSnapshot.ref, catalog);
    }
  }

  /** Option */
  if (object instanceof Option) {
    const fieldPath = `options.${id}.name`;
    const query = OptionSet.collectionRef(businessId)
      .where(fieldPath, '>=', '')
      .withConverter(OptionSet.firestoreConverter);
    const querySnapshots = await t.get(query);

    const catalogSnapshot = await Catalog.docRef(businessId)
      .withConverter(Catalog.firestoreConverter).get();

    // Update the related objects that were successfully queried
    querySnapshots.docs.forEach((snapshot) => {
      const optionSet = snapshot.data();
      if (optionSet.options[id]) {
        delete optionSet.options[id];
      }
      const optionDisplayOrderIndex = optionSet.optionDisplayOrder.indexOf(id);
      if (optionDisplayOrderIndex >= 0) {
        optionSet.optionDisplayOrder.splice(optionDisplayOrderIndex, 1);
      }

      const preselectedOptionIdIndex = optionSet.preselectedOptionIds.indexOf(id);
      if (preselectedOptionIdIndex >= 0) {
        optionSet.preselectedOptionIds.splice(preselectedOptionIdIndex, 1);
      }

      t.set(snapshot.ref, optionSet);
    });

    const catalog = catalogSnapshot.data();
    if (catalog) {
      if (catalog.options[id]) {
        delete catalog.options[id];
        t.set(catalogSnapshot.ref, catalog);
      }
    }
  }

  /** For products */
  if (object instanceof Product) {
    /** Delete menu group, category, attribute relationships */
    // Setup reads first
    // MenuGroups
    const menuGroupQuery = MenuGroup.collectionRef(businessId)
      .where('productDisplayOrder', 'array-contains', id)
      .withConverter(MenuGroup.firestoreConverter);
    const menuGroupQuerySnapshots = await t.get(menuGroupQuery);
    // Category
    const categoryQuery = Category.collectionRef(businessId)
      .where('productDisplayOrder', 'array-contains', id)
      .withConverter(Category.firestoreConverter);
    const categoryQuerySnapshots = await t.get(categoryQuery);
    // End reads

    // Setup writes second
    // Remove from each menu group
    menuGroupQuerySnapshots.docs.forEach((snapshot) => {
      t.update(snapshot.ref, `products.${id}`, firestore.FieldValue.delete());
      t.update(snapshot.ref, 'productDisplayOrder', firestore.FieldValue.arrayRemove(id));
    });

    // Remove from each category group
    categoryQuerySnapshots.docs.forEach((snapshot) => {
      t.update(snapshot.ref, `products.${id}`, firestore.FieldValue.delete());
      t.update(snapshot.ref, 'productDisplayOrder', firestore.FieldValue.arrayRemove(id));
    });

    // TODO delete related option sets and options?
  }

  /** Remove from basic object and it's metadata */
  t.delete(object.collectionRef(businessId).doc(id));

  const metaLinks = object.metaLinks(businessId);
  Object.keys(metaLinks).forEach((key) => {
    const value = metaLinks[key] as string;
    const docRef = firestore.getFirestore().doc(key);

    const fields = { [value]: firestore.FieldValue.delete() };
    t.update(docRef, fields);
  });
}

/**
 * Permanently deletes the object from firestore
 * including all metadata and related objects
 */
export function deleteObject<C extends FirestoreObjectType>(
  object: C,
  businessId: string,
) {
  return firestore.getFirestore()
    .runTransaction(async (t) => deleteT(object, businessId, t));
}

/**
 * Updates the object on firestore
 * NOT including all metadata and related objects
 */
export function updateObject<C extends FirestoreObjectType>(
  object: C,
  data: {},
  businessId: string,
) {
  const ref = object.collectionRef(businessId).doc(object.Id);
  return ref.update(data);
}

export function toReplaceUndefined(object: any) {
  return JSON.parse(JSON.stringify(object, (key, value) => (value === undefined ? null : value)));
}

export function fromReplaceNull(object: any) {
  return JSON.parse(JSON.stringify(object, (key, value) => (value === null ? undefined : value)));
}
