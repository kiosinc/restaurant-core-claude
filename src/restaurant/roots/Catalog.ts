import FirestoreObject from '../../firestore-core/core/FirestoreObject';
import { Business } from './Business';
import * as Config from '../../firestore-core/config';
import ProductMeta from '../catalog/ProductMeta';
import TaxRateMeta from '../catalog/TaxRateMeta';
import CustomizationSetMeta from '../catalog/CustomizationSetMeta';
import AttributeMeta from '../catalog/AttributeMeta';
import CategoryMeta from '../catalog/CategoryMeta';
import DiscountMeta from '../catalog/DiscountMeta';

const catalogKey = Config.Paths.CollectionNames.catalog;

export default class Catalog extends FirestoreObject<string> {
  categories: { [Id: string]: CategoryMeta };

  customizationSets: { [Id: string]: CustomizationSetMeta };

  products: { [Id: string]: ProductMeta };

  taxRates: { [Id: string]: TaxRateMeta };

  attributes: { [Id: string]: AttributeMeta };

  discounts: { [Id: string]: DiscountMeta };

  constructor(
    categories: { [p: string]: CategoryMeta },
    attributes: { [Id: string]: AttributeMeta } = {},
    customizationSets: { [p: string]: CustomizationSetMeta },
    products: { [p: string]: ProductMeta },
    taxRates: { [p: string]: TaxRateMeta },
    discounts: { [p: string]: DiscountMeta },
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
    this.discounts = discounts;
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
        discounts: JSON.parse(JSON.stringify(catalog.discounts)),
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
        data.discounts,
        snapshot.createTime.toDate(),
        snapshot.updateTime.toDate(),
        data.isDeleted,
        snapshot.id,
      );
    },
  };
}
