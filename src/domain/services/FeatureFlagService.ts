import { getFirestore } from 'firebase-admin/firestore';

/**
 * Open-read feature flags contract.
 *
 * Flags are read from the Firestore doc `/config/writeModelFlags`. Any boolean
 * field present in that doc is returned by `getFlags()` — consumers define a new
 * flag by writing the doc field and reading it as `flags.myFlag ?? false`
 * (defaults-off). Retiring a flag is deleting the doc field. No library change
 * or publish is needed to add or retire a flag that way.
 *
 * A flag is additionally *declared* below — one key on `WriteModelFlags` plus
 * one key on `DEFAULT_FLAGS` — when it needs a concrete default (e.g. defaults-on)
 * or compile-time checking for library-internal consumers. Declared keys always
 * resolve to their default when absent from the doc; undeclared keys have no
 * default (absent → `undefined`).
 *
 * Trade-offs of the open contract:
 * - The doc is flags-only by convention: any boolean field written to
 *   `/config/writeModelFlags` will appear in `getFlags()` output.
 * - The index signature disables compile-time typo checking on flag property
 *   access, so consumers must spell flag names carefully.
 *
 * Sanitization: non-boolean doc values are dropped (logged as a warning);
 * known keys with a non-boolean value fall back to their `DEFAULT_FLAGS` value.
 */
export interface WriteModelFlags {
  [key: string]: boolean | undefined;
  enableMenuRebuild: boolean;
  enableAvailabilityDoc: boolean;
  writeLegacyOptionInventory: boolean;
  useCascadeEndpoint: boolean;
  disableImageSync: boolean;
  enableKioskPrincipals: boolean;
  enableAnonUserSweep: boolean;
  writeLegacyFirestorePresence: boolean;
  isImageDownsample: boolean;
  /**
   * #132 kill switch. When true (default), rebuildMenus prunes menuAssets /
   * menuAssetDisplayOrder / groupDisplayOrder entries whose backing menuGroup or
   * collection doc is missing or isDeleted. Flip to false to restore verbatim
   * preservation; pruning is loss-free, so rollback needs no data restoration.
   */
  pruneMenuAssetsOnRebuild: boolean;
  /**
   * #87 / P18 produce gate. When true, square-gateway-claude dispatches the
   * managed Square-menu assembly task after catalog sync; managed Menus/MenuGroups
   * are created and reconciled. Default false = behavior byte-for-byte unchanged.
   * Rollback = flip false; the managed Menu doc simply stops being updated,
   * nothing is deleted, no data restore needed.
   */
  syncSquareMenuCategories: boolean;
}

const DEFAULT_FLAGS: WriteModelFlags = {
  enableMenuRebuild: true,
  enableAvailabilityDoc: true,
  writeLegacyOptionInventory: false,
  useCascadeEndpoint: false,
  disableImageSync: false,
  enableKioskPrincipals: false,
  enableAnonUserSweep: false,
  writeLegacyFirestorePresence: true,
  isImageDownsample: false,
  pruneMenuAssetsOnRebuild: true,
  syncSquareMenuCategories: false,
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

      const data = doc.exists ? doc.data()! : {};
      const booleanFields = Object.fromEntries(
        Object.entries(data).filter(([, v]) => typeof v === 'boolean'),
      );
      const droppedKeys = Object.keys(data).filter((k) => typeof data[k] !== 'boolean');
      if (droppedKeys.length > 0) {
        console.warn(
          `FeatureFlagService: dropped non-boolean fields from config/writeModelFlags: ${droppedKeys.join(', ')}`,
        );
      }
      cachedFlags = { ...DEFAULT_FLAGS, ...booleanFields };
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
