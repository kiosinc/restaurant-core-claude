import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConnectedAccounts, createConnectedAccounts } from '../../../domain/roots/ConnectedAccounts';
import { MetadataRegistry } from '../../MetadataRegistry';
import { FirestoreRepository } from '../FirestoreRepository';
import { connectedAccountsConverter } from '../converters';
import { mockTransaction, mockDocRef, mockDb } from './helpers/firestoreMocks';

vi.mock('firebase-admin/firestore', () => ({ getFirestore: () => mockDb, FieldValue: { delete: () => '$$FIELD_DELETE$$' } }));

describe('ConnectedAccountsRootRepository', () => {
  let repo: FirestoreRepository<ConnectedAccounts>;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new FirestoreRepository<ConnectedAccounts>(connectedAccountsConverter, new MetadataRegistry());
  });

  it('get() returns ConnectedAccounts when exists', async () => {
    const ts = '2024-01-15T10:00:00.000Z';
    const data = {
      tokens: { square: { accessToken: 'tok-1' } },
      created: ts, updated: ts, isDeleted: false,
    };
    mockDocRef.get.mockResolvedValue({ exists: true, data: () => data, id: 'connectedAccounts' });
    const result = await repo.get('biz-1', 'connectedAccounts');
    expect(result).not.toBeNull();
    expect(result!.tokens.square.accessToken).toBe('tok-1');
  });

  it('set() deep-clones tokens', async () => {
    const tokens = { square: { accessToken: 'tok-2' } };
    const ca = createConnectedAccounts({ Id: 'connectedAccounts', tokens });
    await repo.set(ca, 'biz-1');
    const data = mockTransaction.set.mock.calls[0][1];
    expect(data.tokens).toEqual(tokens);
    expect(data.tokens).not.toBe(tokens);
  });

  it('round-trip preserves data', async () => {
    const ts = new Date('2024-06-01T12:00:00Z');
    const original = createConnectedAccounts({
      Id: 'connectedAccounts',
      tokens: { stripe: { key: 'sk_test' } },
      created: ts, updated: ts,
    });
    await repo.set(original, 'biz-1');
    const serialized = mockTransaction.set.mock.calls[0][1];
    mockDocRef.get.mockResolvedValue({ exists: true, data: () => serialized, id: 'connectedAccounts' });
    const restored = await repo.get('biz-1', 'connectedAccounts');
    expect(restored!.tokens).toEqual(original.tokens);
  });
});
