/**
 * Utility functions for LinkedObject
 */
import * as Config from '../config';
import * as Writer from './FirestoreWriter';
import LinkedObjectType from './LinkedObjectType';

/**
 *
 */
export interface SyncResult<C> {
  object?: C;
  isSyncActive: boolean;
}

/**
 * Returns a boolean if the product is synced
 */
export function isSyncActive<C extends LinkedObjectType>(
  object: C,
  provider: Config.Constants.Provider,
): boolean {
  const linkedObjectProvider = object.linkedObjects[provider];
  if (linkedObjectProvider) {
    return linkedObjectProvider.isSyncActive;
  }

  return false;
}

/**
 * If the object already exists check against sync and delete flags
 * Return a SyncResult if the object should not be synced
 * or undefined if it should be synced
 */
export async function isStopSync<C extends LinkedObjectType>(
  firestoreObject: C,
  provider: Config.Constants.Provider,
  isSourceMarkedDelete: boolean,
  businessId: string,
): Promise<SyncResult<C> | void> {
  // the object exists, apply sync or delete flag
  // otherwise return no result (undefined)
  if (firestoreObject) {
    const isSync = isSyncActive(firestoreObject, provider);

    // if no sync then exit
    // else delete the existing referenced object
    if (!isSync) {
      return {
        isSyncActive: false,
        object: firestoreObject,
      };
    } if (isSourceMarkedDelete) {
      await Writer.deleteObject(firestoreObject, businessId);
      return {
        isSyncActive: false,
        object: firestoreObject,
      };
    }
  } else if (isSourceMarkedDelete) {
    return { isSyncActive: false };
  }

  // Don't stop the sync
  // By returning undefined
  return undefined;
}
