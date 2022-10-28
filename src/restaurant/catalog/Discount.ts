/**
 * Discount class
 */
import FirestoreObject from '../../firestore-core/core/FirestoreObject';
import LinkedObject from '../../firestore-core/core/LinkedObject';
import Catalog from '../roots/Catalog';
import * as Config from '../../firestore-core/config';

export const enum DiscountType {
  percentage = 'percentage',
  amount = 'amount',
  unknown = 'unknown',
}

/**
 * Discount class extends FirestoreObject
 * Discounts apply to products
 */
export class Discount extends FirestoreObject<string> {
  name: string;

  description: string;

  couponCode: string;

  type: DiscountType;

  value: number;

  isActive: boolean;

  linkedObjects: { [Id: string]: LinkedObject };

  /**
   * Create an Attribute
   */
  constructor(
    name: string,
    description: string,
    couponCode: string,
    type: DiscountType,
    value: number,
    isActive: boolean,
    linkedObjects: { [p: string]: LinkedObject },
    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: string,
  ) {
    super(created, updated, isDeleted, Id);
    this.name = name;
    this.description = description;
    this.couponCode = couponCode;
    this.type = type;
    this.value = value;
    this.isActive = isActive;
    this.linkedObjects = linkedObjects;
  }

  // FirestoreAdapter

  // eslint-disable-next-line class-methods-use-this
  collectionRef(businessId: string): FirebaseFirestore.CollectionReference {
    return Discount.collectionRef(businessId);
  }

  // eslint-disable-next-line class-methods-use-this
  metaLinks(): { [p: string]: string } {
    return {};
  }

  // eslint-disable-next-line class-methods-use-this
  metadata(): {} {
    return {};
  }

  // STATICS THAT SHOULD BE IMPLEMENTED BY ALL FIRESTORE OBJECTS

  /**
   * Discount class CollectionReference for given business
   */
  static collectionRef(businessId: string): FirebaseFirestore.CollectionReference {
    return Catalog.docRef(businessId).collection(
      Config.Paths.CollectionNames.discounts,
    );
  }

  /**
   * A converter used to convert object to and from firestore, any
   * '.data' returns an object can can simply be cast with 'as [type]'.
   * Used in conjunction with Firestore collection references or queries.
   */
  static firestoreConverter = {
    toFirestore(discount: Discount): FirebaseFirestore.DocumentData {
      return {
        // businessId: attribute.businessId,
        name: discount.name,
        description: discount.description,
        couponCode: discount.couponCode,
        type: discount.type,
        value: discount.value,
        isActive: discount.isActive,
        linkedObjects: JSON.parse(JSON.stringify(discount.linkedObjects)),
        created: discount.created.toISOString(),
        updated: discount.updated.toISOString(),
        isDeleted: discount.isDeleted,
      };
    },
    fromFirestore(
      snapshot: FirebaseFirestore.QueryDocumentSnapshot,
    ): Discount {
      const data = snapshot.data();
      return new Discount(
        data.name as string,
        data.description as string,
        data.couponCode as string,
        data.type as DiscountType,
        data.value as number,
        data.isActive as boolean,
        data.linkedObjects,
        new Date(data.created),
        new Date(data.updated),
        data.isDeleted,
        snapshot.id,
      );
    },
  };
}
