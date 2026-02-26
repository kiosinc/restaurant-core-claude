import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getFlags, clearFlagCache, createFlagService, WriteModelFlags } from '../FeatureFlagService';

const mockDocGet = vi.fn();
const mockDoc = vi.fn(() => ({ get: mockDocGet }));
const mockCollection = vi.fn(() => ({ doc: mockDoc }));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({ collection: mockCollection }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  clearFlagCache();
});

describe('FeatureFlagService', () => {
  it('returns default flags when doc does not exist', async () => {
    mockDocGet.mockResolvedValue({ exists: false });

    const flags = await getFlags();
    expect(flags).toEqual({
      enableMenuRebuild: true,
      enableAvailabilityDoc: true,
      writeLegacyOptionInventory: false,
    });
  });

  it('reads flags from Firestore doc', async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({
        enableMenuRebuild: false,
        enableAvailabilityDoc: true,
        writeLegacyOptionInventory: true,
      }),
    });

    const flags = await getFlags();
    expect(flags.enableMenuRebuild).toBe(false);
    expect(flags.enableAvailabilityDoc).toBe(true);
    expect(flags.writeLegacyOptionInventory).toBe(true);
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
});
