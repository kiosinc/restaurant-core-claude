import { FirestoreObject } from '../../firestore-core'
import { Business } from './Business'
import * as Paths from '../../firestore-core/Paths'

const catalogKey = Paths.CollectionNames.catalog;

export default class Catalog extends FirestoreObject {

  constructor(
    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: string,
  ) {
    super( { created, updated, isDeleted, Id: Id ?? catalogKey });
  }

  // eslint-disable-next-line class-methods-use-this
  collectionRef(businessId: string): FirebaseFirestore.CollectionReference {
    return Business.publicCollectionRef(businessId);
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
    return Business.publicCollectionRef(businessId).doc(catalogKey);
  }

  static firestoreConverter = {
    toFirestore(catalog: Catalog): FirebaseFirestore.DocumentData {
      return {
        created: catalog.created.toISOString(),
        updated: catalog.updated.toISOString(),
        isDeleted: catalog.isDeleted,
      };
    },
    fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): Catalog {
      const data = snapshot.data();

      return new Catalog(
        new Date(data.created),
        new Date(data.updated),
        data.isDeleted,
        snapshot.id,
      );
    },
  };
}
