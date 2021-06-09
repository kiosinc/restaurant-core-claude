/**
 * Attribute class
 */
import FirestoreObject from '../../firestore-core/core/FirestoreObject';
import LinkedObject from '../../firestore-core/core/LinkedObject';
import Catalog from '../roots/Catalog';
import * as Config from '../../firestore-core/config';
import AttributeMeta from './AttributeMeta';

/**
 * Attribute class extends FirestoreObject
 * Attributes are base options for a product, which must have at least one.
 * Each attribute can have multiple options.  One must be selected
 */
export class Attribute extends FirestoreObject<string> {
  name: string;

  values: { [Id: string]: AttributeValue };

  displayOrder: number;

  isActive: boolean;

  linkedObjects: { [Id: string]: LinkedObject };

  /**
   * Create an Attribute
   */
  constructor(
    name: string,
    values: { [p: string]: AttributeValue },
    displayOrder: number,
    isActive: boolean,
    linkedObjects: { [p: string]: LinkedObject },
    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: string,
  ) {
    super(created, updated, isDeleted, Id);
    this.name = name;
    this.values = values;

    this.displayOrder = displayOrder;
    this.isActive = isActive;

    this.linkedObjects = linkedObjects;
  }

  // FirestoreAdapter

  // eslint-disable-next-line class-methods-use-this
  collectionRef(businessId: string): FirebaseFirestore.CollectionReference {
    return Attribute.collectionRef(businessId);
  }

  metaLinks(businessId: string): { [p: string]: string } {
    const field = `${Config.Paths.CollectionNames.attributes}.${this.Id}`;
    return {
      [Catalog.docRef(businessId).path]: field,
    };
  }

  metadata(): AttributeMeta {
    return {
      name: this.name,
      isActive: this.isActive,
      displayOrder: this.displayOrder,
    };
  }

  // STATICS THAT SHOULD BE IMPLEMENTED BY ALL FIRESTORE OBJECTS

  /**
   * Attribute class CollectionReference for given business
   */
  static collectionRef(businessId: string): FirebaseFirestore.CollectionReference {
    return Catalog.docRef(businessId).collection(
      Config.Paths.CollectionNames.attributes,
    );
  }

  /**
   * A converter used to convert object to and from firestore, any
   * '.data' returns an object can can simply be cast with 'as [type]'.
   * Used in conjunction with Firestore collection references or queries.
   */
  static firestoreConverter = {
    toFirestore(attribute: Attribute): FirebaseFirestore.DocumentData {
      return {
        // businessId: attribute.businessId,
        name: attribute.name,
        values: JSON.parse(JSON.stringify(attribute.values)),
        displayOrder: attribute.displayOrder,
        isActive: attribute.isActive,
        linkedObjects: JSON.parse(JSON.stringify(attribute.linkedObjects)),
        created: attribute.created.toISOString(),
        updated: attribute.updated.toISOString(),
        isDeleted: attribute.isDeleted,
      };
    },
    fromFirestore(
      snapshot: FirebaseFirestore.QueryDocumentSnapshot,
    ): Attribute {
      const data = snapshot.data();
      return new Attribute(
        data.name,
        data.values,
        data.displayOrder,
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

export interface AttributeValue {
  name: string;
  price: number;

  displayOrder: number;
  isPreSelected: boolean;
  isActive: boolean;

  linkedObjects: { [Id: string]: LinkedObject };
}
