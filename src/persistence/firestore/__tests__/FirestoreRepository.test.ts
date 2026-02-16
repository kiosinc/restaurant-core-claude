import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseEntity } from '../../../domain/BaseEntity';
import { MetadataRegistry } from '../../MetadataRegistry';
import { MetadataSpec, MetaLinkDeclaration } from '../../../domain/MetadataSpec';
import { FirestoreRepository, FirestoreRepositoryConfig } from '../FirestoreRepository';
import { RelationshipHandlerRegistry } from '../handlers/RelationshipHandlerRegistry';
import { mockTransaction, mockDocRef, mockCollectionRef, mockDb } from './helpers/firestoreMocks';

vi.mock('firebase-admin/firestore', () => ({ getFirestore: () => mockDb, FieldValue: { delete: () => '$$FIELD_DELETE$$' } }));

interface SimpleEntity extends BaseEntity {
  name: string;
}

const simpleConfig: FirestoreRepositoryConfig<SimpleEntity> = {
  modelKey: 'simple',
  collectionRef: (_businessId: string) => mockCollectionRef as any,
  toFirestore: (entity: SimpleEntity) => ({ name: entity.name }),
  fromFirestore: (data: any, id: string) => ({
    Id: id,
    name: data.name,
    created: new Date(),
    updated: new Date(),
    isDeleted: false,
  }),
};

const simpleSpec: MetadataSpec<SimpleEntity, { name: string }> = {
  getMetadata(entity: SimpleEntity) {
    return { name: entity.name };
  },
  getMetaLinks(entity: SimpleEntity, businessId: string): MetaLinkDeclaration[] {
    return [
      {
        documentPath: `businesses/${businessId}/root`,
        fieldPath: `items.${entity.Id}`,
      },
    ];
  },
};

function makeEntity(overrides: Partial<SimpleEntity> = {}): SimpleEntity {
  return {
    Id: 'e1',
    name: 'test',
    created: new Date(),
    updated: new Date(),
    isDeleted: false,
    ...overrides,
  };
}

describe('FirestoreRepository', () => {
  let registry: MetadataRegistry;
  let repo: FirestoreRepository<SimpleEntity>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new MetadataRegistry();
    repo = new FirestoreRepository<SimpleEntity>(simpleConfig, registry);
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
    registry.register('simple', simpleSpec);
    const entity = makeEntity();

    await repo.set(entity, 'biz-1');

    expect(mockTransaction.set).toHaveBeenCalledWith(mockDocRef, { name: 'test' });
    expect(mockTransaction.update).toHaveBeenCalledWith(mockDocRef, {
      'items.e1': { name: 'test' },
    });
  });

  it('set() works without metadata spec', async () => {
    const entity = makeEntity();

    await repo.set(entity, 'biz-1');

    expect(mockTransaction.set).toHaveBeenCalledWith(mockDocRef, { name: 'test' });
    expect(mockTransaction.update).not.toHaveBeenCalled();
  });

  it('update() writes without metadata', async () => {
    const entity = makeEntity();

    await repo.update(entity, 'biz-1');

    expect(mockDocRef.update).toHaveBeenCalledWith({ name: 'test' });
    expect(mockDb.runTransaction).not.toHaveBeenCalled();
  });

  it('delete() removes doc + cleans metadata', async () => {
    registry.register('simple', simpleSpec);
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

  describe('RelationshipHandler wiring', () => {
    let handlerRegistry: RelationshipHandlerRegistry;
    let mockHandler: { onSet: ReturnType<typeof vi.fn>; onDelete: ReturnType<typeof vi.fn> };
    let repoWithHandler: FirestoreRepository<SimpleEntity>;

    beforeEach(() => {
      handlerRegistry = new RelationshipHandlerRegistry();
      mockHandler = {
        onSet: vi.fn().mockResolvedValue(undefined),
        onDelete: vi.fn().mockResolvedValue(undefined),
      };
      handlerRegistry.register('simple', mockHandler);
      repoWithHandler = new FirestoreRepository<SimpleEntity>(simpleConfig, registry, handlerRegistry);
    });

    it('set() invokes handler.onSet() inside transaction when handler is registered', async () => {
      const entity = makeEntity();

      await repoWithHandler.set(entity, 'biz-1');

      expect(mockHandler.onSet).toHaveBeenCalledWith(entity, 'biz-1', mockTransaction);
      expect(mockHandler.onDelete).not.toHaveBeenCalled();
      expect(mockTransaction.set).toHaveBeenCalledWith(mockDocRef, { name: 'test' });
    });

    it('set() dispatches to handler.onDelete() when entity has isDeleted=true', async () => {
      const entity = makeEntity({ isDeleted: true });

      await repoWithHandler.set(entity, 'biz-1');

      expect(mockHandler.onDelete).toHaveBeenCalledWith(entity, 'biz-1', mockTransaction);
      expect(mockHandler.onSet).not.toHaveBeenCalled();
      expect(mockTransaction.set).toHaveBeenCalled();
    });

    it('delete() invokes handler.onDelete() inside transaction when handler is registered', async () => {
      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({ name: 'to-delete' }),
        id: 'del-1',
      });

      await repoWithHandler.delete('biz-1', 'del-1');

      expect(mockHandler.onDelete).toHaveBeenCalledWith(
        expect.objectContaining({ Id: 'del-1', name: 'to-delete' }),
        'biz-1',
        mockTransaction,
      );
      expect(mockTransaction.delete).toHaveBeenCalledWith(mockDocRef);
    });

    it('handler error rolls back entire transaction', async () => {
      mockHandler.onSet.mockRejectedValue(new Error('parent not found'));
      const entity = makeEntity();

      await expect(repoWithHandler.set(entity, 'biz-1')).rejects.toThrow('parent not found');
      expect(mockTransaction.set).not.toHaveBeenCalled();
    });

    it('handler is called before any transaction writes', async () => {
      const callOrder: string[] = [];

      mockHandler.onSet.mockImplementation(async () => {
        callOrder.push('handler');
      });
      mockTransaction.set.mockImplementation(() => {
        callOrder.push('transaction.set');
      });
      mockTransaction.update.mockImplementation(() => {
        callOrder.push('transaction.update');
      });

      registry.register('simple', simpleSpec);
      const entity = makeEntity();

      await repoWithHandler.set(entity, 'biz-1');

      expect(callOrder).toEqual(['handler', 'transaction.set', 'transaction.update']);
    });
  });
});
