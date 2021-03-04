/**
 * Utility functions for LinkedObject
 */
import * as Config from '../config';
import FirestoreObjectType from './FirestoreObjectType';
import * as Writer from './FirestoreWriter';
import LinkedObjectType from './LinkedObjectType';

/**
 *
 */
export interface LinkedObjectSyncResult<C> {
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
 */
export async function isStopSync<C extends LinkedObjectType>(
  firestoreObject: C,
  provider: Config.Constants.Provider,
  isSourceMarkedDelete: boolean,
  businessId: string,
) {
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
  }
  // no object
  return { isSyncActive: false };
}
