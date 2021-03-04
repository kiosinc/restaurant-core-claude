/**
 * Category class
 */
import FirestoreObject from '../../firestore-core/core/FirestoreObject';
import LinkedObject from '../../firestore-core/core/LinkedObject';
import ProductMeta from './ProductMeta';
import CategoryMeta from './CategoryMeta';
import Catalog from '../Roots/Catalog';
import * as Config from '../../firestore-core/config';

/**
 * Category class extends FirestoreObject
 * Categories are exclusive groups (organizers) products.
 * A product can have a category, but it's not required.
 */
export default class Category extends FirestoreObject<string> {
  name: string;

  products: { [Id: string]: ProductMeta };

  productDisplayOrder: string[];

  linkedObjects: { [Id: string]: LinkedObject };

  constructor(
    name: string,
    products: { [p: string]: ProductMeta },
    productDisplayOrder: string[],
    linkedObjects: { [p: string]: LinkedObject },
    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: string,
  ) {
    super(created, updated, isDeleted, Id);

    this.name = name;
    this.products = products;
    this.productDisplayOrder = productDisplayOrder;

    this.linkedObjects = linkedObjects;
  }

  // eslint-disable-next-line class-methods-use-this
  collectionRef(businessId: string) {
    return Category.collectionRef(businessId);
  }

  metaLinks(businessId: string): { [p: string]: string } {
    return {
      [Catalog.docRef(businessId).path]: `${Config.Paths.CollectionNames.categories}.${this.Id}`,
    };
  }

  metadata(): CategoryMeta {
    return {
      name: this.name,
    };
  }

  // STATICS THAT SHOULD BE IMPLEMENTED BY ALL FIRESTORE OBJECTS

  /**
   * Category class CollectionReference for given business
   */
  static collectionRef(businessId: string): FirebaseFirestore.CollectionReference {
    return Catalog.docRef(businessId).collection(Config.Paths.CollectionNames.categories);
  }

  /**
   * A converter used to convert object to and from firestore, any
   * '.data' returns an object can can simply be cast with 'as [type]'.
   * Used in conjunction with Firestore collection references or queries.
   */
  static firestoreConverter = {
    toFirestore(category: Category): FirebaseFirestore.DocumentData {
      return {
        name: category.name,
        products: JSON.parse(JSON.stringify(category.products)),
        productDisplayOrder: JSON.parse(JSON.stringify(category.productDisplayOrder)),
        linkedObjects: JSON.parse(JSON.stringify(category.linkedObjects)),
        created: category.created.toISOString(),
        updated: category.updated.toISOString(),
        isDeleted: category.isDeleted,
      };
    },
    fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): Category {
      const data = snapshot.data();

      return new Category(
        data.name,
        data.products,
        data.productDisplayOrder,
        data.linkedObjects,
        new Date(data.created),
        new Date(data.updated),
        data.isDeleted,
        snapshot.id,
      );
    },
  };
}
