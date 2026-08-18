import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getFlags, clearFlagCache, createFlagService } from '../FeatureFlagService';

const mockDocGet = vi.fn();
const mockDoc = vi.fn(() => ({ get: mockDocGet }));
const mockCollection = vi.fn(() => ({ doc: mockDoc }));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({ collection: mockCollection }),
}));

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
};

beforeEach(() => {
  vi.clearAllMocks();
  clearFlagCache();
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
