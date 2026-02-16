import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Services, createServices } from '../../../domain/roots/Services';
import { MetadataRegistry } from '../../MetadataRegistry';
import { FirestoreRepository } from '../FirestoreRepository';
import { servicesConverter } from '../converters';
import { mockTransaction, mockDocRef, mockDb } from './helpers/firestoreMocks';

vi.mock('firebase-admin/firestore', () => ({ getFirestore: () => mockDb, FieldValue: { delete: () => '$$FIELD_DELETE$$' } }));

describe('ServicesRepository', () => {
  let repo: FirestoreRepository<Services>;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new FirestoreRepository<Services>(servicesConverter, new MetadataRegistry());
  });

  it('get() returns Services when exists', async () => {
    const ts = '2024-01-15T10:00:00.000Z';
    const data = {
      kioskFeeRate: 2.0, experiments: { darkMode: true },
      created: ts, updated: ts, isDeleted: false,
    };
    mockDocRef.get.mockResolvedValue({ exists: true, data: () => data, id: 'services' });
    const result = await repo.get('biz-1', 'services');
    expect(result).not.toBeNull();
    expect(result!.kioskFeeRate).toBe(2.0);
    expect(result!.experiments.darkMode).toBe(true);
  });

  it('set() serializes all fields', async () => {
    const svc = createServices({ Id: 'services', kioskFeeRate: 3.0, experiments: { beta: false } });
    await repo.set(svc, 'biz-1');
    const data = mockTransaction.set.mock.calls[0][1];
    expect(data.kioskFeeRate).toBe(3.0);
    expect(data.experiments).toEqual({ beta: false });
  });

  it('round-trip preserves data', async () => {
    const ts = new Date('2024-06-01T12:00:00Z');
    const original = createServices({
      Id: 'services', kioskFeeRate: 1.0,
      experiments: { feature1: true, feature2: false },
      created: ts, updated: ts,
    });
    await repo.set(original, 'biz-1');
    const serialized = mockTransaction.set.mock.calls[0][1];
    mockDocRef.get.mockResolvedValue({ exists: true, data: () => serialized, id: 'services' });
    const restored = await repo.get('biz-1', 'services');
    expect(restored!.kioskFeeRate).toBe(original.kioskFeeRate);
    expect(restored!.experiments).toEqual(original.experiments);
  });
});
