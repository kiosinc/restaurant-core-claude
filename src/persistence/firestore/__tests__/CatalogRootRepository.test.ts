import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Catalog, createCatalog } from '../../../domain/roots/Catalog';
import { MetadataRegistry } from '../../MetadataRegistry';
import { FirestoreRepository } from '../FirestoreRepository';
import { catalogConverter } from '../converters';
import { mockTransaction, mockDocRef, mockDb } from './helpers/firestoreMocks';

vi.mock('firebase-admin/firestore', () => ({ getFirestore: () => mockDb, FieldValue: { delete: () => '$$FIELD_DELETE$$' } }));

describe('CatalogRootRepository', () => {
  let repo: FirestoreRepository<Catalog>;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new FirestoreRepository<Catalog>(catalogConverter, new MetadataRegistry());
  });

  it('get() returns Catalog when exists', async () => {
    const ts = '2024-01-15T10:00:00.000Z';
    mockDocRef.get.mockResolvedValue({
      exists: true, data: () => ({ created: ts, updated: ts, isDeleted: false }), id: 'catalog',
    });
    const result = await repo.get('biz-1', 'catalog');
    expect(result).not.toBeNull();
    expect(result!.Id).toBe('catalog');
    expect(result!.isDeleted).toBe(false);
  });

  it('set() serializes base fields only', async () => {
    const catalog = createCatalog({ Id: 'catalog' });
    await repo.set(catalog, 'biz-1');
    const data = mockTransaction.set.mock.calls[0][1];
    expect(data).toHaveProperty('created');
    expect(data).toHaveProperty('updated');
    expect(data).toHaveProperty('isDeleted');
    expect(Object.keys(data)).toHaveLength(3);
  });

  it('round-trip preserves data', async () => {
    const ts = new Date('2024-06-01T12:00:00Z');
    const original = createCatalog({ Id: 'catalog', created: ts, updated: ts });
    await repo.set(original, 'biz-1');
    const serialized = mockTransaction.set.mock.calls[0][1];
    mockDocRef.get.mockResolvedValue({ exists: true, data: () => serialized, id: 'catalog' });
    const restored = await repo.get('biz-1', 'catalog');
    expect(restored!.Id).toBe(original.Id);
    expect(restored!.created.getTime()).toBe(ts.getTime());
  });
});
