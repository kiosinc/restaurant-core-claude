import { describe, it, expect } from 'vitest';
import { createProduct, productMeta } from '../Product';
import { createTestProductInput, createTestInventoryCount } from '../../__tests__/helpers/CatalogFixtures';
import { InventoryCountState } from '../InventoryCount';
import { ValidationError } from '../../validation';

describe('Product (domain)', () => {
  it('constructs with all props', () => {
    const now = new Date('2024-01-15T10:00:00Z');
    const product = createProduct(createTestProductInput({
      Id: 'prod-1',
      name: 'Burger',
      caption: 'Delicious',
      description: 'A great burger',
      imageUrls: ['burger.jpg'],
      imageGsls: ['gs://burger'],
      optionSets: { 'os-1': { name: 'Size', displayOrder: 0, displayTier: 0 } },
      optionSetsSelection: { 'os-1': { minSelection: 1, maxSelection: 1, preSelected: [], isActive: true } },
      minPrice: 500,
      maxPrice: 800,
      variationCount: 3,
      locationInventory: { 'loc-1': createTestInventoryCount() },
      isActive: true,
      linkedObjects: { square: { linkedObjectId: 'sq-1' } },
      created: now,
      updated: now,
    }));

    expect(product.Id).toBe('prod-1');
    expect(product.name).toBe('Burger');
    expect(product.caption).toBe('Delicious');
    expect(product.description).toBe('A great burger');
    expect(product.imageUrls).toEqual(['burger.jpg']);
    expect(product.imageGsls).toEqual(['gs://burger']);
    expect(product.optionSets['os-1'].name).toBe('Size');
    expect(product.optionSetsSelection['os-1'].minSelection).toBe(1);
    expect(product.minPrice).toBe(500);
    expect(product.maxPrice).toBe(800);
    expect(product.variationCount).toBe(3);
    expect(product.locationInventory['loc-1'].count).toBe(10);
    expect(product.isActive).toBe(true);
    expect(product.linkedObjects.square.linkedObjectId).toBe('sq-1');
  });

  it('defaults caption to empty string', () => {
    const product = createProduct(createTestProductInput());
    expect(product.caption).toBe('');
  });

  it('defaults description to empty string', () => {
    const product = createProduct(createTestProductInput());
    expect(product.description).toBe('');
  });

  it('defaults imageUrls/imageGsls to []', () => {
    const product = createProduct(createTestProductInput());
    expect(product.imageUrls).toEqual([]);
    expect(product.imageGsls).toEqual([]);
  });

  it('defaults optionSets to {}', () => {
    const product = createProduct(createTestProductInput());
    expect(product.optionSets).toEqual({});
  });

  it('defaults optionSetsSelection to {}', () => {
    const product = createProduct(createTestProductInput());
    expect(product.optionSetsSelection).toEqual({});
  });

  it('defaults locationInventory to {}', () => {
    const product = createProduct(createTestProductInput());
    expect(product.locationInventory).toEqual({});
  });

  it('defaults linkedObjects to {}', () => {
    const product = createProduct(createTestProductInput());
    expect(product.linkedObjects).toEqual({});
  });

  it('productMeta() returns ProductMeta', () => {
    const product = createProduct(createTestProductInput({
      name: 'Pizza',
      isActive: false,
      imageUrls: ['pizza.jpg'],
      imageGsls: ['gs://pizza'],
      minPrice: 1000,
      maxPrice: 1500,
      variationCount: 2,
    }));
    expect(productMeta(product)).toEqual({
      name: 'Pizza',
      isActive: false,
      imageUrls: ['pizza.jpg'],
      imageGsls: ['gs://pizza'],
      minPrice: 1000,
      maxPrice: 1500,
      variationCount: 2,
    });
  });

  it('optionSets stores OptionSetMeta', () => {
    const product = createProduct(createTestProductInput({
      optionSets: {
        'os-1': { name: 'Size', displayOrder: 1, displayTier: 0 },
        'os-2': { name: 'Toppings', displayOrder: 2, displayTier: 1 },
      },
    }));
    expect(product.optionSets['os-1'].name).toBe('Size');
    expect(product.optionSets['os-2'].displayTier).toBe(1);
  });

  it('locationInventory stores InventoryCount', () => {
    const product = createProduct(createTestProductInput({
      locationInventory: {
        'loc-1': { count: 5, state: InventoryCountState.inStock, isAvailable: true },
        'loc-2': { count: 0, state: InventoryCountState.soldOut, isAvailable: false },
      },
    }));
    expect(product.locationInventory['loc-1'].count).toBe(5);
    expect(product.locationInventory['loc-2'].state).toBe(InventoryCountState.soldOut);
  });

  describe('validation', () => {
    it('allows empty name', () => {
      const product = createProduct(createTestProductInput({ name: '' }));
      expect(product.name).toBe('');
    });

    it('throws for negative minPrice', () => {
      expect(() => createProduct(createTestProductInput({ minPrice: -1 }))).toThrow(ValidationError);
    });

    it('throws for negative maxPrice', () => {
      expect(() => createProduct(createTestProductInput({ maxPrice: -1, minPrice: -2 }))).toThrow(ValidationError);
    });

    it('throws when minPrice > maxPrice', () => {
      expect(() => createProduct(createTestProductInput({ minPrice: 1000, maxPrice: 500 }))).toThrow(ValidationError);
    });

    it('allows minPrice equal to maxPrice', () => {
      expect(() => createProduct(createTestProductInput({ minPrice: 500, maxPrice: 500 }))).not.toThrow();
    });

    it('throws for negative variationCount', () => {
      expect(() => createProduct(createTestProductInput({ variationCount: -1 }))).toThrow(ValidationError);
    });
  });
});
