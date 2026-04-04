import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SurfaceConfiguration, createSurfaceConfiguration } from '../../../domain/surfaces/SurfaceConfiguration';
import { MetadataRegistry } from '../../MetadataRegistry';
import { FirestoreRepository } from '../FirestoreRepository';
import { surfaceConfigurationConverter } from '../converters';
import { createTestSurfaceConfigurationInput } from '../../../domain/__tests__/helpers/SurfacesFixtures';
import { mockTransaction, mockDocRef, mockDb } from './helpers/firestoreMocks';

vi.mock('firebase-admin/firestore', () => ({ getFirestore: () => mockDb, FieldValue: { delete: () => '$$FIELD_DELETE$$' } }));

function createFullSerializedSurfaceConfiguration() {
  const ts = '2024-01-15T10:00:00.000Z';
  return {
    name: 'Main Config',
    isChargeCustomerServiceFee: true,
    coverConfiguration: { isCoverNoticeEnabled: true, coverNoticeText: 'Welcome' },
    tipConfiguration: { isTipsEnabled: true, isSmartTipsEnabled: false },
    checkoutFlowConfiguration: {
      isCouponsEnabled: true, isSquareGiftCardEnabled: false, isOrderNoteEnabled: true,
      checkoutCustomerNamePromptText: null, checkoutCustomerPhoneNumberPromptHeading: null,
      checkoutCustomerPhoneNumberPromptText: null, isDineInEnabled: true, isDineInNoticeEnabled: false,
      dineInNoticeText: null, isDineInCustomerEnterIdEnabled: false, dineInCustomerEnterIdPrompt: null,
      isDineInCustomerNameRequired: false, dineInCustomerNameRequiredPrompt: null, isToGoEnabled: true,
      isToGoNoticeEnabled: false, toGoNoticeText: null, orderConfirmationText: 'Thanks!',
      isReferralCodeEnabled: false, referralCodePromptText: null,
    },
    version: '1.5',
    created: ts, updated: ts, isDeleted: false,
  };
}

describe('SurfaceConfigurationRepository', () => {
  let registry: MetadataRegistry;
  let repo: FirestoreRepository<SurfaceConfiguration>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new MetadataRegistry();
    repo = new FirestoreRepository<SurfaceConfiguration>(surfaceConfigurationConverter, registry);
  });

  it('get() returns SurfaceConfiguration when exists', async () => {
    mockDocRef.get.mockResolvedValue({
      exists: true, data: () => createFullSerializedSurfaceConfiguration(), id: 'sc-1',
    });
    const result = await repo.get('biz-1', 'sc-1');
    expect(result).not.toBeNull();
    expect(result!.Id).toBe('sc-1');
    expect(result!.name).toBe('Main Config');
    expect(result!.coverConfiguration!.isCoverNoticeEnabled).toBe(true);
  });

  it('get() returns null when missing', async () => {
    mockDocRef.get.mockResolvedValue({ exists: false });
    expect(await repo.get('biz-1', 'missing')).toBeNull();
  });

  it('set() serializes nested configurations', async () => {
    const sc = createSurfaceConfiguration(createTestSurfaceConfigurationInput({
      Id: 'sc-1',
      coverConfiguration: { isCoverNoticeEnabled: true, coverNoticeText: 'Hello' },
      tipConfiguration: { isTipsEnabled: true, isSmartTipsEnabled: true },
    }));
    await repo.set(sc, 'biz-1');
    const data = mockTransaction.set.mock.calls[0][1];
    expect(data.coverConfiguration.isCoverNoticeEnabled).toBe(true);
    expect(data.tipConfiguration.isTipsEnabled).toBe(true);
  });

  it('round-trip preserves data', async () => {
    const ts = new Date('2024-06-01T12:00:00Z');
    const original = createSurfaceConfiguration(createTestSurfaceConfigurationInput({
      Id: 'sc-rt', name: 'Test Config', isChargeCustomerServiceFee: true,
      version: '2.0', created: ts, updated: ts,
    }));
    await repo.set(original, 'biz-1');
    const serialized = mockTransaction.set.mock.calls[0][1];
    mockDocRef.get.mockResolvedValue({ exists: true, data: () => serialized, id: 'sc-rt' });
    const restored = await repo.get('biz-1', 'sc-rt');
    expect(restored!.name).toBe(original.name);
    expect(restored!.isChargeCustomerServiceFee).toBe(original.isChargeCustomerServiceFee);
    expect(restored!.version).toBe(original.version);
  });
});
