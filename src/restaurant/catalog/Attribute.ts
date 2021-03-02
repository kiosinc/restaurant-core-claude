import { FirestoreObject } from '../core/FirestoreObject';
import { LinkedObject } from '../core/LinkedObject';
import { Catalog } from '../roots/Catalog';
import { FirestorePaths } from '../../firebaseApp';

export class Attribute extends FirestoreObject<Id> {
  name: string;
  values: { [Id: string]: AttributeValue };

  displayOrder: number;
  isActive: boolean;

  linkedObjects: { [Id: string]: LinkedObject };

  constructor(
    name: string,
    values: { [p: string]: AttributeValue },
    displayOrder: number,
    isActive: boolean,
    linkedObjects: { [p: string]: LinkedObject },
    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: Id,
  ) {
    super(created, updated, isDeleted, Id);
    this.name = name;
    this.values = values;

    this.displayOrder = displayOrder;
    this.isActive = isActive;

    this.linkedObjects = linkedObjects;
  }

  // FirestoreAdapter

  readonly converter = Attribute.firestoreConverter;

  collectionRef(businessId: Id): FirebaseFirestore.CollectionReference {
    return Attribute.collectionRef(businessId);
  }

  metaLinks(businessId: Id): { [p: string]: string } {
    return {
      [Catalog.docRef(businessId).path]: FirestorePaths.CollectionNames.attributes + '.' + this.Id,
    };
  }

  metadata(): AttributeMeta {
    return {
      name: this.name,
      isActive: this.isActive,
      displayOrder: this.displayOrder,
    };
  }

  // STATICS

  static collectionRef(businessId: Id): FirebaseFirestore.CollectionReference {
    return Catalog.docRef(businessId).collection(FirestorePaths.CollectionNames.attributes);
  }

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
    fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): Attribute {
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

export interface AttributeMeta {
  name: string;
  isActive: boolean;
  displayOrder: number;
}

export interface AttributeValue {
  name: string;
  price: number;

  displayOrder: number;
  isPreSelected: boolean;
  isActive: boolean;

  linkedObjects: { [Id: string]: LinkedObject };
}
