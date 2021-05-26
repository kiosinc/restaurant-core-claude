import FirestoreObject from '../../firestore-core/core/FirestoreObject';
import { Business } from './Business';
import * as Config from '../../firestore-core/config';

export default class Vars extends FirestoreObject<string> {
  constructor(
    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: string,
  ) {
    super(created, updated, isDeleted, Id ?? Config.Paths.CollectionNames.vars);
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
      .doc(Config.Paths.CollectionNames.vars);
  }

  static firestoreConverter = {
    toFirestore(connectedAccounts: Vars): FirebaseFirestore.DocumentData {
      return {
        isDeleted: connectedAccounts.isDeleted,
      };
    },
    fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): Vars {
      const data = snapshot.data();
      return new Vars(
        snapshot.createTime.toDate(),
        snapshot.updateTime.toDate(),
        data.isDeleted,
        snapshot.id,
      );
    },
  };
}
