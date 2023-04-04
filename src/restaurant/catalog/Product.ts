/**
 * Product class
 */
import FirestoreObject from '../../firestore-core/core/FirestoreObject'
import LinkedObject from '../../firestore-core/core/LinkedObject'
import ProductMeta from './ProductMeta'
import Catalog from '../roots/Catalog'
import OptionSetMeta from './OptionSetMeta'
import {
  InventoryCount,
  LocationInventoryFromFirestore,
  LocationInventoryToFirestore,
} from './InventoryCount'
import * as Paths from '../../firestore-core/Paths'

export class Product extends FirestoreObject<string> {
  // The product’s name, meant to be displayable to the customer.
  name: string;

  caption: string;

  description: string;

  // A list of URLs of images for this product, meant to be displayable to the customer.
  imageUrls: URL[];

  // Product data

  optionSets: { [p: string]: OptionSetMeta };

  optionSetsSelection: { [Id: string]: ProductOptionSetSetting };
  // TODO: this should be at the optionset level not product

  locationInventory: { [p: string]: InventoryCount };

  // Whether the product is currently available for purchase.
  isActive: boolean;

  linkedObjects: { [Id: string]: LinkedObject };

  constructor(
    name: string,
    caption: string,
    description: string,
    imageUrls: URL[],
    optionSets: { [p: string]: OptionSetMeta },
    optionSetsSelection: { [Id: string]: ProductOptionSetSetting },
    locationInventory: { [p: string]: InventoryCount },
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
    this.optionSets = optionSets;
    this.optionSetsSelection = optionSetsSelection;
    this.locationInventory = locationInventory;
    this.isActive = isActive;
    this.linkedObjects = linkedObjects;
  }

  // eslint-disable-next-line class-methods-use-this
  collectionRef(businessId: string): FirebaseFirestore.CollectionReference {
    return Product.collectionRef(businessId);
  }

  metaLinks(businessId: string): { [p: string]: string } {
    return {
      [Catalog.docRef(businessId).path]: `${Paths.CollectionNames.products}.${this.Id}`,
    };
  }

  metadata(): ProductMeta {
    return {
      name: this.name,
      isActive: this.isActive,
    };
  }

  static collectionRef(businessId: string): FirebaseFirestore.CollectionReference {
    return Catalog.docRef(businessId).collection(Paths.CollectionNames.products);
  }

  static firestoreConverter = {
    toFirestore(product: Product): FirebaseFirestore.DocumentData {
      return {
        name: product.name,
        caption: product.caption,
        description: product.description,
        imageUrls: JSON.parse(JSON.stringify(product.imageUrls)),
        optionSets: JSON.parse(JSON.stringify(product.optionSets ?? {})),
        optionSetsSelection: JSON.parse(JSON.stringify(product.optionSetsSelection)),
        locationInventory:
          JSON.parse(JSON.stringify(LocationInventoryToFirestore(product.locationInventory))),
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
        data.optionSets ?? {},
        data.optionSetsSelection ?? {},
        LocationInventoryFromFirestore(data.locationInventory),
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

export interface ProductOptionSetSetting {
  minSelection: number
  maxSelection: number
  preSelected: string[]
  isActive: boolean
}
