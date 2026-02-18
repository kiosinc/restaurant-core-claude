import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { PathResolver } from '../../persistence/firestore/PathResolver';

export default class Semaphore {
  isAvailable: boolean;

  readonly Id: string;

  // TODO   make optional
  readonly created: Date;

  // TODO   make optional
  updated: Date;

  protected isDeleted: boolean;

  constructor(
    type: string,
    isAvailable: boolean,
    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: string,
  ) {
    const now = new Date();

    this.created = created ?? now;
    this.updated = updated ?? now;
    this.Id = Id ?? type;
    this.isDeleted = isDeleted ?? false;

    this.isAvailable = isAvailable;
  }

  static ref(businessId: string, type: string) {
    return PathResolver.semaphoresCollection(businessId).doc(type);
  }

  static async lock(
    businessId: string,
    type: string,
  ) {
    const docRef = Semaphore.ref(businessId, type);
    let acquired = false;

    await getFirestore().runTransaction(async (transaction) => {
      const snapshot = await transaction.get(docRef);

      if (snapshot.exists) {
        const current = snapshot.data()!;
        if (!current.isAvailable) return; // Lock held — no write, acquired stays false
      }

      const data: Record<string, any> = {
        isAvailable: false,
        updated: FieldValue.serverTimestamp(),
        isDeleted: false,
      };
      if (!snapshot.exists) {
        data.created = FieldValue.serverTimestamp();
      }
      transaction.set(docRef, data, { merge: true });
      acquired = true;
    });

    return acquired;
  }

  static async release(
    businessId: string,
    type: string,
  ) {
    const docRef = Semaphore.ref(businessId, type);

    await getFirestore().runTransaction(async (transaction) => {
      const snapshot = await transaction.get(docRef);

      const data: Record<string, any> = {
        isAvailable: true,
        updated: FieldValue.serverTimestamp(),
        isDeleted: false,
      };
      if (!snapshot.exists) {
        data.created = FieldValue.serverTimestamp();
      }
      transaction.set(docRef, data, { merge: true });
    });

    return true;
  }

  static firestoreConverter = {
    toFirestore(semaphore: Semaphore): any {
      return {
        isAvailable: semaphore.isAvailable,
        created: semaphore.created.toISOString(),
        updated: semaphore.updated.toISOString(),
        isDeleted: semaphore.isDeleted,
      };
    },
    fromFirestore(data: any, type: string): Semaphore {
      return new Semaphore(
        type,
        data.isAvailable,
        data.created?.toDate ? data.created.toDate() : new Date(data.created),
        data.updated?.toDate ? data.updated.toDate() : new Date(data.updated),
        data.isDeleted,
      );
    },
  };
}
