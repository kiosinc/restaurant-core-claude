import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { PathResolver } from '../../persistence/firestore/PathResolver';
import { toDateSafe } from '../../persistence/firestore/converters/baseFields';

export interface LockOptions {
  heartbeatTtlMs?: number;
  syncTraceId?: string;
}

export default class Semaphore {
  isAvailable: boolean;

  readonly Id: string;

  readonly created: Date;

  updated: Date;

  protected isDeleted: boolean;

  lastHeartbeat?: Date;

  expiresAt?: Date;

  heartbeatTtlMs?: number;

  syncTraceId?: string;

  constructor(
    type: string,
    isAvailable: boolean,
    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: string,
    lastHeartbeat?: Date,
    expiresAt?: Date,
    heartbeatTtlMs?: number,
    syncTraceId?: string,
  ) {
    const now = new Date();

    this.created = created ?? now;
    this.updated = updated ?? now;
    this.Id = Id ?? type;
    this.isDeleted = isDeleted ?? false;

    this.isAvailable = isAvailable;
    this.lastHeartbeat = lastHeartbeat;
    this.expiresAt = expiresAt;
    this.heartbeatTtlMs = heartbeatTtlMs;
    this.syncTraceId = syncTraceId;
  }

  static ref(businessId: string, type: string) {
    return PathResolver.semaphoresCollection().doc(`${businessId}_${type}`);
  }

  static async lock(
    businessId: string,
    type: string,
    options?: LockOptions,
  ) {
    const docRef = Semaphore.ref(businessId, type);

    const acquired = await getFirestore().runTransaction(async (transaction) => {
      const snapshot = await transaction.get(docRef);

      if (snapshot.exists) {
        const current = snapshot.data()!;
        if (!current.isAvailable) return false;
      }

      const data: Record<string, unknown> = {
        isAvailable: false,
        updated: FieldValue.serverTimestamp(),
        isDeleted: false,
      };
      if (!snapshot.exists) {
        data.created = FieldValue.serverTimestamp();
      }
      if (options?.heartbeatTtlMs) {
        data.lastHeartbeat = FieldValue.serverTimestamp();
        data.expiresAt = new Date(Date.now() + options.heartbeatTtlMs);
        data.heartbeatTtlMs = options.heartbeatTtlMs;
      }
      if (options?.syncTraceId) {
        data.syncTraceId = options.syncTraceId;
      }
      transaction.set(docRef, data, { merge: true });
      return true;
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

      if (snapshot.exists && snapshot.data()!.isAvailable) return;

      const data: Record<string, unknown> = {
        isAvailable: true,
        updated: FieldValue.serverTimestamp(),
        isDeleted: false,
        ...Semaphore.heartbeatDeleteFields(),
      };
      if (!snapshot.exists) {
        data.created = FieldValue.serverTimestamp();
      }
      transaction.set(docRef, data, { merge: true });
    });

    return true;
  }

  static async updateHeartbeat(
    businessId: string,
    type: string,
    syncTraceId: string,
  ): Promise<boolean> {
    const docRef = Semaphore.ref(businessId, type);

    return getFirestore().runTransaction(async (transaction) => {
      const snapshot = await transaction.get(docRef);

      if (!snapshot.exists) return false;

      const current = snapshot.data()!;
      if (current.isAvailable) return false;
      if (!current.heartbeatTtlMs) return false;
      if (current.syncTraceId !== syncTraceId) return false;

      transaction.set(docRef, {
        lastHeartbeat: FieldValue.serverTimestamp(),
        expiresAt: new Date(Date.now() + current.heartbeatTtlMs),
        updated: FieldValue.serverTimestamp(),
        syncTraceId,
      }, { merge: true });

      return true;
    });
  }

  static async isExpired(
    businessId: string,
    type: string,
  ): Promise<boolean> {
    const docRef = Semaphore.ref(businessId, type);
    const snapshot = await docRef.get();

    if (!snapshot.exists) return false;

    const data = snapshot.data()!;
    if (data.isAvailable) return false;
    if (!data.expiresAt) return false;

    return toDateSafe(data.expiresAt) < new Date();
  }

  static async forceRelease(
    businessId: string,
    type: string,
  ): Promise<boolean> {
    const docRef = Semaphore.ref(businessId, type);

    return getFirestore().runTransaction(async (transaction) => {
      const snapshot = await transaction.get(docRef);

      if (!snapshot.exists) return false;

      transaction.set(docRef, {
        isAvailable: true,
        updated: FieldValue.serverTimestamp(),
        ...Semaphore.heartbeatDeleteFields(),
      }, { merge: true });

      return true;
    });
  }

  static async releaseIfExpired(
    businessId: string,
    type: string,
  ): Promise<boolean> {
    const docRef = Semaphore.ref(businessId, type);

    return getFirestore().runTransaction(async (transaction) => {
      const snapshot = await transaction.get(docRef);

      if (!snapshot.exists) return false;

      const current = snapshot.data()!;
      if (current.isAvailable) return false;
      if (!current.expiresAt) return false;

      const expiresAt = toDateSafe(current.expiresAt);
      if (expiresAt >= new Date()) return false;

      transaction.set(docRef, {
        isAvailable: true,
        updated: FieldValue.serverTimestamp(),
        ...Semaphore.heartbeatDeleteFields(),
      }, { merge: true });

      return true;
    });
  }

  private static heartbeatDeleteFields() {
    return {
      lastHeartbeat: FieldValue.delete(),
      expiresAt: FieldValue.delete(),
      heartbeatTtlMs: FieldValue.delete(),
      syncTraceId: FieldValue.delete(),
    };
  }

  static firestoreConverter = {
    toFirestore(semaphore: Semaphore): FirebaseFirestore.DocumentData {
      const result: FirebaseFirestore.DocumentData = {
        isAvailable: semaphore.isAvailable,
        created: semaphore.created.toISOString(),
        updated: semaphore.updated.toISOString(),
        isDeleted: semaphore.isDeleted,
      };
      if (semaphore.lastHeartbeat !== undefined) {
        result.lastHeartbeat = semaphore.lastHeartbeat.toISOString();
      }
      if (semaphore.expiresAt !== undefined) {
        result.expiresAt = semaphore.expiresAt.toISOString();
      }
      if (semaphore.heartbeatTtlMs !== undefined) {
        result.heartbeatTtlMs = semaphore.heartbeatTtlMs;
      }
      if (semaphore.syncTraceId !== undefined) {
        result.syncTraceId = semaphore.syncTraceId;
      }
      return result;
    },
    fromFirestore(data: FirebaseFirestore.DocumentData, type: string): Semaphore {
      return new Semaphore(
        type,
        data.isAvailable,
        toDateSafe(data.created),
        toDateSafe(data.updated),
        data.isDeleted,
        undefined,
        data.lastHeartbeat ? toDateSafe(data.lastHeartbeat) : undefined,
        data.expiresAt ? toDateSafe(data.expiresAt) : undefined,
        data.heartbeatTtlMs,
        data.syncTraceId,
      );
    },
  };
}
