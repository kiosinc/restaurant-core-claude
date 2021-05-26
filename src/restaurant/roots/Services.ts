import FirestoreObject from '../../firestore-core/core/FirestoreObject';
import { Business } from './Business';
import * as Config from '../../firestore-core/config';

export default class Services extends FirestoreObject<string> {
  kioskFeeRate: number;

  constructor(
    kioskFeeRate: number = 0,
    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: string,
  ) {
    super(created, updated, isDeleted, Id ?? Config.Paths.CollectionNames.services);
    this.kioskFeeRate = kioskFeeRate;
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
    return Business.privateCollectionRef(businessId)
      .doc(Config.Paths.CollectionNames.services);
  }

  static firestoreConverter = {
    toFirestore(services: Services): FirebaseFirestore.DocumentData {
      return {
        kioskFeeRate: services.kioskFeeRate,
        created: services.created.toISOString(),
        updated: services.updated.toISOString(),
        isDeleted: services.isDeleted,
      };
    },
    fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): Services {
      const data = snapshot.data();

      return new Services(
        data.kioskFeeRate,
        snapshot.createTime.toDate(),
        snapshot.updateTime.toDate(),
        data.isDeleted,
        snapshot.id,
      );
    },
  };
}
