import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Product } from '../../../../domain/catalog/Product';
import { ProductRelationshipHandler } from '../ProductRelationshipHandler';
import { createTestProductProps } from '../../../../domain/__tests__/helpers/CatalogFixtures';

const mockUpdate = vi.fn();
const mockGet = vi.fn();
const mockWhere = vi.fn();
const mockCollectionRef = { where: mockWhere };

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    delete: () => '$$FIELD_DELETE$$',
    arrayRemove: (val: string) => `$$ARRAY_REMOVE:${val}$$`,
  },
}));

vi.mock('../../../../restaurant/roots/Catalog', () => ({
  default: {
    docRef: (_businessId: string) => ({
      collection: (_name: string) => mockCollectionRef,
    }),
  },
}));

describe('ProductRelationshipHandler', () => {
  let handler: ProductRelationshipHandler;
  let mockTransaction: any;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new ProductRelationshipHandler();
    mockTransaction = { get: mockGet, update: mockUpdate };
    mockWhere.mockReturnValue({});
  });

  it('onSet queries Categories containing this Product', async () => {
    const product = new Product(createTestProductProps({ Id: 'prod-1' }));
    mockGet.mockResolvedValue({ docs: [] });

    await handler.onSet(product, 'biz-1', mockTransaction);

    expect(mockWhere).toHaveBeenCalledWith('productDisplayOrder', 'array-contains', 'prod-1');
  });

  it('onSet updates ProductMeta on matching Categories', async () => {
    const product = new Product(createTestProductProps({
      Id: 'prod-1', name: 'Burger', isActive: true,
      imageUrls: ['b.jpg'], imageGsls: [],
      minPrice: 500, maxPrice: 800, variationCount: 3,
    }));
    const docRef = { id: 'cat-1' };
    mockGet.mockResolvedValue({ docs: [{ ref: docRef }] });

    await handler.onSet(product, 'biz-1', mockTransaction);

    expect(mockUpdate).toHaveBeenCalledWith(docRef, {
      'products.prod-1': {
        name: 'Burger', isActive: true,
        imageUrls: ['b.jpg'], imageGsls: [],
        minPrice: 500, maxPrice: 800, variationCount: 3,
      },
    });
  });

  it('onSet no-ops when no Categories match', async () => {
    const product = new Product(createTestProductProps({ Id: 'prod-1' }));
    mockGet.mockResolvedValue({ docs: [] });

    await handler.onSet(product, 'biz-1', mockTransaction);

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('onDelete removes from Categories products map', async () => {
    const product = new Product(createTestProductProps({ Id: 'prod-1' }));
    const docRef = { id: 'cat-1' };
    mockGet.mockResolvedValue({ docs: [{ ref: docRef }] });

    await handler.onDelete(product, 'biz-1', mockTransaction);

    const updateArgs = mockUpdate.mock.calls[0][1];
    expect(updateArgs['products.prod-1']).toBe('$$FIELD_DELETE$$');
  });

  it('onDelete removes from Categories productDisplayOrder', async () => {
    const product = new Product(createTestProductProps({ Id: 'prod-1' }));
    const docRef = { id: 'cat-1' };
    mockGet.mockResolvedValue({ docs: [{ ref: docRef }] });

    await handler.onDelete(product, 'biz-1', mockTransaction);

    const updateArgs = mockUpdate.mock.calls[0][1];
    expect(updateArgs.productDisplayOrder).toBe('$$ARRAY_REMOVE:prod-1$$');
  });
});
