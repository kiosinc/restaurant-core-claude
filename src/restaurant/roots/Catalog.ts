import FirestoreObject from '../../firestore-core/core/FirestoreObject';
import { Business } from './Business';
import * as Config from '../../firestore-core/config';
import ProductMeta from '../Catalog/ProductMeta';
import TaxRateMeta from '../Catalog/TaxRateMeta';
import CustomizationSetMeta from '../catalog/CustomizationSetMeta';
import AttributeMeta from '../catalog/AttributeMeta';
import CategoryMeta from '../catalog/CategoryMeta';

const catalogKey = Config.Paths.CollectionNames.catalog;

export default class Catalog extends FirestoreObject<string> {
  categories: { [Id: string]: CategoryMeta };

  customizationSets: { [Id: string]: CustomizationSetMeta };

  products: { [Id: string]: ProductMeta };

  taxRates: { [Id: string]: TaxRateMeta };

  attributes: { [Id: string]: AttributeMeta };

  constructor(
    categories: { [p: string]: CategoryMeta },
    attributes: { [Id: string]: AttributeMeta } = {},
    customizationSets: { [p: string]: CustomizationSetMeta },
    products: { [p: string]: ProductMeta },
    taxRates: { [p: string]: TaxRateMeta },
    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: string,
  ) {
    super(created, updated, isDeleted, Id ?? catalogKey);

    this.categories = categories;
    this.attributes = attributes;
    this.customizationSets = customizationSets;
    this.products = products;
    this.taxRates = taxRates;
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
    return Business.publicCollectionRef(businessId).doc(Config.Paths.CollectionNames.catalog);
  }

  static firestoreConverter = {
    toFirestore(catalog: Catalog): FirebaseFirestore.DocumentData {
      return {
        categories: JSON.parse(JSON.stringify(catalog.categories)),
        customizationSets: JSON.parse(JSON.stringify(catalog.customizationSets)),
        attributes: JSON.parse(JSON.stringify(catalog.attributes)),
        products: JSON.parse(JSON.stringify(catalog.products)),
        taxRates: JSON.parse(JSON.stringify(catalog.taxRates)),
        created: catalog.created.toISOString(),
        updated: catalog.updated.toISOString(),
        isDeleted: catalog.isDeleted,
      };
    },
    fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): Catalog {
      const data = snapshot.data();

      return new Catalog(
        data.categories,
        data.attributes,
        data.customizationsSets,
        data.products,
        data.taxRates,
        new Date(data.created),
        new Date(data.updated),
        data.isDeleted,
        snapshot.id,
      );
    },
  };
}
