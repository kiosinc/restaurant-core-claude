import FirestoreObject from '../../firestore-core/core/FirestoreObject';
import { Business } from './Business';
import * as Config from '../../firestore-core/config';
import ProductMeta from '../catalog/ProductMeta';
import TaxRateMeta from '../catalog/TaxRateMeta';
import CustomizationSetMeta from '../catalog/v1/CustomizationSetMeta';
import AttributeMeta from '../catalog/v1/AttributeMeta';
import CategoryMeta from '../catalog/CategoryMeta';
import DiscountMeta from '../catalog/DiscountMeta';
import OptionSetMeta from '../catalog/OptionSetMeta';
import OptionMeta from '../catalog/OptionMeta';

const catalogKey = Config.Paths.CollectionNames.catalog;

export default class Catalog extends FirestoreObject<string> {
  categories: { [Id: string]: CategoryMeta };

  customizationSets: { [Id: string]: CustomizationSetMeta }; // TODO: delete

  products: { [Id: string]: ProductMeta };

  taxRates: { [Id: string]: TaxRateMeta };

  attributes: { [Id: string]: AttributeMeta }; // TODO: delete

  discounts: { [Id: string]: DiscountMeta };

  optionSets: { [Id: string]: OptionSetMeta };

  options: { [Id: string]: OptionMeta };

  constructor(
    categories: { [p: string]: CategoryMeta },
    attributes: { [Id: string]: AttributeMeta } = {},
    customizationSets: { [p: string]: CustomizationSetMeta },
    products: { [p: string]: ProductMeta },
    taxRates: { [p: string]: TaxRateMeta },
    discounts: { [p: string]: DiscountMeta },
    optionSets: { [Id: string]: OptionSetMeta },
    options: { [Id: string]: OptionMeta },
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
    this.optionSets = optionSets;
    this.options = options;
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
        customizationSets: JSON.parse(JSON.stringify(catalog.customizationSets)),
        attributes: JSON.parse(JSON.stringify(catalog.attributes)),
        products: JSON.parse(JSON.stringify(catalog.products)),
        taxRates: JSON.parse(JSON.stringify(catalog.taxRates)),
        discounts: JSON.parse(JSON.stringify(catalog.discounts)),
        optionSets: JSON.parse(JSON.stringify(catalog.optionSets)),
        options: JSON.parse(JSON.stringify(catalog.options)),
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
        data.discounts,
        data.optionSets,
        data.options,
        new Date(data.created),
        new Date(data.updated),
        data.isDeleted,
        snapshot.id,
      );
    },
  };
}
