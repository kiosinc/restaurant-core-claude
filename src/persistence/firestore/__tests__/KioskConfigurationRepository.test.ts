import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KioskConfiguration } from '../../../domain/surfaces/KioskConfiguration';
import { MetadataRegistry } from '../../MetadataRegistry';
import { KioskConfigurationRepository } from '../KioskConfigurationRepository';
import { createTestKioskConfigurationProps } from '../../../domain/__tests__/helpers/SurfacesFixtures';

const mockTransaction = { set: vi.fn(), update: vi.fn(), delete: vi.fn() };
const mockDocRef = { get: vi.fn(), update: vi.fn(), path: '' };
const mockQuery = { get: vi.fn() };
const mockCollectionRef = {
  doc: vi.fn(() => mockDocRef),
  where: vi.fn(() => mockQuery),
};

const mockDb = {
  collection: vi.fn(() => mockCollectionRef),
  doc: vi.fn(() => mockDocRef),
  runTransaction: vi.fn(async (fn: (t: any) => Promise<void>) => fn(mockTransaction)),
};

// Make chaining work: collection().doc() returns something with .collection()
mockCollectionRef.doc.mockReturnValue({
  ...mockDocRef,
  collection: vi.fn(() => mockCollectionRef),
  path: 'mocked/path',
});

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => mockDb,
  FieldValue: { delete: () => '$$FIELD_DELETE$$' },
}));

describe('KioskConfigurationRepository', () => {
  let registry: MetadataRegistry;
  let repo: KioskConfigurationRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new MetadataRegistry();
    repo = new KioskConfigurationRepository(registry);
  });

  it('get() returns KioskConfiguration when exists', async () => {
    const ts = '2024-01-15T10:00:00.000Z';
    mockDocRef.get.mockResolvedValue({
      exists: true, data: () => ({
        name: 'Front Kiosk', unlockCode: '1234', checkoutOptionId: 'co-1',
        version: '2.0', created: ts, updated: ts, isDeleted: false,
      }), id: 'kc-1',
    });
    const result = await repo.get('biz-1', 'kc-1');
    expect(result).not.toBeNull();
    expect(result!.Id).toBe('kc-1');
    expect(result!.name).toBe('Front Kiosk');
    expect(result!.unlockCode).toBe('1234');
  });

  it('get() returns null when missing', async () => {
    mockDocRef.get.mockResolvedValue({ exists: false });
    expect(await repo.get('biz-1', 'missing')).toBeNull();
  });

  it('round-trip preserves data', async () => {
    const ts = new Date('2024-06-01T12:00:00Z');
    const original = new KioskConfiguration(createTestKioskConfigurationProps({
      Id: 'kc-rt', name: 'Back Kiosk', unlockCode: '5678',
      checkoutOptionId: 'co-2', version: '3.0', created: ts, updated: ts,
    }));
    await repo.set(original, 'biz-1');
    const serialized = mockTransaction.set.mock.calls[0][1];
    mockDocRef.get.mockResolvedValue({ exists: true, data: () => serialized, id: 'kc-rt' });
    const restored = await repo.get('biz-1', 'kc-rt');
    expect(restored!.name).toBe(original.name);
    expect(restored!.unlockCode).toBe(original.unlockCode);
    expect(restored!.checkoutOptionId).toBe(original.checkoutOptionId);
    expect(restored!.version).toBe(original.version);
  });
});
