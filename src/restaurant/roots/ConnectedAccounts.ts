import FirestoreObject from '../../firestore-core/core/FirestoreObject'
import { Business } from './Business'
import * as Paths from '../../firestore-core/Paths'

const connectedAccountsKey = Paths.CollectionNames.connectedAccounts;

export default class ConnectedAccounts extends FirestoreObject<string> {
  tokens: { [provider: string] : { [key: string]: string } };

  constructor(
    tokens: { [provider: string] : { [key: string]: string } },
    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: string,
  ) {
    super(created, updated, isDeleted, Id ?? connectedAccountsKey);

    this.tokens = tokens;
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
  metadata(): Record<string, never> {
    return {};
  }

  // STATICS

  static docRef(businessId: string) : FirebaseFirestore.DocumentReference {
    return Business.privateCollectionRef(businessId).doc(connectedAccountsKey);
  }

  static firestoreConverter = {
    toFirestore(connectedAccounts: ConnectedAccounts): FirebaseFirestore.DocumentData {
      return {
        tokens: JSON.parse(JSON.stringify(connectedAccounts.tokens)),
        created: connectedAccounts.created.toISOString(),
        updated: connectedAccounts.updated.toISOString(),
        isDeleted: connectedAccounts.isDeleted,
      };
    },
    fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): ConnectedAccounts {
      const data = snapshot.data();

      return new ConnectedAccounts(
        data.tokens,
        new Date(data.created),
        new Date(data.updated),
        data.isDeleted,
        snapshot.id,
      );
    },
  };
}
