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

  describe('validation', () => {
    it('throws for empty name', () => {
      expect(() => createCategory(createTestCategoryInput({ name: '' }))).toThrow(ValidationError);
    });
  });

});
