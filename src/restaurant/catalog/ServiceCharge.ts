import FirestoreObject from '../../firestore-core/core/FirestoreObject'
import LinkedObject from '../../firestore-core/core/LinkedObject'
import Catalog from '../roots/Catalog'
import * as Paths from '../../firestore-core/Paths'

export const enum ServiceChargeType {
  percentage = 'percentage',
  number = 'number',
}

export class ServiceCharge extends FirestoreObject<string> {
  name: string;

  value: number;

  type: ServiceChargeType;

  isCalculatedSubTotalPhase: boolean;

  isTaxable: boolean;

  linkedObjects: { [Id: string]: LinkedObject };

  constructor(
    name: string,
    value: number,
    type: ServiceChargeType,
    isCalculatedSubTotalPhase: boolean,
    isTaxable: boolean,
    linkedObjects: { [Id: string]: LinkedObject },
    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: string,
  ) {
    super(created, updated, isDeleted, Id);
    this.name = name;
    this.value = value;
    this.type = type;
    this.isCalculatedSubTotalPhase = isCalculatedSubTotalPhase;
    this.isTaxable = isTaxable;
    this.linkedObjects = linkedObjects;
  }

  // eslint-disable-next-line class-methods-use-this
  collectionRef(businessId: string): FirebaseFirestore.CollectionReference {
    return ServiceCharge.collectionRef(businessId);
  }

  // eslint-disable-next-line class-methods-use-this
  metaLinks(): { [p: string]: string } {
    return {};
  }

  // eslint-disable-next-line class-methods-use-this
  metadata(): Record<string, never> {
    return {};
  }

  // STATICS

  static collectionRef(businessId: string): FirebaseFirestore.CollectionReference {
    return Catalog.docRef(businessId).collection(Paths.CollectionNames.taxRates);
  }

  static firestoreConverter = {
    toFirestore(charge: ServiceCharge): FirebaseFirestore.DocumentData {
      return {
        name: charge.name,
        rate: charge.value,
        type: charge.type,
        isCalculatedSubTotalPhase: charge.isCalculatedSubTotalPhase,
        isTaxable: charge.isTaxable,
        linkedObjects: JSON.parse(JSON.stringify(charge.linkedObjects)),
        created: charge.created.toISOString(),
        updated: charge.updated.toISOString(),
        isDeleted: charge.isDeleted,
      };
    },
    fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): ServiceCharge {
      const data = snapshot.data();

      return new ServiceCharge(
        data.name,
        data.value,
        data.type,
        data.isCalculatedSubTotalPhase,
        data.isTaxable,
        data.linkedObjects,
        new Date(data.created),
        new Date(data.updated),
        data.isDeleted,
        snapshot.id,
      );
    },
  };
}
