import FirestoreObject from '../../firestore-core/core/FirestoreObject';
import { Business } from './Business';
import * as Config from '../../firestore-core/config';
import ProductMeta from '../catalog/ProductMeta';
import CategoryMeta from '../catalog/CategoryMeta';

const catalogKey = Config.Paths.CollectionNames.catalog;

export default class Catalog extends FirestoreObject<string> {
  categories: { [Id: string]: CategoryMeta };

  products: { [Id: string]: ProductMeta };

  // TODO remove
  taxRates: { [Id: string]: { } };

  discounts: { [Id: string]: { } };

  optionSets: { [Id: string]: { } };

  options: { [Id: string]: { } };

  constructor(
    categories: { [p: string]: CategoryMeta },
    products: { [p: string]: ProductMeta },
    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: string,
  ) {
    super(created, updated, isDeleted, Id ?? catalogKey);

    this.categories = categories;
    this.products = products;
    this.taxRates = {};
    this.discounts = {};
    this.optionSets = {};
    this.options = {};
  }

  // eslint-disable-next-line class-methods-use-this
  collectionRef(businessId: string): FirebaseFirestore.CollectionReference {
    return Business.publicCollectionRef(businessId);
  }

  // eslint-disable-next-line class-methods-use-this
  metaLinks(): { [p: string]: string } {
    return {};
  }

  // eslint-disable-next-line class-methods-use-this
  metadata(): {} {
    return {};
  }

  // STATICS

  static docRef(businessId: string) : FirebaseFirestore.DocumentReference {
    return Business.publicCollectionRef(businessId).doc(catalogKey);
  }

  static firestoreConverter = {
    toFirestore(catalog: Catalog): FirebaseFirestore.DocumentData {
      return {
        categories: JSON.parse(JSON.stringify(catalog.categories)),
        products: JSON.parse(JSON.stringify(catalog.products)),
        taxRates: {},
        discounts: {},
        optionSets: {},
        options: {},
        created: catalog.created.toISOString(),
        updated: catalog.updated.toISOString(),
        isDeleted: catalog.isDeleted,
      };
    },
    fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): Catalog {
      const data = snapshot.data();

      return new Catalog(
        data.categories,
        data.products,
        new Date(data.created),
        new Date(data.updated),
        data.isDeleted,
        snapshot.id,
      );
    },
  };
}
