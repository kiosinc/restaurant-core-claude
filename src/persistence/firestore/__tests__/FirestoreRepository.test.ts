import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DomainEntity, DomainEntityProps } from '../../../domain/DomainEntity';
import { MetadataRegistry } from '../../MetadataRegistry';
import { MetadataSpec, MetaLinkDeclaration } from '../../../domain/MetadataSpec';
import { FirestoreRepository, FirestoreRepositoryConfig } from '../FirestoreRepository';

// Mock firebase-admin/firestore
const mockTransaction = {
  set: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  get: vi.fn(),
};

const mockDocRef = {
  get: vi.fn(),
  update: vi.fn(),
  path: '',
};

const mockCollectionRef = {
  doc: vi.fn(() => mockDocRef),
  where: vi.fn(() => ({
    get: vi.fn(),
  })),
};

const mockDb = {
  collection: vi.fn(() => mockCollectionRef),
  doc: vi.fn(() => mockDocRef),
  runTransaction: vi.fn(async (fn: (t: any) => Promise<void>) => fn(mockTransaction)),
};

// Add collection method to mockDocRef for PathResolver chaining
(mockDocRef as any).collection = vi.fn(() => mockCollectionRef);

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => mockDb,
  FieldValue: {
    delete: () => '$$FIELD_DELETE$$',
  },
}));

// Test entity
class TestEntity extends DomainEntity {
  name: string;
  constructor(props: DomainEntityProps & { name: string }) {
    super(props);
    this.name = props.name;
  }
}

const testSpec: MetadataSpec<TestEntity, { name: string }> = {
  getMetadata(entity: TestEntity) {
    return { name: entity.name };
  },
  getMetaLinks(entity: TestEntity, businessId: string): MetaLinkDeclaration[] {
    return [
      {
        documentPath: `businesses/${businessId}/root`,
        fieldPath: `items.${entity.Id}`,
      },
    ];
  },
};

// Concrete repository for testing
class TestRepository extends FirestoreRepository<TestEntity> {
  protected config(): FirestoreRepositoryConfig<TestEntity> {
    return {
      collectionRef: (_businessId: string) => mockCollectionRef as any,
      toFirestore: (entity: TestEntity) => ({ name: entity.name }),
      fromFirestore: (data: any, id: string, _businessId: string) =>
        new TestEntity({ Id: id, name: data.name }),
    };
  }
}

describe('FirestoreRepository', () => {
  let registry: MetadataRegistry;
  let repo: TestRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new MetadataRegistry();
    repo = new TestRepository(registry);
  });

  it('get() returns entity when exists', async () => {
    mockDocRef.get.mockResolvedValue({
      exists: true,
      data: () => ({ name: 'found' }),
      id: 'doc-1',
    });

    const result = await repo.get('biz-1', 'doc-1');
    expect(result).not.toBeNull();
    expect(result!.Id).toBe('doc-1');
    expect(result!.name).toBe('found');
  });

  it('get() returns null when missing', async () => {
    mockDocRef.get.mockResolvedValue({ exists: false });

    const result = await repo.get('biz-1', 'missing');
    expect(result).toBeNull();
  });

  it('set() writes doc + metadata in transaction', async () => {
    registry.register(TestEntity, testSpec);
    const entity = new TestEntity({ Id: 'e1', name: 'test' });

    await repo.set(entity, 'biz-1');

    expect(mockTransaction.set).toHaveBeenCalledWith(mockDocRef, { name: 'test' });
    expect(mockTransaction.update).toHaveBeenCalledWith(mockDocRef, {
      'items.e1': { name: 'test' },
    });
  });

  it('set() works without metadata spec', async () => {
    const entity = new TestEntity({ Id: 'e1', name: 'test' });

    await repo.set(entity, 'biz-1');

    expect(mockTransaction.set).toHaveBeenCalledWith(mockDocRef, { name: 'test' });
    expect(mockTransaction.update).not.toHaveBeenCalled();
  });

  it('update() writes without metadata', async () => {
    const entity = new TestEntity({ Id: 'e1', name: 'updated' });

    await repo.update(entity, 'biz-1');

    expect(mockDocRef.update).toHaveBeenCalledWith({ name: 'updated' });
    expect(mockDb.runTransaction).not.toHaveBeenCalled();
  });

  it('delete() removes doc + cleans metadata', async () => {
    registry.register(TestEntity, testSpec);
    // Mock get() to return an entity for delete
    mockDocRef.get.mockResolvedValue({
      exists: true,
      data: () => ({ name: 'to-delete' }),
      id: 'del-1',
    });

    await repo.delete('biz-1', 'del-1');

    expect(mockTransaction.delete).toHaveBeenCalledWith(mockDocRef);
    expect(mockTransaction.update).toHaveBeenCalledWith(mockDocRef, {
      'items.del-1': '$$FIELD_DELETE$$',
    });
  });

  it('delete() no-op when missing', async () => {
    mockDocRef.get.mockResolvedValue({ exists: false });

    await repo.delete('biz-1', 'missing');

    expect(mockDb.runTransaction).not.toHaveBeenCalled();
  });

  it('findByLinkedObject() returns entity', async () => {
    const mockQuery = {
      get: vi.fn().mockResolvedValue({
        docs: [{ data: () => ({ name: 'linked' }), id: 'linked-1' }],
      }),
    };
    mockCollectionRef.where.mockReturnValue(mockQuery);

    const result = await repo.findByLinkedObject('biz-1', 'ext-123', 'square');

    expect(mockCollectionRef.where).toHaveBeenCalledWith(
      'linkedObjects.square.linkedObjectId',
      '==',
      'ext-123',
    );
    expect(result).not.toBeNull();
    expect(result!.name).toBe('linked');
  });

  it('findByLinkedObject() returns null', async () => {
    const mockQuery = {
      get: vi.fn().mockResolvedValue({ docs: [] }),
    };
    mockCollectionRef.where.mockReturnValue(mockQuery);

    const result = await repo.findByLinkedObject('biz-1', 'ext-999', 'square');
    expect(result).toBeNull();
  });

  it('findByLinkedObject() throws on multiple', async () => {
    const mockQuery = {
      get: vi.fn().mockResolvedValue({
        docs: [
          { data: () => ({ name: 'a' }), id: '1' },
          { data: () => ({ name: 'b' }), id: '2' },
        ],
      }),
    };
    mockCollectionRef.where.mockReturnValue(mockQuery);

    await expect(
      repo.findByLinkedObject('biz-1', 'dup-id', 'square'),
    ).rejects.toThrow('Multiple entities found');
  });

  it('dateify() converts Timestamps', () => {
    const date = new Date('2023-01-01');
    const input = { created: { toDate: () => date } };
    const result = (repo as any).dateify(input);
    expect(result.created).toBe(date);
  });

  it('dateify() handles nesting', () => {
    const date = new Date('2023-06-15');
    const input = {
      top: 'value',
      nested: {
        deep: { toDate: () => date },
        other: 'keep',
      },
    };
    const result = (repo as any).dateify(input);
    expect(result.nested.deep).toBe(date);
    expect(result.nested.other).toBe('keep');
    expect(result.top).toBe('value');
  });

  it('dateify() leaves primitives alone', () => {
    const input = { str: 'hello', num: 42, bool: true, nil: null };
    const result = (repo as any).dateify(input);
    expect(result.str).toBe('hello');
    expect(result.num).toBe(42);
    expect(result.bool).toBe(true);
    expect(result.nil).toBeNull();
  });
});
