import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getFlags,
  clearFlagCache,
  createFlagService,
  getRolloutAllowlists,
  clearRolloutAllowlistCache,
  createRolloutAllowlistService,
  isTeamRolesV2Enabled,
} from '../FeatureFlagService';

const mockDocGet = vi.fn();
// Typed on the doc id so a test can branch per config doc (see stubConfigDocs);
// the default implementation serves mockDocGet for every id, as before.
const mockDoc = vi.fn((_docId: string) => ({ get: mockDocGet }));
const mockCollection = vi.fn(() => ({ doc: mockDoc }));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({ collection: mockCollection }),
}));

type ConfigDocs = {
  writeModelFlags?: Record<string, unknown>;
  rolloutAllowlists?: Record<string, unknown>;
};

/**
 * Serves each config doc by id. A doc omitted from `docs` reads as missing —
 * avoids ordering-fragile mockResolvedValueOnce chains when a test touches both
 * `writeModelFlags` and `rolloutAllowlists`.
 */
function stubConfigDocs(docs: ConfigDocs) {
  mockDoc.mockImplementation((docId: string) => {
    const data = docs[docId as keyof ConfigDocs];
    return {
      get: vi.fn().mockResolvedValue(
        data !== undefined ? { exists: true, data: () => data } : { exists: false },
      ),
    };
  });
}

// Mirror of the service's DEFAULT_FLAGS (module-private) for whole-object assertions.
const EXPECTED_DEFAULTS = {
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
  teamRolesV2: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  // clearAllMocks keeps implementations, so undo any stubConfigDocs override.
  mockDoc.mockImplementation(() => ({ get: mockDocGet }));
  clearFlagCache();
  clearRolloutAllowlistCache();
});

describe('FeatureFlagService', () => {
  it('returns default flags when doc does not exist', async () => {
    mockDocGet.mockResolvedValue({ exists: false });

    const flags = await getFlags();
    expect(flags).toEqual(EXPECTED_DEFAULTS);
  });

  it('reads flags from Firestore doc', async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({
        enableMenuRebuild: false,
        enableAvailabilityDoc: true,
        writeLegacyOptionInventory: true,
        useCascadeEndpoint: true,
        enableKioskPrincipals: true,
        enableAnonUserSweep: true,
        writeLegacyFirestorePresence: false,
      }),
    });

    const flags = await getFlags();
    expect(flags.enableMenuRebuild).toBe(false);
    expect(flags.enableAvailabilityDoc).toBe(true);
    expect(flags.writeLegacyOptionInventory).toBe(true);
    expect(flags.useCascadeEndpoint).toBe(true);
    expect(flags.enableKioskPrincipals).toBe(true);
    expect(flags.enableAnonUserSweep).toBe(true);
    expect(flags.writeLegacyFirestorePresence).toBe(false);
  });

  it('uses defaults for missing fields in doc', async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ enableMenuRebuild: false }),
    });

    const flags = await getFlags();
    expect(flags.enableMenuRebuild).toBe(false);
    expect(flags.enableAvailabilityDoc).toBe(true);
    expect(flags.writeLegacyOptionInventory).toBe(false);
    expect(flags.useCascadeEndpoint).toBe(false);
    expect(flags.enableKioskPrincipals).toBe(false);
    expect(flags.enableAnonUserSweep).toBe(false);
    expect(flags.writeLegacyFirestorePresence).toBe(true);
  });

  it('defaults isImageDownsample to false when absent in doc', async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ enableMenuRebuild: true }),
    });

    const flags = await getFlags();
    expect(flags.isImageDownsample).toBe(false);
  });

  it('reads isImageDownsample as true when set in doc', async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ isImageDownsample: true }),
    });

    const flags = await getFlags();
    expect(flags.isImageDownsample).toBe(true);
  });

  it('defaults pruneMenuAssetsOnRebuild to true when absent in the doc', async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ enableMenuRebuild: true }),
    });

    const flags = await getFlags();
    expect(flags.pruneMenuAssetsOnRebuild).toBe(true);
  });

  it('reads pruneMenuAssetsOnRebuild as false when set in the doc', async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ pruneMenuAssetsOnRebuild: false }),
    });

    const flags = await getFlags();
    expect(flags.pruneMenuAssetsOnRebuild).toBe(false);
  });

  // The missing-doc case (`exists: false` → false) is covered by the
  // EXPECTED_DEFAULTS assertion in 'returns default flags when doc does not exist'.
  it('defaults syncSquareMenuCategories to false when absent in doc', async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ enableMenuRebuild: true }),
    });

    const flags = await getFlags();
    expect(flags.syncSquareMenuCategories).toBe(false);
  });

  it('reads syncSquareMenuCategories as true when set in doc', async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ syncSquareMenuCategories: true }),
    });

    const flags = await getFlags();
    expect(flags.syncSquareMenuCategories).toBe(true);
  });

  it('defaults useClaimLease to false when the config doc is absent', async () => {
    mockDocGet.mockResolvedValue({ exists: false });

    const flags = await getFlags();
    expect(flags.useClaimLease).toBe(false);
  });

  it('reads useClaimLease: true from config/writeModelFlags', async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ useClaimLease: true }),
    });

    const flags = await getFlags();
    expect(flags.useClaimLease).toBe(true);
  });

  it('defaults writeLegacyEventNotification to true when the config doc is absent', async () => {
    mockDocGet.mockResolvedValue({ exists: false });

    const flags = await getFlags();
    // Defaults ON for the P42 migration window: dual-write ON preserves rollback protection,
    // OFF silently loses it, so absence must not be read as "retired".
    expect(flags.writeLegacyEventNotification).toBe(true);
  });

  it('reads writeLegacyEventNotification: false from config/writeModelFlags', async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ writeLegacyEventNotification: false }),
    });

    const flags = await getFlags();
    // The rcc#167 retirement step — one boolean per GCP project, no library publish.
    expect(flags.writeLegacyEventNotification).toBe(false);
  });

  it('defaults teamRolesV2 to false when the config doc has no such field', async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ enableMenuRebuild: true }),
    });

    const flags = await getFlags();
    expect(flags.teamRolesV2).toBe(false);
  });

  it('reads teamRolesV2: true from config/writeModelFlags', async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ teamRolesV2: true }),
    });

    const flags = await getFlags();
    expect(flags.teamRolesV2).toBe(true);
  });

  it('caches result within TTL', async () => {
    mockDocGet.mockResolvedValue({ exists: false });

    await getFlags();
    await getFlags();
    await getFlags();

    expect(mockDocGet).toHaveBeenCalledTimes(1);
  });

  it('re-fetches after cache cleared', async () => {
    mockDocGet.mockResolvedValue({ exists: false });

    await getFlags();
    clearFlagCache();
    await getFlags();

    expect(mockDocGet).toHaveBeenCalledTimes(2);
  });

  it('reads from config/writeModelFlags path', async () => {
    mockDocGet.mockResolvedValue({ exists: false });

    await getFlags();
    expect(mockCollection).toHaveBeenCalledWith('config');
    expect(mockDoc).toHaveBeenCalledWith('writeModelFlags');
  });

  it('createFlagService instances have independent caches', async () => {
    mockDocGet.mockResolvedValue({ exists: false });

    const service1 = createFlagService();
    const service2 = createFlagService();

    await service1.getFlags();
    await service2.getFlags();

    // Each instance fetched independently
    expect(mockDocGet).toHaveBeenCalledTimes(2);

    // Clearing one doesn't affect the other
    service1.clearCache();
    await service1.getFlags();
    expect(mockDocGet).toHaveBeenCalledTimes(3);

    // service2 still cached
    await service2.getFlags();
    expect(mockDocGet).toHaveBeenCalledTimes(3);
  });

  it('passes through unknown boolean keys from the doc', async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ isPageLevelCatalogWrites: true, someOtherNewFlag: false }),
    });

    const flags = await getFlags();
    expect(flags.isPageLevelCatalogWrites).toBe(true);
    expect(flags.someOtherNewFlag).toBe(false);
    expect(flags.enableMenuRebuild).toBe(true);
  });

  it('drops unknown non-boolean values (string, number, null, object)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({
        flagA: 'yes',
        flagB: 1,
        flagC: null,
        flagD: { nested: true },
        realFlag: true,
      }),
    });

    const flags = await getFlags();
    expect(flags.flagA).toBeUndefined();
    expect(flags.flagB).toBeUndefined();
    expect(flags.flagC).toBeUndefined();
    expect(flags.flagD).toBeUndefined();
    expect(flags.realFlag).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('dropped non-boolean fields'),
    );
    warnSpy.mockRestore();
  });

  it('sanitizes non-boolean values on known keys to their defaults', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({
        enableMenuRebuild: 'false',
        writeLegacyFirestorePresence: 0,
        disableImageSync: true,
      }),
    });

    const flags = await getFlags();
    // Non-boolean values on known keys fall back to defaults, not raw pass-through
    expect(flags.enableMenuRebuild).toBe(true);
    expect(flags.writeLegacyFirestorePresence).toBe(true);
    // Valid boolean passes through
    expect(flags.disableImageSync).toBe(true);
    warnSpy.mockRestore();
  });

  it('unknown keys absent from the doc read as undefined', async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ enableMenuRebuild: false }),
    });

    const flags = await getFlags();
    expect(flags.isPageLevelCatalogWrites).toBeUndefined();
  });

  it('merges defaults with doc values as a whole object', async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ useCascadeEndpoint: true, newFlag: true }),
    });

    const flags = await getFlags();
    expect(flags).toEqual({ ...EXPECTED_DEFAULTS, useCascadeEndpoint: true, newFlag: true });
  });

  it('unknown boolean key retired from doc disappears after cache clear', async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ tempFlag: true }),
    });

    const before = await getFlags();
    expect(before.tempFlag).toBe(true);

    clearFlagCache();
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({}),
    });

    const after = await getFlags();
    expect(after.tempFlag).toBeUndefined();
  });
});

describe('rollout allowlists (#240)', () => {
  it('reads from config/rolloutAllowlists path', async () => {
    mockDocGet.mockResolvedValue({ exists: false });

    await getRolloutAllowlists();
    expect(mockCollection).toHaveBeenCalledWith('config');
    expect(mockDoc).toHaveBeenCalledWith('rolloutAllowlists');
  });

  it('returns {teamRolesV2: []} when the doc does not exist', async () => {
    mockDocGet.mockResolvedValue({ exists: false });

    const lists = await getRolloutAllowlists();
    expect(lists).toEqual({ teamRolesV2: [] });
  });

  it('returns {teamRolesV2: []} when the field is absent', async () => {
    mockDocGet.mockResolvedValue({ exists: true, data: () => ({}) });

    const lists = await getRolloutAllowlists();
    expect(lists).toEqual({ teamRolesV2: [] });
  });

  it('returns [] and warns when the field is not an array', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    mockDocGet.mockResolvedValue({ exists: true, data: () => ({ teamRolesV2: 'biz-1' }) });
    expect(await getRolloutAllowlists()).toEqual({ teamRolesV2: [] });

    clearRolloutAllowlistCache();
    mockDocGet.mockResolvedValue({ exists: true, data: () => ({ teamRolesV2: { a: 1 } }) });
    expect(await getRolloutAllowlists()).toEqual({ teamRolesV2: [] });

    // `null` is a value Firestore can hold; it is not-an-array, not absent.
    clearRolloutAllowlistCache();
    mockDocGet.mockResolvedValue({ exists: true, data: () => ({ teamRolesV2: null }) });
    expect(await getRolloutAllowlists()).toEqual({ teamRolesV2: [] });

    expect(warnSpy).toHaveBeenCalledTimes(3);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('config/rolloutAllowlists.teamRolesV2 is not an array'),
    );
    warnSpy.mockRestore();
  });

  it('keeps string entries and drops non-string entries with a warn', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ teamRolesV2: ['biz-1', 2, null, { x: 1 }, 'biz-2'] }),
    });

    const lists = await getRolloutAllowlists();
    expect(lists.teamRolesV2).toEqual(['biz-1', 'biz-2']);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('dropped 3 non-string entries'),
    );
    warnSpy.mockRestore();
  });

  it('does not warn when every entry is a string', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ teamRolesV2: ['biz-1', 'biz-2'] }),
    });

    const lists = await getRolloutAllowlists();
    expect(lists.teamRolesV2).toEqual(['biz-1', 'biz-2']);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('ignores unrelated fields in the doc', async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ teamRolesV2: ['biz-1'], other: ['x'] }),
    });

    const lists = await getRolloutAllowlists();
    expect(lists).toEqual({ teamRolesV2: ['biz-1'] });
  });

  it('caches within TTL', async () => {
    mockDocGet.mockResolvedValue({ exists: false });

    await getRolloutAllowlists();
    await getRolloutAllowlists();
    await getRolloutAllowlists();

    expect(mockDocGet).toHaveBeenCalledTimes(1);
  });

  it('re-fetches after clearRolloutAllowlistCache', async () => {
    mockDocGet.mockResolvedValue({ exists: false });

    await getRolloutAllowlists();
    clearRolloutAllowlistCache();
    await getRolloutAllowlists();

    expect(mockDocGet).toHaveBeenCalledTimes(2);
  });

  it('re-fetches once the 60 s TTL has elapsed', async () => {
    mockDocGet.mockResolvedValue({ exists: false });
    const nowSpy = vi.spyOn(Date, 'now');
    try {
      nowSpy.mockReturnValue(1_000_000);
      await getRolloutAllowlists();
      nowSpy.mockReturnValue(1_000_000 + 59_999);
      await getRolloutAllowlists();
      expect(mockDocGet).toHaveBeenCalledTimes(1);

      nowSpy.mockReturnValue(1_000_000 + 60_000);
      await getRolloutAllowlists();
      expect(mockDocGet).toHaveBeenCalledTimes(2);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('createRolloutAllowlistService instances have independent caches', async () => {
    mockDocGet.mockResolvedValue({ exists: false });

    const service1 = createRolloutAllowlistService();
    const service2 = createRolloutAllowlistService();

    await service1.getRolloutAllowlists();
    await service2.getRolloutAllowlists();

    // Each instance fetched independently
    expect(mockDocGet).toHaveBeenCalledTimes(2);

    // Clearing one doesn't affect the other
    service1.clearCache();
    await service1.getRolloutAllowlists();
    expect(mockDocGet).toHaveBeenCalledTimes(3);

    // service2 still cached
    await service2.getRolloutAllowlists();
    expect(mockDocGet).toHaveBeenCalledTimes(3);
  });

  it('allowlist cache is independent of the flags cache', async () => {
    mockDocGet.mockResolvedValue({ exists: false });

    await getFlags();
    await getRolloutAllowlists();
    expect(mockDocGet).toHaveBeenCalledTimes(2);

    clearFlagCache();
    await getRolloutAllowlists();
    // Clearing the flags cache did not evict the allowlist read.
    expect(mockDocGet).toHaveBeenCalledTimes(2);

    await getFlags();
    expect(mockDocGet).toHaveBeenCalledTimes(3);
  });
});

describe('isTeamRolesV2Enabled (#240)', () => {
  it('is true when the global flag is on, without reading the allowlist', async () => {
    stubConfigDocs({ writeModelFlags: { teamRolesV2: true }, rolloutAllowlists: { teamRolesV2: [] } });

    expect(await isTeamRolesV2Enabled('biz-1')).toBe(true);
    expect(mockDoc).toHaveBeenCalledWith('writeModelFlags');
    expect(mockDoc).not.toHaveBeenCalledWith('rolloutAllowlists');
  });

  it('is true when the flag is off and the business is listed', async () => {
    stubConfigDocs({ rolloutAllowlists: { teamRolesV2: ['biz-1'] } });

    expect(await isTeamRolesV2Enabled('biz-1')).toBe(true);
  });

  it('is false when the flag is off and the business is unlisted', async () => {
    stubConfigDocs({ rolloutAllowlists: { teamRolesV2: ['biz-2'] } });

    expect(await isTeamRolesV2Enabled('biz-1')).toBe(false);
  });

  it('is false when both docs are missing', async () => {
    stubConfigDocs({});

    expect(await isTeamRolesV2Enabled('biz-1')).toBe(false);
  });

  it('is false for an empty businessId that is not listed', async () => {
    stubConfigDocs({ rolloutAllowlists: { teamRolesV2: ['biz-1'] } });

    expect(await isTeamRolesV2Enabled('')).toBe(false);
  });

  it('propagates a Firestore error rather than failing open', async () => {
    const failure = new Error('firestore unavailable');
    mockDoc.mockImplementation((docId: string) => ({
      get: docId === 'rolloutAllowlists'
        ? vi.fn().mockRejectedValue(failure)
        : vi.fn().mockResolvedValue({ exists: false }),
    }));

    await expect(isTeamRolesV2Enabled('biz-1')).rejects.toBe(failure);
  });
});
