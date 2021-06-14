import FirestoreObject from '../../firestore-core/core/FirestoreObject';
import { Business } from './Business';
import * as Config from '../../firestore-core/config';

export default class Vars extends FirestoreObject<string> {
  databaseVersion: string;

  constructor(
    databaseVersion: string,
    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: string,
  ) {
    super(created, updated, isDeleted, Id ?? Config.Paths.CollectionNames.vars);
    this.databaseVersion = databaseVersion;
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
    toFirestore(vars: Vars): FirebaseFirestore.DocumentData {
      return {
        databaseVersion: vars.databaseVersion,
        created: vars.created.toISOString(),
        updated: vars.updated.toISOString(),
        isDeleted: vars.isDeleted,
      };
    },
    fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): Vars {
      const data = snapshot.data();
      return new Vars(
        data.databaseVersion ?? '0.0.0',
        new Date(data.created),
        new Date(data.updated),
        data.isDeleted,
        snapshot.id,
      );
    },
  };
}
