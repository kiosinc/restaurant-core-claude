import { describe, it, expect } from 'vitest';
import { createOption, optionMeta } from '../Option';
import { createTestOptionInput, createTestInventoryCount } from '../../__tests__/helpers/CatalogFixtures';
import { ValidationError } from '../../validation';

describe('Option (domain)', () => {
  it('constructs with all props', () => {
    const now = new Date('2024-01-15T10:00:00Z');
    const option = createOption(createTestOptionInput({
      Id: 'opt-1',
      name: 'Large',
      price: 250,
      sku: 'SKU-001',
      gtin: 'GTIN-001',
      imageUrls: ['img1.jpg'],
      imageGsls: ['gs://img1'],
      locationPrices: { 'loc-1': 300 },
      locationInventory: { 'loc-1': createTestInventoryCount() },
      isActive: true,
      linkedObjects: { square: { linkedObjectId: 'sq-1' } },
      created: now,
      updated: now,
    }));

    expect(option.Id).toBe('opt-1');
    expect(option.name).toBe('Large');
    expect(option.price).toBe(250);
    expect(option.sku).toBe('SKU-001');
    expect(option.gtin).toBe('GTIN-001');
    expect(option.imageUrls).toEqual(['img1.jpg']);
    expect(option.imageGsls).toEqual(['gs://img1']);
    expect(option.locationPrices['loc-1']).toBe(300);
    expect(option.locationInventory['loc-1'].count).toBe(10);
    expect(option.isActive).toBe(true);
    expect(option.linkedObjects.square.linkedObjectId).toBe('sq-1');
  });

  it('uses provided Id', () => {
    const option = createOption(createTestOptionInput({ Id: 'opt-123' }));
    expect(option.Id).toBe('opt-123');
  });

  it('defaults sku to null', () => {
    const option = createOption(createTestOptionInput());
    expect(option.sku).toBeNull();
  });

  it('defaults gtin to null', () => {
    const option = createOption(createTestOptionInput());
    expect(option.gtin).toBeNull();
  });

  it('defaults imageUrls to []', () => {
    const option = createOption(createTestOptionInput());
    expect(option.imageUrls).toEqual([]);
  });

  it('defaults imageGsls to []', () => {
    const option = createOption(createTestOptionInput());
    expect(option.imageGsls).toEqual([]);
  });

  it('defaults locationPrices to {}', () => {
    const option = createOption(createTestOptionInput());
    expect(option.locationPrices).toEqual({});
  });

  it('defaults locationInventory to {}', () => {
    const option = createOption(createTestOptionInput());
    expect(option.locationInventory).toEqual({});
  });

  it('defaults linkedObjects to {}', () => {
    const option = createOption(createTestOptionInput());
    expect(option.linkedObjects).toEqual({});
  });

  it('optionMeta() returns OptionMeta', () => {
    const option = createOption(createTestOptionInput({ name: 'Small', isActive: false }));
    expect(optionMeta(option)).toEqual({ name: 'Small', isActive: false });
  });

  it('name is mutable', () => {
    const option = createOption(createTestOptionInput({ name: 'Original' }));
    option.name = 'Updated';
    expect(option.name).toBe('Updated');
  });

  it('price is mutable', () => {
    const option = createOption(createTestOptionInput({ price: 100 }));
    option.price = 200;
    expect(option.price).toBe(200);
  });

  describe('validation', () => {
    it('allows empty name', () => {
      const option = createOption(createTestOptionInput({ name: '' }));
      expect(option.name).toBe('');
    });

    it('throws for negative price', () => {
      expect(() => createOption(createTestOptionInput({ price: -1 }))).toThrow(ValidationError);
    });

    it('allows zero price', () => {
      expect(() => createOption(createTestOptionInput({ price: 0 }))).not.toThrow();
    });
  });
});
