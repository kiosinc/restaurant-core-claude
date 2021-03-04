import FirestoreObject from '../../firestore-core/core/FirestoreObject';
import { Business } from './Business';
import * as Config from '../../firestore-core/config';

export default class ConnectedAccounts extends FirestoreObject<string> {
  tokens: { [provider: string] : { [key: string]: string } };

  isSync: { [provider: string] : boolean };

  constructor(
    tokens: { [provider: string] : { [key: string]: string } },
    isSync: { [provider: string] : boolean },
    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: string,
  ) {
    super(created, updated, isDeleted, Id ?? Config.Paths.CollectionNames.connectedAccounts);

    this.tokens = tokens;
    this.isSync = isSync;
  }

  collectionRef(businessId: string): FirebaseFirestore.CollectionReference {
    return Business.privateCollectionRef(businessId);
  }

  metaLinks(): { [p: string]: string } {
    return {};
  }

  metadata(): {} {
    return {};
  }

  // STATICS

  static docRef(businessId: string) : FirebaseFirestore.DocumentReference {
    return Business.privateCollectionRef(businessId).doc(Config.Paths.CollectionNames.connectedAccounts);
  }

  static firestoreConverter = {
    toFirestore(connectedAccounts: ConnectedAccounts): FirebaseFirestore.DocumentData {
      return {
        tokens: JSON.parse(JSON.stringify(connectedAccounts.tokens)),
        isSync: JSON.parse(JSON.stringify(connectedAccounts.isSync)),
        created: connectedAccounts.created.toISOString(),
        isDeleted: connectedAccounts.isDeleted,
        updated: connectedAccounts.updated.toISOString(),
      };
    },
    fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): ConnectedAccounts {
      const data = snapshot.data();

      return new ConnectedAccounts(
        data.tokens,
        data.isSync,
        new Date(data.created),
        new Date(data.updated),
        data.isDeleted,
        snapshot.id,
      );
    },
  };
}
