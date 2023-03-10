import FirestoreObject from '../../firestore-core/core/FirestoreObject';
import LinkedObject from '../../firestore-core/core/LinkedObject';
import Catalog from '../roots/Catalog';
import * as Config from '../../firestore-core/config';
import {
  InventoryCount,
  LocationInventoryFromFirestore,
  LocationInventoryToFirestore,
} from './InventoryCount';
import OptionMeta from './OptionMeta';

export default class Option extends FirestoreObject<string> {
  name: string;

  // The additional cost of the attribute as an integer in the smallest currency unit.
  price: number;

  sku: string | null;

  imageUrls: URL[];

  locationPrices: { [locationId: string]: number };

  locationInventory: { [p: string]: InventoryCount };

  isActive: boolean;

  linkedObjects: { [Id: string]: LinkedObject };

  constructor(
    name: string,
    price: number,
    sku: string | null,
    imageUrls: URL[],
    locationPrices: { [locationId: string]: number },
    locationInventory: { [locationId: string]: InventoryCount },
    isActive: boolean,
    linkedObjects: { [p: string]: LinkedObject },
    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: string,
  ) {
    super(created, updated, isDeleted, Id);

    this.name = name;
    this.price = price;
    this.sku = sku;
    this.imageUrls = imageUrls;
    this.locationPrices = locationPrices;
    this.locationInventory = locationInventory;
    this.isActive = isActive;
    this.linkedObjects = linkedObjects;
  }

  // eslint-disable-next-line class-methods-use-this
  collectionRef(businessId: string) {
    return Option.collectionRef(businessId);
  }

  // eslint-disable-next-line class-methods-use-this
  metaLinks(): { [p: string]: string } {
    return {};
  }

  metadata(): OptionMeta {
    return {
      name: this.name,
      isActive: this.isActive,
    };
  }

  // STATICS THAT SHOULD BE IMPLEMENTED BY ALL FIRESTORE OBJECTS

  /**
   * CustomizationSet class CollectionReference for given business
   */
  static collectionRef(businessId: string): FirebaseFirestore.CollectionReference {
    return Catalog.docRef(businessId).collection(Config.Paths.CollectionNames.options);
  }

  /**
   * A converter used to convert object to and from firestore, any
   * '.data' returns an object can can simply be cast with 'as [type]'.
   * Used in conjunction with Firestore collection references or queries.
   */
  static firestoreConverter = {
    toFirestore(option: Option): FirebaseFirestore.DocumentData {
      return {
        name: option.name,
        price: option.price,
        sku: option.sku,
        imageUrls: JSON.parse(JSON.stringify(option.imageUrls)),
        locationPrices: JSON.parse(JSON.stringify(option.locationPrices)),
        locationInventory:
          JSON.parse(JSON.stringify(LocationInventoryToFirestore(option.locationInventory))),
        isActive: option.isActive,
        linkedObjects: JSON.parse(JSON.stringify(option.linkedObjects)),
        created: option.created.toISOString(),
        updated: option.updated.toISOString(),
        isDeleted: option.isDeleted,
      };
    },
    fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): Option {
      const data = snapshot.data();
      return new Option(
        data.name,
        data.price,
        data.sku ?? null,
        data.imageUrls ?? [],
        data.locationPrices,
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
