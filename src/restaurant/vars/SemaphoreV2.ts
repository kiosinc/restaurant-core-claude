import { getDatabase } from 'firebase-admin/database';
import { database } from 'firebase-admin';

const db = getDatabase();

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
    // super(created, updated, isDeleted, Id ?? type);
    const now = new Date();

    this.created = created ?? now;
    this.updated = updated ?? now;
    this.Id = Id ?? type;
    this.isDeleted = isDeleted ?? false;

    this.isAvailable = isAvailable;
  }

  static ref(businessId: string, type: string) {
    const path = `/businesses/${businessId}/private/vars/semaphores/${type}`;

    return db.ref(path);
  }

  static async lock(
    businessId: string,
    type: string,
  ) {
    // Run transaction to get, and set isAvailable to false if it is free -- return true
    // Otherwise don't update -- return false
    const result = await Semaphore.ref(businessId, type).transaction((data) => {
      const sema = data !== null ? Semaphore.firebaseConverter.fromData(data, type)
        : new Semaphore(type, true);

      if (!sema.isAvailable) {
        return undefined;
      }

      // Lock semaphore
      sema.isAvailable = false;
      sema.updated = new Date();
      return Semaphore.firebaseConverter.toFirebase(sema);
    }, (error, success, data) => {
      if (error) {
        throw error;
      }
      if (!data) {
        throw new Error(`${businessId} semaphore ${type} did not return data`);
      }
    });

    return result.committed;
  }

  static async release(
    businessId: string,
    type: string,
  ) {
    // Run transaction to get, and set isAvailable to true if it is locked -- return true
    // Otherwise don't update -- return false
    const result = await Semaphore.ref(businessId, type).transaction((data) => {
      const sema = data !== null ? Semaphore.firebaseConverter.fromData(data, type)
        : new Semaphore(type, true);

      // Release semaphore
      sema.isAvailable = true;
      sema.updated = new Date();
      return Semaphore.firebaseConverter.toFirebase(sema);
    }, (error, success, data) => {
      if (error) {
        throw error;
      }
      if (!data) {
        throw new Error(`${businessId} semaphore ${type} did not return data`);
      }
    });

    return result.committed;
  }

  static firebaseConverter = {
    toFirebase(semaphore: Semaphore): any {
      return {
        isAvailable: semaphore.isAvailable,
        created: semaphore.created.toISOString(),
        updated: semaphore.updated.toISOString(),
        isDeleted: semaphore.isDeleted,
      };
    },
    fromFirestore(snapshot: database.DataSnapshot): Semaphore {
      const data = snapshot.val();

      return new Semaphore(
        snapshot.key ?? '',
        data.isAvailable,
        new Date(data.created),
        new Date(data.updated),
        data.isDeleted,
      );
    },
    fromData(data: any, type: string): Semaphore {
      return new Semaphore(
        type,
        data.isAvailable,
        new Date(data.created),
        new Date(data.updated),
        data.isDeleted,
      );
    },
  };
}
