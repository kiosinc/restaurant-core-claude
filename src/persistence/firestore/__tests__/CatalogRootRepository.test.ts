import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Catalog } from '../../../domain/roots/Catalog';
import { MetadataRegistry } from '../../MetadataRegistry';
import { CatalogRootRepository } from '../CatalogRootRepository';

const mockTransaction = { set: vi.fn(), update: vi.fn(), delete: vi.fn() };
const mockDocRef = { get: vi.fn(), update: vi.fn(), path: '' };
const mockCollectionRef = {
  doc: vi.fn(() => mockDocRef),
  where: vi.fn(() => ({ get: vi.fn() })),
};

const mockDb = {
  collection: vi.fn(() => mockCollectionRef),
  doc: vi.fn(() => mockDocRef),
  runTransaction: vi.fn(async (fn: (t: any) => Promise<void>) => fn(mockTransaction)),
};

mockCollectionRef.doc.mockReturnValue({
  ...mockDocRef,
  collection: vi.fn(() => mockCollectionRef),
  path: 'mocked/path',
});

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => mockDb,
  FieldValue: { delete: () => '$$FIELD_DELETE$$' },
}));

describe('CatalogRootRepository', () => {
  let repo: CatalogRootRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new CatalogRootRepository(new MetadataRegistry());
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
    const catalog = new Catalog({ Id: 'catalog' });
    await repo.set(catalog, 'biz-1');
    const data = mockTransaction.set.mock.calls[0][1];
    expect(data).toHaveProperty('created');
    expect(data).toHaveProperty('updated');
    expect(data).toHaveProperty('isDeleted');
    expect(Object.keys(data)).toHaveLength(3);
  });

  it('round-trip preserves data', async () => {
    const ts = new Date('2024-06-01T12:00:00Z');
    const original = new Catalog({ Id: 'catalog', created: ts, updated: ts });
    await repo.set(original, 'biz-1');
    const serialized = mockTransaction.set.mock.calls[0][1];
    mockDocRef.get.mockResolvedValue({ exists: true, data: () => serialized, id: 'catalog' });
    const restored = await repo.get('biz-1', 'catalog');
    expect(restored!.Id).toBe(original.Id);
    expect(restored!.created.getTime()).toBe(ts.getTime());
  });
});
