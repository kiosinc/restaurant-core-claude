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
      dietaryPreferences: [],
      allergens: [],
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

    it('throws for a non-string name', () => {
      expect(() => createProduct(createTestProductInput({ name: undefined as unknown as string })))
        .toThrow(ValidationError);
    });

    it('allows minPrice equal to maxPrice', () => {
      expect(() => createProduct(createTestProductInput({ minPrice: 500, maxPrice: 500 }))).not.toThrow();
    });
  });

  // #93: minPrice/maxPrice/variationCount are recomputed by catalog sync on every pass, so a
  // document missing or holding a bad value is repairable — but only if it can be read first.
  // Throwing on them made productConverter.fromFirestore unreadable, which aborted the Items
  // stage before the recompute that would have fixed it. 481 products across 20 businesses.
  describe('#93 — derived fields default on read', () => {
    const legacyProductInput = { name: 'Legacy' } as unknown as Parameters<typeof createProduct>[0];

    it('hydrates a document with no derived fields instead of throwing', () => {
      const product = createProduct(legacyProductInput);
      expect(product.minPrice).toBe(0);
      expect(product.maxPrice).toBe(0);
      expect(product.variationCount).toBe(0);
    });

    it('defaults a negative minPrice/maxPrice to 0', () => {
      const product = createProduct(createTestProductInput({ minPrice: -1, maxPrice: -1 }));
      expect(product.minPrice).toBe(0);
      expect(product.maxPrice).toBe(0);
    });

    it('defaults a non-integer or negative variationCount to 0', () => {
      expect(createProduct(createTestProductInput({ variationCount: -1 })).variationCount).toBe(0);
      expect(createProduct(createTestProductInput({ variationCount: 1.5 })).variationCount).toBe(0);
    });

    it('clamps minPrice to maxPrice rather than throwing on the invariant', () => {
      const product = createProduct(createTestProductInput({ minPrice: 1000, maxPrice: 500 }));
      expect(product.minPrice).toBe(500);
      expect(product.maxPrice).toBe(500);
    });

    it('leaves valid derived values untouched', () => {
      const product = createProduct(createTestProductInput({ minPrice: 500, maxPrice: 800, variationCount: 3 }));
      expect(product.minPrice).toBe(500);
      expect(product.maxPrice).toBe(800);
      expect(product.variationCount).toBe(3);
    });

    // #204: defaulting the ABSENT side of the pair to 0 let that 0 win the clamp below, so a
    // one-sided document hydrated as 0/0 and any hydrate→mutate→save writer made the zero
    // durable. Mirroring keeps min <= max without inventing a price the catalog never had.
    it('mirrors a lone minPrice to maxPrice instead of zeroing both', () => {
      const product = createProduct({ name: 'Legacy', minPrice: 5 } as unknown as Parameters<typeof createProduct>[0]);
      expect(product.minPrice).toBe(5);
      expect(product.maxPrice).toBe(5);
    });

    it('mirrors a lone maxPrice to minPrice instead of zeroing both', () => {
      const product = createProduct({ name: 'Legacy', maxPrice: 5 } as unknown as Parameters<typeof createProduct>[0]);
      expect(product.minPrice).toBe(5);
      expect(product.maxPrice).toBe(5);
    });

    it('treats a negative side as absent and mirrors the present one', () => {
      const product = createProduct(createTestProductInput({ minPrice: 5, maxPrice: -1 }));
      expect(product.minPrice).toBe(5);
      expect(product.maxPrice).toBe(5);
    });

    // Boundary: 0 is a real price. A truthiness test for "present" would mirror the 5 back over
    // it and turn a free item into a $0.05 one.
    it('keeps a lone minPrice of 0 at 0/0', () => {
      const product = createProduct({ name: 'Legacy', minPrice: 0 } as unknown as Parameters<typeof createProduct>[0]);
      expect(product.minPrice).toBe(0);
      expect(product.maxPrice).toBe(0);
    });

    it('leaves a both-present pair exactly as supplied', () => {
      const product = createProduct(createTestProductInput({ minPrice: 500, maxPrice: 800 }));
      expect(product.minPrice).toBe(500);
      expect(product.maxPrice).toBe(800);
    });
  });

  // #204: `calorieCount` was emitted unconditionally, so a product without one carried an
  // explicit undefined into every converter-based write. Absent means unknown — the key is
  // omitted rather than defaulted, because 0 calories is a claim.
  describe('#204 — calorieCount is omitted when unknown', () => {
    it('omits the key entirely when no calorieCount is supplied', () => {
      const product = createProduct(createTestProductInput());
      // `in`, not toBeUndefined(): a present-but-undefined key satisfies toBeUndefined, so that
      // assertion would pass under the pre-#204 behaviour this test exists to pin.
      expect('calorieCount' in product).toBe(false);
    });

    it('preserves a supplied calorieCount', () => {
      expect(createProduct(createTestProductInput({ calorieCount: 250 })).calorieCount).toBe(250);
    });

    it('preserves a calorieCount of 0', () => {
      const product = createProduct(createTestProductInput({ calorieCount: 0 }));
      expect('calorieCount' in product).toBe(true);
      expect(product.calorieCount).toBe(0);
    });
  });

  // #198: isActive was the one field createProduct neither defaulted nor validated, so an
  // absent key survived hydration and productMeta emitted undefined — rejected far downstream,
  // at the consumer's raw batch.update().
  describe('#198 — isActive defaults', () => {
    it('defaults an absent isActive to false', () => {
      const product = createProduct(
        { name: 'Legacy' } as unknown as Parameters<typeof createProduct>[0],
      );
      expect(product.isActive).toBe(false);
    });

    it('preserves an explicit isActive', () => {
      expect(createProduct(createTestProductInput({ isActive: true })).isActive).toBe(true);
      expect(createProduct(createTestProductInput({ isActive: false })).isActive).toBe(false);
    });
  });
});
