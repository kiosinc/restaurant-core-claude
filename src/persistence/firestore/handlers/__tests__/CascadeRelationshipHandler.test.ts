import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createProduct } from '../../../../domain/catalog/Product';
import { createOptionSet } from '../../../../domain/catalog/OptionSet';
import { createOption } from '../../../../domain/catalog/Option';
import { createTestProductInput, createTestOptionSetInput, createTestOptionInput } from '../../../../domain/__tests__/helpers/CatalogFixtures';
import { ProductRelationshipHandler, ProductMenuGroupRelationshipHandler, OptionSetRelationshipHandler, OptionRelationshipHandler } from '../catalogHandlers';
import { CascadeRelationshipHandler } from '../CascadeRelationshipHandler';
import type { Product } from '../../../../domain/catalog/Product';

const mockUpdate = vi.fn();
const mockGet = vi.fn();
const mockWhere = vi.fn();
const mockDocRef = { get: vi.fn(), update: vi.fn(), path: '' };
const mockCollectionRef = { where: mockWhere, doc: vi.fn(() => mockDocRef) };

const mockDb = {
  collection: vi.fn(() => mockCollectionRef),
  doc: vi.fn(() => mockDocRef),
};

mockCollectionRef.doc.mockReturnValue({
  ...mockDocRef,
  collection: vi.fn(() => mockCollectionRef),
  path: 'mocked/path',
});

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => mockDb,
  FieldValue: {
    delete: () => '$$FIELD_DELETE$$',
    arrayRemove: (val: string) => `$$ARRAY_REMOVE:${val}$$`,
  },
}));

let mockTransaction: any;

beforeEach(() => {
  vi.clearAllMocks();
  mockTransaction = { get: mockGet, update: mockUpdate };
  mockWhere.mockReturnValue({});
});

describe('ProductRelationshipHandler', () => {
  it('queries categories by productDisplayOrder array-contains', async () => {
    const product = createProduct(createTestProductInput({ Id: 'prod-1' }));
    mockGet.mockResolvedValue({ docs: [] });

    await ProductRelationshipHandler.onSet(product, 'biz-1', mockTransaction);

    expect(mockWhere).toHaveBeenCalledWith('productDisplayOrder', 'array-contains', 'prod-1');
  });

  it('onSet updates ProductMeta on matching categories', async () => {
    const product = createProduct(createTestProductInput({
      Id: 'prod-1', name: 'Burger', isActive: true,
      imageUrls: ['b.jpg'], imageGsls: [],
      minPrice: 500, maxPrice: 800, variationCount: 3,
    }));
    mockGet.mockResolvedValue({ docs: [{ id: 'cat-1' }] });

    await ProductRelationshipHandler.onSet(product, 'biz-1', mockTransaction);

    expect(mockUpdate).toHaveBeenCalledWith(mockCollectionRef.doc('cat-1'), {
      'products.prod-1': {
        name: 'Burger', isActive: true,
        imageUrls: ['b.jpg'], imageGsls: [],
        minPrice: 500, maxPrice: 800, variationCount: 3,
        dietaryPreferences: [], allergens: [],
      },
    });
  });

  it('onSet no-ops when no categories match', async () => {
    const product = createProduct(createTestProductInput({ Id: 'prod-1' }));
    mockGet.mockResolvedValue({ docs: [] });

    await ProductRelationshipHandler.onSet(product, 'biz-1', mockTransaction);

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('onDelete removes from products map, productOrdinals map and productDisplayOrder', async () => {
    const product = createProduct(createTestProductInput({ Id: 'prod-1' }));
    mockGet.mockResolvedValue({ docs: [{ id: 'cat-1' }] });

    await ProductRelationshipHandler.onDelete(product, 'biz-1', mockTransaction);

    const updateArgs = mockUpdate.mock.calls[0][1];
    expect(updateArgs['products.prod-1']).toBe('$$FIELD_DELETE$$');
    expect(updateArgs['productOrdinals.prod-1']).toBe('$$FIELD_DELETE$$');
    expect(updateArgs.productDisplayOrder).toBe('$$ARRAY_REMOVE:prod-1$$');
  });

  it('onSet writes only the products map entry, never productOrdinals', async () => {
    const product = createProduct(createTestProductInput({ Id: 'prod-1' }));
    mockGet.mockResolvedValue({ docs: [{ id: 'cat-1' }] });

    await ProductRelationshipHandler.onSet(product, 'biz-1', mockTransaction);

    expect(Object.keys(mockUpdate.mock.calls[0][1])).toEqual(['products.prod-1']);
  });
});

describe('OptionSetRelationshipHandler', () => {
  it('queries products by optionSets map field existence', async () => {
    const os = createOptionSet(createTestOptionSetInput({ Id: 'os-1' }));
    mockGet.mockResolvedValue({ docs: [] });

    await OptionSetRelationshipHandler.onSet(os, 'biz-1', mockTransaction);

    expect(mockWhere).toHaveBeenCalledWith('optionSets.os-1.name', '>=', '');
  });

  it('onSet updates OptionSetMeta on matching products', async () => {
    const os = createOptionSet(createTestOptionSetInput({ Id: 'os-1', name: 'Size', displayOrder: 2, displayTier: 1 }));
    mockGet.mockResolvedValue({ docs: [{ id: 'prod-1' }] });

    await OptionSetRelationshipHandler.onSet(os, 'biz-1', mockTransaction);

    expect(mockUpdate).toHaveBeenCalledWith(mockCollectionRef.doc('prod-1'), {
      'optionSets.os-1': { name: 'Size', displayOrder: 2, displayTier: 1 },
    });
  });

  it('onDelete removes from optionSets and optionSetsSelection', async () => {
    const os = createOptionSet(createTestOptionSetInput({ Id: 'os-1' }));
    mockGet.mockResolvedValue({ docs: [{ id: 'prod-1' }] });

    await OptionSetRelationshipHandler.onDelete(os, 'biz-1', mockTransaction);

    const updateArgs = mockUpdate.mock.calls[0][1];
    expect(updateArgs['optionSets.os-1']).toBe('$$FIELD_DELETE$$');
    expect(updateArgs['optionSetsSelection.os-1']).toBe('$$FIELD_DELETE$$');
  });
});

describe('ProductMenuGroupRelationshipHandler', () => {
  it('queries menuGroups by productDisplayOrder array-contains', async () => {
    const product = createProduct(createTestProductInput({ Id: 'prod-1' }));
    mockGet.mockResolvedValue({ docs: [] });

    await ProductMenuGroupRelationshipHandler.onSet(product, 'biz-1', mockTransaction);

    expect(mockWhere).toHaveBeenCalledWith('productDisplayOrder', 'array-contains', 'prod-1');
  });

  it('onSet updates ProductMeta on matching menuGroups', async () => {
    const product = createProduct(createTestProductInput({
      Id: 'prod-1', name: 'Burger', isActive: true,
      imageUrls: ['b.jpg'], imageGsls: [],
      minPrice: 500, maxPrice: 800, variationCount: 3,
    }));
    mockGet.mockResolvedValue({ docs: [{ id: 'mg-1' }] });

    await ProductMenuGroupRelationshipHandler.onSet(product, 'biz-1', mockTransaction);

    expect(mockUpdate).toHaveBeenCalledWith(mockCollectionRef.doc('mg-1'), {
      'products.prod-1': {
        name: 'Burger', isActive: true,
        imageUrls: ['b.jpg'], imageGsls: [],
        minPrice: 500, maxPrice: 800, variationCount: 3,
        dietaryPreferences: [], allergens: [],
      },
    });
  });

  it('onSet no-ops when no menuGroups match', async () => {
    const product = createProduct(createTestProductInput({ Id: 'prod-1' }));
    mockGet.mockResolvedValue({ docs: [] });

    await ProductMenuGroupRelationshipHandler.onSet(product, 'biz-1', mockTransaction);

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('onDelete removes from menuGroup products map, productOrdinals map and productDisplayOrder', async () => {
    const product = createProduct(createTestProductInput({ Id: 'prod-1' }));
    mockGet.mockResolvedValue({ docs: [{ id: 'mg-1' }] });

    await ProductMenuGroupRelationshipHandler.onDelete(product, 'biz-1', mockTransaction);

    const updateArgs = mockUpdate.mock.calls[0][1];
    expect(updateArgs['products.prod-1']).toBe('$$FIELD_DELETE$$');
    expect(updateArgs['productOrdinals.prod-1']).toBe('$$FIELD_DELETE$$');
    expect(updateArgs.productDisplayOrder).toBe('$$ARRAY_REMOVE:prod-1$$');
  });
});

/**
 * #204: `fieldsToSet` is spread raw from the caller's projection, with no converter between it and
 * `transaction.update`, so an undefined there fails the whole parent write.
 *
 * The four exported handlers all build `fieldsToSet` from `buildSavedUpdates` + a real `*Meta`
 * function, none of which can emit an undefined — so this drives a bespoke handler whose
 * `onSaved` returns the payload directly. That is the only seam through which the raw shape the
 * strip exists for can be expressed.
 */
describe('CascadeRelationshipHandler payload strip (#204)', () => {
  /** Stands in for a Firestore sentinel: a class instance whose entries are not its value. */
  class Sentinel {
    readonly kind = 'serverTimestamp';
  }

  const sentinel = new Sentinel();

  function handlerReturning(fieldsToSet: Record<string, unknown>) {
    return new CascadeRelationshipHandler<Product>({
      parentCollection: () => mockCollectionRef as unknown as FirebaseFirestore.CollectionReference,
      parentQuery: (p) => ['productDisplayOrder', 'array-contains', p.Id],
      onSaved: (_entity, parentIds) => parentIds.map((parentId) => ({
        parentId,
        update: {
          fieldsToSet,
          fieldsToDelete: ['productOrdinals.prod-1'],
          arrayFieldRemovals: { productDisplayOrder: 'prod-1' },
        },
      })),
      onDeleted: () => [],
    });
  }

  it('drops undefined values while dotted keys and sentinels survive', async () => {
    const handler = handlerReturning({
      'products.prod-1': { name: 'Burger', calorieCount: undefined },
      'products.prod-1.stamped': sentinel,
      version: undefined,
    });
    mockGet.mockResolvedValue({ docs: [{ id: 'cat-1' }] });

    await handler.onSet(createProduct(createTestProductInput({ Id: 'prod-1' })), 'biz-1', mockTransaction);

    const data = mockUpdate.mock.calls[0][1];
    expect(Object.keys(data)).toEqual([
      'products.prod-1', 'products.prod-1.stamped', 'productOrdinals.prod-1', 'productDisplayOrder',
    ]);
    expect(data['products.prod-1']).toEqual({ name: 'Burger' });
    expect('calorieCount' in data['products.prod-1']).toBe(false);
    // A rebuilt sentinel would reach Firestore as a plain object and lose its meaning, so identity
    // — not equality — is the assertion that matters here.
    expect(data['products.prod-1.stamped']).toBe(sentinel);
    expect(data['productOrdinals.prod-1']).toBe('$$FIELD_DELETE$$');
    expect(data.productDisplayOrder).toBe('$$ARRAY_REMOVE:prod-1$$');
  });
});

describe('OptionRelationshipHandler', () => {
  it('queries optionSets by options map field existence', async () => {
    const option = createOption(createTestOptionInput({ Id: 'opt-1' }));
    mockGet.mockResolvedValue({ docs: [] });

    await OptionRelationshipHandler.onSet(option, 'biz-1', mockTransaction);

    expect(mockWhere).toHaveBeenCalledWith('options.opt-1.name', '>=', '');
  });

  it('onSet updates OptionMeta on matching optionSets', async () => {
    const option = createOption(createTestOptionInput({ Id: 'opt-1', name: 'Large', isActive: true }));
    mockGet.mockResolvedValue({ docs: [{ id: 'os-1' }] });

    await OptionRelationshipHandler.onSet(option, 'biz-1', mockTransaction);

    expect(mockUpdate).toHaveBeenCalledWith(mockCollectionRef.doc('os-1'), {
      'options.opt-1': { name: 'Large', isActive: true },
    });
  });

  it('onDelete removes from options, optionDisplayOrder, and preselectedOptionIds', async () => {
    const option = createOption(createTestOptionInput({ Id: 'opt-1' }));
    mockGet.mockResolvedValue({ docs: [{ id: 'os-1' }] });

    await OptionRelationshipHandler.onDelete(option, 'biz-1', mockTransaction);

    const updateArgs = mockUpdate.mock.calls[0][1];
    expect(updateArgs['options.opt-1']).toBe('$$FIELD_DELETE$$');
    expect(updateArgs.optionDisplayOrder).toBe('$$ARRAY_REMOVE:opt-1$$');
    expect(updateArgs.preselectedOptionIds).toBe('$$ARRAY_REMOVE:opt-1$$');
  });
});
