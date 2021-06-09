/**
 * Product class
 */
import FirestoreObject from '../../firestore-core/core/FirestoreObject';
import LinkedObject from '../../firestore-core/core/LinkedObject';
import * as Config from '../../firestore-core/config';
import ProductMeta from './ProductMeta';
import CustomizationSetMeta from './CustomizationSetMeta';
import AttributeMeta from './AttributeMeta';
import Catalog from '../roots/Catalog';

export class Product extends FirestoreObject<string> {
  // The product’s name, meant to be displayable to the customer.
  name: string;

  caption: string;

  description: string;

  // A list of URLs of images for this product, meant to be displayable to the customer.
  imageUrls: URL[];

  // Product data
  attributes: { [Id: string]: AttributeMeta };

  customizations: { [Id: string]: CustomizationSetMeta };

  customizationsSetting: { [Id: string]: ProductCustomizationSetting };

  // Whether the product is currently available for purchase.
  isActive: boolean;

  linkedObjects: { [Id: string]: LinkedObject };

  constructor(
    name: string,
    caption: string,
    description: string,
    imageUrls: URL[],
    attributes: { [p: string]: AttributeMeta },
    customizations: { [p: string]: CustomizationSetMeta },
    customizationsSetting: { [p: string]: ProductCustomizationSetting },
    isActive: boolean,
    linkedObjects: { [p: string]: LinkedObject },
    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: string,
  ) {
    super(created, updated, isDeleted, Id);
    this.name = name;
    this.caption = caption;
    this.description = description;
    this.imageUrls = imageUrls;
    this.attributes = attributes;
    this.customizations = customizations;
    this.customizationsSetting = customizationsSetting;
    this.isActive = isActive;
    this.linkedObjects = linkedObjects;
  }

  // eslint-disable-next-line class-methods-use-this
  collectionRef(businessId: string): FirebaseFirestore.CollectionReference {
    return Product.collectionRef(businessId);
  }

  metaLinks(businessId: string): { [p: string]: string } {
    return {
      [Catalog.docRef(businessId).path]: `${Config.Paths.CollectionNames.products}.${this.Id}`,
    };
  }

  metadata(): ProductMeta {
    return {
      name: this.name,
      isActive: this.isActive,
    };
  }

  static collectionRef(businessId: string): FirebaseFirestore.CollectionReference {
    return Catalog.docRef(businessId).collection(Config.Paths.CollectionNames.products);
  }

  static firestoreConverter = {
    toFirestore(product: Product): FirebaseFirestore.DocumentData {
      return {
        name: product.name,
        caption: product.caption,
        description: product.description,
        imageUrls: JSON.parse(JSON.stringify(product.imageUrls)),
        attributes: JSON.parse(JSON.stringify(product.attributes)),
        customizations: JSON.parse(JSON.stringify(product.customizations)),
        customizationsSetting: JSON.parse(JSON.stringify(product.customizationsSetting)),
        isActive: product.isActive,
        linkedObjects: JSON.parse(JSON.stringify(product.linkedObjects)),
        created: product.created.toISOString(),
        updated: product.updated.toISOString(),
        isDeleted: product.isDeleted,
      };
    },
    fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): Product {
      const data = snapshot.data();
      return new Product(
        data.name,
        data.caption,
        data.description,
        data.imageUrls,
        data.attributes,
        data.customizations,
        data.customizationsSetting,
        data.isActive,
        data.linkedObjects,
        new Date(data.created),
        new Date(data.updated),
        data.isDeleted,
        snapshot.id,
      );
    },
  };
}

export interface ProductCustomizationSetting {
  minSelection: number // TODO can delete and rely on customization set
  maxSelection: number // TODO can delete and rely on customization set
  preSelected: string[] // TODO can delete and rely on customization set
  isActive: boolean
}
