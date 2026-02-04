import { describe, it, expect } from 'vitest';
import { Product } from '../Product';
import { createTestProductProps, createTestInventoryCount } from '../../__tests__/helpers/CatalogFixtures';
import { InventoryCountState } from '../InventoryCount';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('Product (domain)', () => {
  it('constructs with all props', () => {
    const now = new Date('2024-01-15T10:00:00Z');
    const product = new Product(createTestProductProps({
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

  it('auto-generates UUID', () => {
    const product = new Product(createTestProductProps());
    expect(product.Id).toMatch(UUID_REGEX);
  });

  it('defaults caption to empty string', () => {
    const product = new Product(createTestProductProps());
    expect(product.caption).toBe('');
  });

  it('defaults description to empty string', () => {
    const product = new Product(createTestProductProps());
    expect(product.description).toBe('');
  });

  it('defaults imageUrls/imageGsls to []', () => {
    const product = new Product(createTestProductProps());
    expect(product.imageUrls).toEqual([]);
    expect(product.imageGsls).toEqual([]);
  });

  it('defaults optionSets to {}', () => {
    const product = new Product(createTestProductProps());
    expect(product.optionSets).toEqual({});
  });

  it('defaults optionSetsSelection to {}', () => {
    const product = new Product(createTestProductProps());
    expect(product.optionSetsSelection).toEqual({});
  });

  it('defaults locationInventory to {}', () => {
    const product = new Product(createTestProductProps());
    expect(product.locationInventory).toEqual({});
  });

  it('defaults linkedObjects to {}', () => {
    const product = new Product(createTestProductProps());
    expect(product.linkedObjects).toEqual({});
  });

  it('metadata() returns ProductMeta', () => {
    const product = new Product(createTestProductProps({
      name: 'Pizza',
      isActive: false,
      imageUrls: ['pizza.jpg'],
      imageGsls: ['gs://pizza'],
      minPrice: 1000,
      maxPrice: 1500,
      variationCount: 2,
    }));
    expect(product.metadata()).toEqual({
      name: 'Pizza',
      isActive: false,
      imageUrls: ['pizza.jpg'],
      imageGsls: ['gs://pizza'],
      minPrice: 1000,
      maxPrice: 1500,
      variationCount: 2,
    });
  });

  it('inherits DomainEntity fields', () => {
    const now = new Date('2024-06-01T12:00:00Z');
    const product = new Product(createTestProductProps({ created: now, updated: now, isDeleted: true }));
    expect(product.created).toEqual(now);
    expect(product.updated).toEqual(now);
    expect(product.isDeleted).toBe(true);
  });

  it('instantiates without Firebase', () => {
    const product = new Product(createTestProductProps());
    expect(product).toBeDefined();
  });

  it('optionSets stores OptionSetMeta', () => {
    const product = new Product(createTestProductProps({
      optionSets: {
        'os-1': { name: 'Size', displayOrder: 1, displayTier: 0 },
        'os-2': { name: 'Toppings', displayOrder: 2, displayTier: 1 },
      },
    }));
    expect(product.optionSets['os-1'].name).toBe('Size');
    expect(product.optionSets['os-2'].displayTier).toBe(1);
  });

  it('locationInventory stores InventoryCount', () => {
    const product = new Product(createTestProductProps({
      locationInventory: {
        'loc-1': { count: 5, state: InventoryCountState.inStock, isAvailable: true },
        'loc-2': { count: 0, state: InventoryCountState.soldOut, isAvailable: false },
      },
    }));
    expect(product.locationInventory['loc-1'].count).toBe(5);
    expect(product.locationInventory['loc-2'].state).toBe(InventoryCountState.soldOut);
  });
});
