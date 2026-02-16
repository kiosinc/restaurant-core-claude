import { describe, it, expect, vi } from 'vitest';
import { linkedObjectQuery, findByLinkedObjectId } from '../LinkedObjectQueries';

// Mock firebase-admin/firestore to prevent initialization
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({}),
}));

function createMockCollectionRef(path = 'businesses/biz-1/products') {
  const mockQuery = {
    get: vi.fn(),
    withConverter: vi.fn(),
  };
  // withConverter returns itself for chaining
  mockQuery.withConverter.mockReturnValue(mockQuery);

  const collectionRef = {
    path,
    where: vi.fn(() => mockQuery),
  };

  return { collectionRef, mockQuery };
}

const mockConverter = {
  toFirestore: vi.fn(),
  fromFirestore: vi.fn(),
};

describe('linkedObjectQuery', () => {
  it('builds correct where clause', () => {
    const { collectionRef } = createMockCollectionRef();

    linkedObjectQuery(
      'ext-123',
      'square',
      collectionRef as any,
    );

    expect(collectionRef.where).toHaveBeenCalledWith(
      'linkedObjects.square.linkedObjectId',
      '==',
      'ext-123',
    );
  });

  it('applies converter when provided', () => {
    const { collectionRef, mockQuery } = createMockCollectionRef();

    linkedObjectQuery(
      'ext-123',
      'square',
      collectionRef as any,
      mockConverter as any,
    );

    expect(mockQuery.withConverter).toHaveBeenCalledWith(mockConverter);
  });

  it('skips converter when not provided', () => {
    const { collectionRef, mockQuery } = createMockCollectionRef();

    linkedObjectQuery(
      'ext-123',
      'square',
      collectionRef as any,
    );

    expect(mockQuery.withConverter).not.toHaveBeenCalled();
  });
});

describe('findByLinkedObjectId', () => {
  it('returns data when one match', async () => {
    const { collectionRef, mockQuery } = createMockCollectionRef();
    const entityData = { Id: 'prod-1', name: 'Burger' };
    mockQuery.get.mockResolvedValue({
      empty: false,
      docs: [{ id: 'prod-1', data: () => entityData }],
    });

    const result = await findByLinkedObjectId(
      'ext-123',
      'square',
      collectionRef as any,
      mockConverter as any,
    );

    expect(result).toEqual(entityData);
  });

  it('returns null when no match', async () => {
    const { collectionRef, mockQuery } = createMockCollectionRef();
    mockQuery.get.mockResolvedValue({
      empty: true,
      docs: [],
    });

    const result = await findByLinkedObjectId(
      'ext-123',
      'square',
      collectionRef as any,
      mockConverter as any,
    );

    expect(result).toBeNull();
  });

  it('throws on multiple matches', async () => {
    const { collectionRef, mockQuery } = createMockCollectionRef();
    mockQuery.get.mockResolvedValue({
      empty: false,
      docs: [
        { id: 'prod-1', data: () => ({}) },
        { id: 'prod-2', data: () => ({}) },
      ],
    });

    await expect(
      findByLinkedObjectId(
        'ext-123',
        'square',
        collectionRef as any,
        mockConverter as any,
      ),
    ).rejects.toThrow('There is more than one businesses/biz-1/products Collection object');

    await expect(
      findByLinkedObjectId(
        'ext-123',
        'square',
        collectionRef as any,
        mockConverter as any,
      ),
    ).rejects.toThrow('prod-1,prod-2');
  });

  it('passes converter to query', async () => {
    const { collectionRef, mockQuery } = createMockCollectionRef();
    mockQuery.get.mockResolvedValue({
      empty: true,
      docs: [],
    });

    await findByLinkedObjectId(
      'ext-123',
      'square',
      collectionRef as any,
      mockConverter as any,
    );

    expect(mockQuery.withConverter).toHaveBeenCalledWith(mockConverter);
  });
});
