/**
 * FirestoreWriter functions
 * Helps write and delete FirestoreObjectTypes to the db
 */

import { firestoreApp, FieldValue } from '../firebaseApp';
import { Attribute } from '../../restaurant/catalog/v1/Attribute';
import Category from '../../restaurant/catalog/Category';
import { CustomizationSet } from '../../restaurant/catalog/v1/CustomizationSet';
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
import Semaphore from '../../restaurant/vars/Semaphore';
import { Constants } from '../config';
import Locations from '../../restaurant/roots/Locations';
import OptionSet from '../../restaurant/catalog/OptionSet';
import Option from '../../restaurant/catalog/Option';

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
): Promise<FirebaseFirestore.DocumentReference<C>> {
  const id = object.Id;
  const updatedObject = object;
  updatedObject.updated = new Date();
  const metadata = JSON.parse(JSON.stringify(object.metadata()));

  /**
   * Make applicable updates for relationships
   * depending on the type of the object
   */
  /** Attribute */
  if (object instanceof Attribute) {
    // Update Product relationships
    const productConverter = Product.firestoreConverter;
    const fieldPath = `attributes.${id}.name`;
    const query = Product.collectionRef(businessId)
      .where(fieldPath, '>=', '')
      .withConverter(productConverter);
    const querySnapshots = await t.get(query);

    querySnapshots.docs.forEach((snapshot) => {
      t.update(snapshot.ref, `attributes.${id}`, metadata);
    });
  }
  /** Category */
  // if (object instanceof Category) {
  // }
  /** CustomizationSet */
  if (object instanceof CustomizationSet) {
    // Update Product relationships
    const productConverter = Product.firestoreConverter;
    const fieldPath = `customizations.${id}.name`;
    const query = Product.collectionRef(businessId)
      .where(fieldPath, '>=', '')
      .withConverter(productConverter);
    const querySnapshots = await t.get(query);

    // Update the related objects that were successfully queried
    querySnapshots.docs.forEach((snapshot) => {
      t.update(snapshot.ref, `customizations.${id}`, metadata);
    });
  }
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
    menuGroupQuerySnapshots.docs.forEach((snapshot) => {
      t.update(snapshot.ref, `products.${id}`, metadata);
    });

    // Update each category group
    categoryQuerySnapshots.docs.forEach((snapshot) => {
      t.update(snapshot.ref, `products.${id}`, metadata);
    });
  }
  /** OptionSet */
  if (object instanceof OptionSet) {
    const productConverter = Product.firestoreConverter;
    const fieldPath = `optionSets.${id}.name`;
    const query = Product.collectionRef(businessId)
      .where(fieldPath, '>=', '')
      .withConverter(productConverter);
    const querySnapshots = await t.get(query);

    // Update the related objects that were successfully queried
    querySnapshots.docs.forEach((snapshot) => {
      t.update(snapshot.ref, `optionSets.${id}`, metadata);
    });
  }

  /* Option */
  if (object instanceof Option) {
    const optionSetConverter = OptionSet.firestoreConverter;
    const fieldPath = `options.${id}.name`;
    const query = OptionSet.collectionRef(businessId)
      .where(fieldPath, '>=', '')
      .withConverter(optionSetConverter);
    const querySnapshots = await t.get(query);

    // Update the related objects that were successfully queried
    querySnapshots.docs.forEach((snapshot) => {
      t.update(snapshot.ref, `options.${id}`, metadata);
    });
  }

  /** FINALIZE and set basic object and it's metadata */
  t.set(
    object.collectionRef(businessId).doc(id).withConverter(converter),
    updatedObject,
  );

  const metaLinks = object.metaLinks(businessId);

  Object.keys(metaLinks).forEach((key) => {
    const value = metaLinks[key] as string;
    const docRef = firestoreApp.doc(key);

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
    const newCatalog = new Catalog({}, {}, {}, {}, {}, {}, {}, {});
    const newConnectedAccounts = new ConnectedAccounts({});
    const newSurface = new Surfaces({}, {});
    const newOrders = new Orders(true, true, false);
    const newServices = new Services();
    newServices.kioskFeeRate = 1.5;
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
    await setT(newOrders, Orders.firestoreConverter, id, t);
    await setT(newServices, Services.firestoreConverter, id, t);
    await setT(newVar, Vars.firestoreConverter, id, t);
    await setT(newLocations, Locations.firestoreConverter, id, t);

    const catalogUpdateSemaphore = new Semaphore(Constants.Semaphore.catalogUpdate, true);
    await setT(catalogUpdateSemaphore, Semaphore.firestoreConverter, id, t);
    const locationUpdateSemaphore = new Semaphore(Constants.Semaphore.locationUpdate, true);
    await setT(locationUpdateSemaphore, Semaphore.firestoreConverter, id, t);
    const inventoryUpdateSemaphore = new Semaphore(Constants.Semaphore.inventoryUpdate, true);
    await setT(inventoryUpdateSemaphore, Semaphore.firestoreConverter, id, t);
    const orderUpdateSemaphore = new Semaphore(Constants.Semaphore.orderUpdate, true);
    await setT(orderUpdateSemaphore, Semaphore.firestoreConverter, id, t);
    const paymentUpdateSemaphore = new Semaphore(Constants.Semaphore.paymentUpdate, true);
    await setT(paymentUpdateSemaphore, Semaphore.firestoreConverter, id, t);
  }
  return object.collectionRef(businessId).doc(id).withConverter(converter);
}

/**
 * Factory writer to the store
 * Writes this object and it's metadata to the store,
 * and also updates relevant relationships
 */
export function setObject<C extends FirestoreObjectType>(
  object: C,
  converter: FirebaseFirestore.FirestoreDataConverter<C>,
  businessId: string,
) {
  return firestoreApp
    .runTransaction(async (t) => setT(object, converter, businessId, t));
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

  /**
   * Make applicable updates for relationships
   * depending on the type of the object
   */
  /** Attribute */
  // TODO
  // if (object instanceof Attribute) {
  // }
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

  /** CustomizationSet */
  if (object instanceof CustomizationSet) {
    /** Delete Product relationships */
    // Read/find query from firestore
    const productConverter = Product.firestoreConverter;
    const fieldPath = `customizations.${id}.name`;
    const query = Product.collectionRef(businessId)
      .where(fieldPath, '>=', '')
      .withConverter(productConverter);
    const querySnapshots = await t.get(query);

    const catalogSnapshot = await Catalog.docRef(businessId)
      .withConverter(Catalog.firestoreConverter).get();

    // Update the related objects that were successfully queried
    querySnapshots.docs.forEach((snapshot) => {
      const product = snapshot.data();
      if (product.customizations[id]) {
        delete product.customizations[id];
      }
      if (product.customizationsSetting[id]) {
        delete product.customizationsSetting[id];
      }
      t.set(snapshot.ref, product);
    });

    const catalog = catalogSnapshot.data();
    if (catalog) {
      if (catalog.customizationSets[id]) {
        delete catalog.customizationSets[id];
        t.set(catalogSnapshot.ref, catalog);
      }
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
    // Attributes (to delete)
    const attributeIds = Object.keys(object.attributes);
    const attributeDocRefs = attributeIds.map((attributeId) => Attribute.collectionRef(businessId)
      .withConverter(Attribute.firestoreConverter).doc(attributeId));
    if (attributeDocRefs.length > 0) {
      const attributeSnapshots = await t.getAll(...attributeDocRefs);

      // For each attribute snapshot
      attributeSnapshots.forEach((snapshot) => {
        const attribute = snapshot.data() as Attribute;
        if (attribute) {
          deleteT(attribute, businessId, t);
        }
      });
    }

    // End reads

    // Setup writes second
    // Remove from each menu group
    menuGroupQuerySnapshots.docs.forEach((snapshot) => {
      t.update(snapshot.ref, `products.${id}`, FieldValue.delete());
      t.update(snapshot.ref, 'productDisplayOrder', FieldValue.arrayRemove(id));
    });

    // Remove from each category group
    categoryQuerySnapshots.docs.forEach((snapshot) => {
      t.update(snapshot.ref, `products.${id}`, FieldValue.delete());
      t.update(snapshot.ref, 'productDisplayOrder', FieldValue.arrayRemove(id));
    });

    // TODO delete related option sets and options?
  }

  /** Remove from basic object and it's metadata */
  t.delete(object.collectionRef(businessId).doc(id));

  const metaLinks = object.metaLinks(businessId);
  Object.keys(metaLinks).forEach((key) => {
    const value = metaLinks[key] as string;
    const docRef = firestoreApp.doc(key);

    const fields = { [value]: FieldValue.delete() };
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
  return firestoreApp
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
