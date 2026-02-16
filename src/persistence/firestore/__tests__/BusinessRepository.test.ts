import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Business, createBusinessRoot, BusinessType, Role } from '../../../domain/roots/Business';
import { MetadataRegistry } from '../../MetadataRegistry';
import { FirestoreRepository } from '../FirestoreRepository';
import { businessConverter } from '../converters/businessConverter';
import { mockTransaction, mockDocRef, mockDb } from './helpers/firestoreMocks';

vi.mock('firebase-admin/firestore', () => ({ getFirestore: () => mockDb, FieldValue: { delete: () => '$$FIELD_DELETE$$' } }));

function createSerializedBusiness() {
  const ts = '2024-01-15T10:00:00.000Z';
  return {
    agent: 'ios-device',
    createdBy: 'uid-123',
    type: 'restaurant',
    businessProfile: { name: 'Test Restaurant', address: null, shippingAddress: null },
    roles: { 'uid-123': 'owner' },
    created: ts, updated: ts, isDeleted: false,
  };
}

describe('BusinessRepository', () => {
  let repo: FirestoreRepository<Business>;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new FirestoreRepository<Business>(businessConverter, new MetadataRegistry());
  });

  it('get() returns Business when exists', async () => {
    mockDocRef.get.mockResolvedValue({
      exists: true, data: () => createSerializedBusiness(), id: 'biz-1',
    });
    const result = await repo.get('biz-1', 'biz-1');
    expect(result).not.toBeNull();
    expect(result!.Id).toBe('biz-1');
    expect(result!.agent).toBe('ios-device');
    expect(result!.businessProfile.name).toBe('Test Restaurant');
    expect(result!.roles['uid-123']).toBe('owner');
  });

  it('get() returns null when missing', async () => {
    mockDocRef.get.mockResolvedValue({ exists: false });
    expect(await repo.get('biz-1', 'missing')).toBeNull();
  });

  it('set() serializes BusinessProfile', async () => {
    const biz = createBusinessRoot({
      Id: 'biz-1', agent: 'android', createdBy: 'uid-1',
      type: BusinessType.restaurant,
      businessProfile: { name: 'My Place', address: { line1: '123 Main', city: 'NYC', state: 'NY', postalCode: '10001', country: 'US' } },
      roles: { 'uid-1': Role.owner },
    });
    await repo.set(biz, 'biz-1');
    const data = mockTransaction.set.mock.calls[0][1];
    expect(data.businessProfile.name).toBe('My Place');
    expect(data.businessProfile.address.line1).toBe('123 Main');
  });

  it('round-trip preserves data', async () => {
    const ts = new Date('2024-06-01T12:00:00Z');
    const original = createBusinessRoot({
      Id: 'biz-rt', agent: 'web', createdBy: 'uid-2',
      type: BusinessType.restaurant,
      businessProfile: { name: 'Round Trip' },
      roles: { 'uid-2': Role.sysadmin },
      created: ts, updated: ts,
    });
    await repo.set(original, 'biz-rt');
    const serialized = mockTransaction.set.mock.calls[0][1];
    mockDocRef.get.mockResolvedValue({ exists: true, data: () => serialized, id: 'biz-rt' });
    const restored = await repo.get('biz-rt', 'biz-rt');
    expect(restored!.agent).toBe(original.agent);
    expect(restored!.businessProfile.name).toBe(original.businessProfile.name);
    expect(restored!.roles).toEqual(original.roles);
  });
});
