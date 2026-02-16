import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KioskConfiguration, createKioskConfiguration } from '../../../domain/surfaces/KioskConfiguration';
import { MetadataRegistry } from '../../MetadataRegistry';
import { FirestoreRepository } from '../FirestoreRepository';
import { kioskConfigurationConverter } from '../converters';
import { createTestKioskConfigurationInput } from '../../../domain/__tests__/helpers/SurfacesFixtures';
import { mockTransaction, mockDocRef, mockDb } from './helpers/firestoreMocks';

vi.mock('firebase-admin/firestore', () => ({ getFirestore: () => mockDb, FieldValue: { delete: () => '$$FIELD_DELETE$$' } }));

describe('KioskConfigurationRepository', () => {
  let registry: MetadataRegistry;
  let repo: FirestoreRepository<KioskConfiguration>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new MetadataRegistry();
    repo = new FirestoreRepository<KioskConfiguration>(kioskConfigurationConverter, registry);
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
    const original = createKioskConfiguration(createTestKioskConfigurationInput({
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
