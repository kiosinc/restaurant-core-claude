import { describe, it, expect } from 'vitest';
import { Option } from '../Option';
import { createTestOptionProps, createTestInventoryCount } from '../../__tests__/helpers/CatalogFixtures';
import { InventoryCountState } from '../InventoryCount';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('Option (domain)', () => {
  it('constructs with all props', () => {
    const now = new Date('2024-01-15T10:00:00Z');
    const option = new Option(createTestOptionProps({
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

  it('auto-generates UUID when no Id', () => {
    const option = new Option(createTestOptionProps());
    expect(option.Id).toMatch(UUID_REGEX);
  });

  it('uses provided Id', () => {
    const option = new Option(createTestOptionProps({ Id: 'opt-123' }));
    expect(option.Id).toBe('opt-123');
  });

  it('defaults sku to null', () => {
    const option = new Option(createTestOptionProps());
    expect(option.sku).toBeNull();
  });

  it('defaults gtin to null', () => {
    const option = new Option(createTestOptionProps());
    expect(option.gtin).toBeNull();
  });

  it('defaults imageUrls to []', () => {
    const option = new Option(createTestOptionProps());
    expect(option.imageUrls).toEqual([]);
  });

  it('defaults imageGsls to []', () => {
    const option = new Option(createTestOptionProps());
    expect(option.imageGsls).toEqual([]);
  });

  it('defaults locationPrices to {}', () => {
    const option = new Option(createTestOptionProps());
    expect(option.locationPrices).toEqual({});
  });

  it('defaults locationInventory to {}', () => {
    const option = new Option(createTestOptionProps());
    expect(option.locationInventory).toEqual({});
  });

  it('defaults linkedObjects to {}', () => {
    const option = new Option(createTestOptionProps());
    expect(option.linkedObjects).toEqual({});
  });

  it('metadata() returns OptionMeta', () => {
    const option = new Option(createTestOptionProps({ name: 'Small', isActive: false }));
    expect(option.metadata()).toEqual({ name: 'Small', isActive: false });
  });

  it('inherits DomainEntity fields', () => {
    const now = new Date('2024-06-01T12:00:00Z');
    const option = new Option(createTestOptionProps({ created: now, updated: now, isDeleted: true }));
    expect(option.created).toEqual(now);
    expect(option.updated).toEqual(now);
    expect(option.isDeleted).toBe(true);
  });

  it('instantiates without Firebase', () => {
    const option = new Option(createTestOptionProps());
    expect(option).toBeDefined();
  });

  it('name is mutable', () => {
    const option = new Option(createTestOptionProps({ name: 'Original' }));
    option.name = 'Updated';
    expect(option.name).toBe('Updated');
  });

  it('price is mutable', () => {
    const option = new Option(createTestOptionProps({ price: 100 }));
    option.price = 200;
    expect(option.price).toBe(200);
  });
});
