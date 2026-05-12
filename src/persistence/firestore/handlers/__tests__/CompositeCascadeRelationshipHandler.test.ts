import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CompositeCascadeRelationshipHandler } from '../CompositeCascadeRelationshipHandler';
import { RelationshipHandler } from '../RelationshipHandler';
import { BaseEntity } from '../../../../domain/BaseEntity';

function createMockHandler(): RelationshipHandler<BaseEntity> {
  return {
    onSet: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn().mockResolvedValue(undefined),
  };
}

describe('CompositeCascadeRelationshipHandler', () => {
  const entity: BaseEntity = {
    Id: 'test-1',
    created: new Date(),
    updated: new Date(),
    isDeleted: false,
  };
  const businessId = 'biz-1';
  const mockTransaction = {} as FirebaseFirestore.Transaction;

  it('onSet delegates to all child handlers', async () => {
    const h1 = createMockHandler();
    const h2 = createMockHandler();
    const composite = new CompositeCascadeRelationshipHandler([h1, h2]);

    await composite.onSet(entity, businessId, mockTransaction);

    expect(h1.onSet).toHaveBeenCalledWith(entity, businessId, mockTransaction);
    expect(h2.onSet).toHaveBeenCalledWith(entity, businessId, mockTransaction);
  });

  it('onDelete delegates to all child handlers', async () => {
    const h1 = createMockHandler();
    const h2 = createMockHandler();
    const composite = new CompositeCascadeRelationshipHandler([h1, h2]);

    await composite.onDelete(entity, businessId, mockTransaction);

    expect(h1.onDelete).toHaveBeenCalledWith(entity, businessId, mockTransaction);
    expect(h2.onDelete).toHaveBeenCalledWith(entity, businessId, mockTransaction);
  });

  it('works with a single handler', async () => {
    const h1 = createMockHandler();
    const composite = new CompositeCascadeRelationshipHandler([h1]);

    await composite.onSet(entity, businessId, mockTransaction);

    expect(h1.onSet).toHaveBeenCalledOnce();
  });

  it('works with an empty handler array', async () => {
    const composite = new CompositeCascadeRelationshipHandler([]);

    await expect(composite.onSet(entity, businessId, mockTransaction)).resolves.toBeUndefined();
    await expect(composite.onDelete(entity, businessId, mockTransaction)).resolves.toBeUndefined();
  });

  it('propagates errors from child handlers', async () => {
    const h1 = createMockHandler();
    const h2 = createMockHandler();
    (h2.onSet as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('handler failed'));
    const composite = new CompositeCascadeRelationshipHandler([h1, h2]);

    await expect(composite.onSet(entity, businessId, mockTransaction)).rejects.toThrow('handler failed');
  });
});
