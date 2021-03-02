import { FirestoreObject } from "../core/FirestoreObject";
import { LinkedObject } from "../core/LinkedObject";
import { CustomizationSetMeta } from "./CustomizationSet";
import { AttributeMeta } from "./Attribute";
import { Catalog } from "../roots/Catalog";
import { FirestorePaths } from "../../firestore-config/firebaseApp";

export class Product extends FirestoreObject<Id> {
  // The product’s name, meant to be displayable to the customer.
  name: string;
  // A short one-line description of the product, meant to be displayable to the customer.
  caption: string;
  // The product’s description, meant to be displayable to the customer. Use this field to optionally store a long form explanation of the product being sold for your own rendering purposes.
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
    Id?: Id
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

  // FirestoreAdapter

  readonly converter = Product.firestoreConverter;

  collectionRef(businessId: Id): FirebaseFirestore.CollectionReference {
    return Product.collectionRef(businessId);
  }

  metaLinks(businessId: Id): { [p: string]: string } {
    return {
      [Catalog.docRef(businessId).path]:
        FirestorePaths.CollectionNames.products + "." + this.Id,
    };
  }

  metadata(): ProductMeta {
    return {
      name: this.name,
      isActive: this.isActive,
    };
  }

  static collectionRef(businessId: Id): FirebaseFirestore.CollectionReference {
    return Catalog.docRef(businessId).collection(
      FirestorePaths.CollectionNames.products
    );
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
        customizationsSetting: JSON.parse(
          JSON.stringify(product.customizationsSetting)
        ),
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
        snapshot.id
      );
    },
  };
}

export interface ProductMeta {
  name: string;
  isActive: boolean;
}

export interface ProductCustomizationSetting {
  minSelection: number; // TODO can delete and rely on customization set
  maxSelection: number; // TODO can delete and rely on customization set
  preSelected: Id[]; // TODO can delete and rely on customization set
  isActive: boolean;
}
