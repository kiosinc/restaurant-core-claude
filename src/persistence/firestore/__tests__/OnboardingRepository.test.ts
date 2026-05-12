import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Onboarding, createOnboarding, OnboardingStage, OnboardingStageStatus } from '../../../domain/roots/Onboarding';
import { MetadataRegistry } from '../../MetadataRegistry';
import { FirestoreRepository } from '../FirestoreRepository';
import { onboardingConverter } from '../converters';
import { mockTransaction, mockDocRef, mockDb } from './helpers/firestoreMocks';

vi.mock('firebase-admin/firestore', () => ({ getFirestore: () => mockDb, FieldValue: { delete: () => '$$FIELD_DELETE$$' } }));

describe('OnboardingRepository', () => {
  let repo: FirestoreRepository<Onboarding>;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new FirestoreRepository<Onboarding>(onboardingConverter, new MetadataRegistry());
  });

  it('get() returns Onboarding when exists', async () => {
    const ts = '2024-01-15T10:00:00.000Z';
    const data = {
      stripeCustomerId: 'cus_123',
      onboardingStatus: { [OnboardingStage.createBusiness]: OnboardingStageStatus.complete },
      onboardingOrderId: 'order-1',
      menuCategories: ['cat-1'],
      created: ts, updated: ts, isDeleted: false,
    };
    mockDocRef.get.mockResolvedValue({ exists: true, data: () => data, id: 'onboarding' });
    const result = await repo.get('biz-1', 'onboarding');
    expect(result).not.toBeNull();
    expect(result!.stripeCustomerId).toBe('cus_123');
    expect(result!.onboardingOrderId).toBe('order-1');
  });

  it('set() serializes all fields', async () => {
    const ob = createOnboarding({
      Id: 'onboarding',
      stripeCustomerId: 'cus_456',
      onboardingStatus: { [OnboardingStage.squareIntegration]: OnboardingStageStatus.skipped },
      onboardingOrderId: 'order-2',
      menuCategories: ['cat-a', 'cat-b'],
    });
    await repo.set(ob, 'biz-1');
    const data = mockTransaction.set.mock.calls[0][1];
    expect(data.stripeCustomerId).toBe('cus_456');
    expect(data.onboardingOrderId).toBe('order-2');
    expect(data.menuCategories).toEqual(['cat-a', 'cat-b']);
  });

  it('fromFirestore defaults missing fields to null', async () => {
    const ts = '2024-01-15T10:00:00.000Z';
    const sparse = { created: ts, updated: ts, isDeleted: false };
    mockDocRef.get.mockResolvedValue({ exists: true, data: () => sparse, id: 'onboarding' });
    const result = await repo.get('biz-1', 'onboarding');
    expect(result!.stripeCustomerId).toBeNull();
    expect(result!.onboardingOrderId).toBeNull();
    expect(result!.menuCategories).toBeNull();
  });

  it('round-trip preserves data', async () => {
    const ts = new Date('2024-06-01T12:00:00Z');
    const original = createOnboarding({
      Id: 'onboarding',
      stripeCustomerId: 'cus_rt',
      onboardingStatus: { [OnboardingStage.configMenu]: OnboardingStageStatus.complete },
      onboardingOrderId: 'order-rt',
      menuCategories: ['c1', 'c2'],
      created: ts, updated: ts,
    });
    await repo.set(original, 'biz-1');
    const serialized = mockTransaction.set.mock.calls[0][1];
    mockDocRef.get.mockResolvedValue({ exists: true, data: () => serialized, id: 'onboarding' });
    const restored = await repo.get('biz-1', 'onboarding');
    expect(restored!.stripeCustomerId).toBe(original.stripeCustomerId);
    expect(restored!.onboardingOrderId).toBe(original.onboardingOrderId);
  });
});
