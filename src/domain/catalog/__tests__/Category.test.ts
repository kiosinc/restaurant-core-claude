import { describe, it, expect } from 'vitest';
import { Category } from '../Category';
import { createTestCategoryProps } from '../../__tests__/helpers/CatalogFixtures';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('Category (domain)', () => {
  it('constructs with all props', () => {
    const now = new Date('2024-01-15T10:00:00Z');
    const category = new Category(createTestCategoryProps({
      Id: 'cat-1',
      name: 'Entrees',
      products: { 'prod-1': { name: 'Burger', isActive: true, imageUrls: [], imageGsls: [], minPrice: 500, maxPrice: 500, variationCount: 1 } },
      productDisplayOrder: ['prod-1'],
      imageUrls: ['cat.jpg'],
      imageGsls: ['gs://cat'],
      linkedObjects: { square: { linkedObjectId: 'sq-1' } },
      created: now,
      updated: now,
    }));

    expect(category.Id).toBe('cat-1');
    expect(category.name).toBe('Entrees');
    expect(category.products['prod-1'].name).toBe('Burger');
    expect(category.productDisplayOrder).toEqual(['prod-1']);
    expect(category.imageUrls).toEqual(['cat.jpg']);
    expect(category.imageGsls).toEqual(['gs://cat']);
    expect(category.linkedObjects.square.linkedObjectId).toBe('sq-1');
  });

  it('auto-generates UUID', () => {
    const category = new Category(createTestCategoryProps());
    expect(category.Id).toMatch(UUID_REGEX);
  });

  it('defaults products to {}', () => {
    const category = new Category(createTestCategoryProps());
    expect(category.products).toEqual({});
  });

  it('defaults productDisplayOrder to []', () => {
    const category = new Category(createTestCategoryProps());
    expect(category.productDisplayOrder).toEqual([]);
  });

  it('defaults imageUrls/imageGsls to []', () => {
    const category = new Category(createTestCategoryProps());
    expect(category.imageUrls).toEqual([]);
    expect(category.imageGsls).toEqual([]);
  });

  it('defaults linkedObjects to {}', () => {
    const category = new Category(createTestCategoryProps());
    expect(category.linkedObjects).toEqual({});
  });

  it('metadata() returns CategoryMeta', () => {
    const category = new Category(createTestCategoryProps({ name: 'Desserts' }));
    expect(category.metadata()).toEqual({ name: 'Desserts' });
  });

  it('products stores ProductMeta', () => {
    const category = new Category(createTestCategoryProps({
      products: {
        'prod-1': { name: 'Burger', isActive: true, imageUrls: ['b.jpg'], imageGsls: [], minPrice: 500, maxPrice: 800, variationCount: 3 },
      },
    }));
    expect(category.products['prod-1'].minPrice).toBe(500);
    expect(category.products['prod-1'].variationCount).toBe(3);
  });

  it('inherits DomainEntity fields', () => {
    const now = new Date('2024-06-01T12:00:00Z');
    const category = new Category(createTestCategoryProps({ created: now, updated: now, isDeleted: true }));
    expect(category.created).toEqual(now);
    expect(category.updated).toEqual(now);
    expect(category.isDeleted).toBe(true);
  });

  it('instantiates without Firebase', () => {
    const category = new Category(createTestCategoryProps());
    expect(category).toBeDefined();
  });
});
