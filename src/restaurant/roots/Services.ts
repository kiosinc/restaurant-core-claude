import FirestoreObject from '../../firestore-core/core/FirestoreObject';
import { Business } from './Business';
import * as Config from '../../firestore-core/config';

const servicesKey = Config.Paths.CollectionNames.services;

export default class Services extends FirestoreObject<string> {
  kioskFeeRate: number;

  experiments: { [key: string]: boolean };

  constructor(
    kioskFeeRate: number | null,
    experiments: { string: boolean } | null,
    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: string,
  ) {
    super(created, updated, isDeleted, Id ?? servicesKey);
    this.kioskFeeRate = kioskFeeRate ?? 1.5;
    this.experiments = experiments ?? {};
  }

  // eslint-disable-next-line class-methods-use-this
  collectionRef(businessId: string): FirebaseFirestore.CollectionReference {
    return Business.privateCollectionRef(businessId);
  }

  // eslint-disable-next-line class-methods-use-this
  metaLinks(): { [p: string]: string } {
    return {};
  }

  // eslint-disable-next-line class-methods-use-this
  metadata(): {} {
    return {};
  }

  // STATICS

  static docRef(businessId: string) : FirebaseFirestore.DocumentReference {
    return Business.privateCollectionRef(businessId).doc(servicesKey);
  }

  static firestoreConverter = {
    toFirestore(services: Services): FirebaseFirestore.DocumentData {
      return {
        kioskFeeRate: services.kioskFeeRate,
        experiments: services.experiments,
        created: services.created.toISOString(),
        updated: services.updated.toISOString(),
        isDeleted: services.isDeleted,
      };
    },
    fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): Services {
      const data = snapshot.data();

      return new Services(
        data.kioskFeeRate,
        data.experiments ?? null,
        new Date(data.created),
        new Date(data.updated),
        data.isDeleted,
        snapshot.id,
      );
    },
  };
}
