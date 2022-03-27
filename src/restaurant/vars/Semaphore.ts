import FirestoreObject from '../../firestore-core/core/FirestoreObject';
import Vars from '../roots/Vars';
import * as Config from '../../firestore-core/config';
import { firestore } from '../../firestore-core/firebaseApp';

function findQuery(businessId: string, type: string) {
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  return Semaphore.collectionRef(businessId).doc(type).withConverter(Semaphore.firestoreConverter);
}

export default class Semaphore extends FirestoreObject<string> {
  isAvailable: boolean;

  constructor(
    type: string,
    isAvailable: boolean,
    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: string,
  ) {
    super(created, updated, isDeleted, Id ?? type);
    this.isAvailable = isAvailable;
  }

  // eslint-disable-next-line class-methods-use-this
  collectionRef(businessId: string): FirebaseFirestore.CollectionReference {
    return Semaphore.collectionRef(businessId);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars,class-methods-use-this
  metaLinks(businessId: string): { [p: string]: string } {
    return {};
  }

  // eslint-disable-next-line class-methods-use-this
  metadata(): {} {
    return {};
  }

  // STATICS

  static collectionRef(businessId: string) {
    return Vars.docRef(businessId)
      .collection(Config.Paths.CollectionNames.semaphores);
  }

  static async lock(
    businessId: string,
    type: string,
  ): Promise<boolean> {
    const result = await firestore.getFirestore().runTransaction(async (t) => {
      const ref = findQuery(businessId, type);
      const doc = await t.get(ref);
      const sema = doc.data() as Semaphore;
      if (!sema) {
        return false;
      }
      if (!sema.isAvailable) {
        return false;
      }

      const data = {
        isAvailable: false,
      };
      await t.update(ref, data);
      return true;
    });

    return result;
  }

  static async release(
    businessId: string,
    type: string,
  ) {
    await firestore.getFirestore().runTransaction(async (t) => {
      const ref = findQuery(businessId, type);
      const doc = await t.get(ref);
      const sema = doc.data() as Semaphore;
      if (sema) {
        if (!sema.isAvailable) {
          const data = {
            isAvailable: true,
          };
          await t.update(ref, data);
        }
      }
    });
  }

  static firestoreConverter = {
    toFirestore(semaphore: Semaphore): FirebaseFirestore.DocumentData {
      return {
        isAvailable: semaphore.isAvailable,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        isDeleted: semaphore.isDeleted,
      };
    },
    fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): Semaphore {
      const data = snapshot.data();

      return new Semaphore(
        snapshot.id,
        data.isAvailable,
        new Date(data.created),
        new Date(data.updated),
        data.isDeleted,
        snapshot.id,
      );
    },
  };
}
