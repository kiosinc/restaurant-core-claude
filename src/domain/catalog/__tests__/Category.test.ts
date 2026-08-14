import { describe, it, expect } from 'vitest';
import { createCategory, categoryMeta } from '../Category';
import { createTestCategoryInput } from '../../__tests__/helpers/CatalogFixtures';
import { ValidationError } from '../../validation';

describe('Category (domain)', () => {
  it('constructs with all props', () => {
    const now = new Date('2024-01-15T10:00:00Z');
    const category = createCategory({
      ...createTestCategoryInput(),
      Id: 'cat-1',
      name: 'Entrees',
      products: { 'prod-1': { name: 'Burger', isActive: true, imageUrls: [], imageGsls: [], minPrice: 500, maxPrice: 500, variationCount: 1 } },
      productDisplayOrder: ['prod-1'],
      imageUrls: ['cat.jpg'],
      imageGsls: ['gs://cat'],
      linkedObjects: { square: { linkedObjectId: 'sq-1' } },
      categoryType: 'menu',
      parentCategoryId: 'cat-root',
      parentOrdinal: 3,
      rootCategoryId: 'cat-root',
      isTopLevel: false,
      managedBy: 'square',
      created: now,
      updated: now,
    });

    expect(category.Id).toBe('cat-1');
    expect(category.name).toBe('Entrees');
    expect(category.products['prod-1'].name).toBe('Burger');
    expect(category.productDisplayOrder).toEqual(['prod-1']);
    expect(category.imageUrls).toEqual(['cat.jpg']);
    expect(category.imageGsls).toEqual(['gs://cat']);
    expect(category.linkedObjects.square.linkedObjectId).toBe('sq-1');
    expect(category.categoryType).toBe('menu');
    expect(category.parentCategoryId).toBe('cat-root');
    expect(category.parentOrdinal).toBe(3);
    expect(category.rootCategoryId).toBe('cat-root');
    expect(category.isTopLevel).toBe(false);
    expect(category.managedBy).toBe('square');
  });

  it('defaults products to {}', () => {
    const category = createCategory(createTestCategoryInput());
    expect(category.products).toEqual({});
  });

  it('defaults productDisplayOrder to []', () => {
    const category = createCategory(createTestCategoryInput());
    expect(category.productDisplayOrder).toEqual([]);
  });

  it('defaults imageUrls/imageGsls to []', () => {
    const category = createCategory(createTestCategoryInput());
    expect(category.imageUrls).toEqual([]);
    expect(category.imageGsls).toEqual([]);
  });

  it('defaults linkedObjects to {}', () => {
    const category = createCategory(createTestCategoryInput());
    expect(category.linkedObjects).toEqual({});
  });

  it("defaults categoryType to 'regular'", () => {
    const category = createCategory(createTestCategoryInput());
    expect(category.categoryType).toBe('regular');
  });

  it('defaults parentCategoryId, parentOrdinal and rootCategoryId to null', () => {
    const category = createCategory(createTestCategoryInput());
    expect(category.parentCategoryId).toBeNull();
    expect(category.parentOrdinal).toBeNull();
    expect(category.rootCategoryId).toBeNull();
  });

  it('defaults isTopLevel to true', () => {
    const category = createCategory(createTestCategoryInput());
    expect(category.isTopLevel).toBe(true);
  });

  it('preserves an explicit isTopLevel false for a child category', () => {
    const category = createCategory({ ...createTestCategoryInput(), isTopLevel: false });
    expect(category.isTopLevel).toBe(false);
  });

  it('defaults managedBy to null', () => {
    const category = createCategory(createTestCategoryInput());
    expect(category.managedBy).toBeNull();
  });

  it('categoryMeta() returns CategoryMeta', () => {
    const category = createCategory(createTestCategoryInput({ name: 'Desserts' }));
    expect(categoryMeta(category)).toEqual({ name: 'Desserts' });
  });

  it('products stores ProductMeta', () => {
    const category = createCategory(createTestCategoryInput({
      products: {
        'prod-1': { name: 'Burger', isActive: true, imageUrls: ['b.jpg'], imageGsls: [], minPrice: 500, maxPrice: 800, variationCount: 3 },
      },
    }));
    expect(category.products['prod-1'].minPrice).toBe(500);
    expect(category.products['prod-1'].variationCount).toBe(3);
  });

  it('productOrdinals stores the per-edge Square ordinals it is given', () => {
    const category = createCategory(createTestCategoryInput({
      productOrdinals: { 'prod-1': 3, 'prod-2': 68719476736, 'prod-3': -2250769021534208 },
    }));
    expect(category.productOrdinals['prod-1']).toBe(3);
    expect(category.productOrdinals['prod-2']).toBe(68719476736);
    expect(category.productOrdinals['prod-3']).toBe(-2250769021534208);
  });

  it('defaults productOrdinals to {}', () => {
    const category = createCategory(createTestCategoryInput());
    expect(category.productOrdinals).toEqual({});
  });

  describe('validation', () => {
    it('allows empty name', () => {
      const category = createCategory(createTestCategoryInput({ name: '' }));
      expect(category.name).toBe('');
    });
  });

});
