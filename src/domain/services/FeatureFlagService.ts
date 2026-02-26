import { getFirestore } from 'firebase-admin/firestore';

export interface WriteModelFlags {
  enableMenuRebuild: boolean;
  enableAvailabilityDoc: boolean;
  writeLegacyOptionInventory: boolean;
}

const DEFAULT_FLAGS: WriteModelFlags = {
  enableMenuRebuild: true,
  enableAvailabilityDoc: true,
  writeLegacyOptionInventory: false,
};

const CACHE_TTL_MS = 60_000;

export function createFlagService() {
  let cachedFlags: WriteModelFlags | null = null;
  let cacheTimestamp = 0;

  return {
    getFlags: async (): Promise<WriteModelFlags> => {
      const now = Date.now();
      if (cachedFlags && now - cacheTimestamp < CACHE_TTL_MS) {
        return cachedFlags;
      }

      const db = getFirestore();
      const doc = await db.collection('config').doc('writeModelFlags').get();

      if (!doc.exists) {
        cachedFlags = { ...DEFAULT_FLAGS };
        cacheTimestamp = now;
        return cachedFlags;
      }

      const data = doc.data()!;
      cachedFlags = {
        enableMenuRebuild: data.enableMenuRebuild ?? DEFAULT_FLAGS.enableMenuRebuild,
        enableAvailabilityDoc: data.enableAvailabilityDoc ?? DEFAULT_FLAGS.enableAvailabilityDoc,
        writeLegacyOptionInventory: data.writeLegacyOptionInventory ?? DEFAULT_FLAGS.writeLegacyOptionInventory,
      };
      cacheTimestamp = now;
      return cachedFlags;
    },
    clearCache: () => {
      cachedFlags = null;
      cacheTimestamp = 0;
    },
  };
}

const defaultService = createFlagService();
export const getFlags = defaultService.getFlags;
export const clearFlagCache = defaultService.clearCache;
