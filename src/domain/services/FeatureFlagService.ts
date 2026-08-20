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
 * A flag may additionally be *declared* below — one key on `WriteModelFlags`
 * plus one key on `DEFAULT_FLAGS`. Declaring is required only for a flag that
 * must default to anything other than `false`, since a declared key resolves to
 * its `DEFAULT_FLAGS` value when absent from the doc whereas an undeclared key
 * is simply `undefined`. For a defaults-off flag, declaring changes no behavior
 * (`undefined ?? false` and a `false` default agree); it is done to give the
 * flag's semantics and rollback story a documented home in the library.
 * Declaring buys no typo protection — the index signature below makes any
 * property access typecheck either way.
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
   * #87 / P18 gate, consumed by square-gateway-claude. When true, the gateway
   * dispatches the managed Square-menu assembly task after catalog sync and
   * managed Menus/MenuGroups are created and reconciled. Defaults off; flipping
   * back to false stops the managed Menu doc being updated but deletes nothing,
   * so rollback needs no data restoration.
   */
  syncSquareMenuCategories: boolean;
  /**
   * #166 / P42 gate, consumed by square-gateway-claude's six webhook handlers and
   * the two cloud-functions consumers. When true, a consumer gates delivery on the
   * Firestore `webhookClaims/{eventId}` claim/lease (`acquireClaim`, which never
   * yields a "skip" outcome); when false it keeps using the legacy
   * `EventNotification` RTDB dedupe gate. Defaults off, so declaring it changes no
   * behavior. Rollback is a flag flip: during the migration window the claim path
   * dual-writes the legacy RTDB node, so a flip back to false still finds the node
   * and needs no data restoration.
   */
  useClaimLease: boolean;
  /**
   * #166 / P42 dual-write gate, consumed by `restaurant/webhooks/WebhookClaim`.
   * When true (**the default**), an `acquired` or `resumed` claim also writes the
   * legacy `EventNotification` RTDB node, so flipping `useClaimLease` back off is
   * a pure flag flip: the legacy gate finds the node and skips the redelivery,
   * with no data restoration. Defaults **on** for the whole P42 migration window,
   * because dual-write ON preserves that rollback protection and OFF silently
   * loses it. Turning it off is the **rcc#167 retirement step**, and it is a flag
   * rather than a module constant so that retirement is one boolean per GCP
   * project rather than a library publish, a version repin and three redeploys.
   */
  writeLegacyEventNotification: boolean;
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
  useClaimLease: false,
  writeLegacyEventNotification: true,
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
