import { FirestoreObject } from '../core/FirestoreObject';
import { LinkedObject } from '../core/LinkedObject';
import { Catalog } from '../roots/Catalog';
import { FirestorePaths } from '../../firestore-config/firebaseApp';

export class TaxRate extends FirestoreObject<Id> {
  name: string;
  rate: number;
  isCalculatedSubTotalPhase: boolean;
  isInclusive: boolean;
  linkedObjects: { [Id: string]: LinkedObject };

  constructor(
    name: string,
    rate: number,
    isCalculatedSubTotalPhase: boolean,
    isInclusive: boolean,
    linkedObjects: { [Id: string]: LinkedObject },
    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: Id,
  ) {
    super(created, updated, isDeleted, Id);
    this.name = name;
    this.rate = rate;
    this.isCalculatedSubTotalPhase = isCalculatedSubTotalPhase;
    this.isInclusive = isInclusive;
    this.linkedObjects = linkedObjects;
  }

  readonly converter = TaxRate.firestoreConverter;

  collectionRef(businessId: Id): FirebaseFirestore.CollectionReference {
    return TaxRate.collectionRef(businessId);
  }

  metaLinks(businessId: Id): { [p: string]: string } {
    return {
      [Catalog.docRef(businessId).path]: FirestorePaths.CollectionNames.taxRates + '.' + this.Id,
    };
  }

  metadata(): TaxRateMeta {
    return {
      name: this.name,
      rate: this.rate,
    };
  }

  // STATICS

  static collectionRef(businessId: Id): FirebaseFirestore.CollectionReference {
    return Catalog.docRef(businessId).collection(FirestorePaths.CollectionNames.taxRates);
  }

  static firestoreConverter = {
    toFirestore(taxRate: TaxRate): FirebaseFirestore.DocumentData {
      return {
        name: taxRate.name,
        rate: taxRate.rate,
        isCalculatedSubTotalPhase: taxRate.isCalculatedSubTotalPhase,
        isInclusive: taxRate.isInclusive,
        linkedObjects: JSON.parse(JSON.stringify(taxRate.linkedObjects)),
        created: taxRate.created.toISOString(),
        updated: taxRate.updated.toISOString(),
        isDeleted: taxRate.isDeleted,
      };
    },
    fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): TaxRate {
      const data = snapshot.data();

      return new TaxRate(
        data.name,
        data.rate,
        data.isCalculatedSubTotalPhase,
        data.isInclusive,
        data.linkedObjects,
        new Date(data.created),
        new Date(data.updated),
        data.isDeleted,
        snapshot.id,
      );
    },
  };
}

export interface TaxRateMeta {
  name: string;
  rate: number;
}
