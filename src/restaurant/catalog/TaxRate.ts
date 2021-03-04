import FirestoreObject from '../../firestore-core/core/FirestoreObject';
import LinkedObject from '../../firestore-core/core/LinkedObject';
import Catalog from '../roots/Catalog';
import * as Config from '../../firestore-core/config';
import TaxRateMeta from './TaxRateMeta';

export default class TaxRate extends FirestoreObject<string> {
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
    Id?: string,
  ) {
    super(created, updated, isDeleted, Id);
    this.name = name;
    this.rate = rate;
    this.isCalculatedSubTotalPhase = isCalculatedSubTotalPhase;
    this.isInclusive = isInclusive;
    this.linkedObjects = linkedObjects;
  }

  // eslint-disable-next-line class-methods-use-this
  collectionRef(businessId: string): FirebaseFirestore.CollectionReference {
    return TaxRate.collectionRef(businessId);
  }

  metaLinks(businessId: string): { [p: string]: string } {
    return {
      [Catalog.docRef(businessId).path]: `${Config.Paths.CollectionNames.taxRates}.${this.Id}`,
    };
  }

  metadata(): TaxRateMeta {
    return {
      name: this.name,
      rate: this.rate,
    };
  }

  // STATICS

  static collectionRef(businessId: string): FirebaseFirestore.CollectionReference {
    return Catalog.docRef(businessId).collection(Config.Paths.CollectionNames.taxRates);
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
