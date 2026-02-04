import { describe, it, expect } from 'vitest';
import { OptionSet, ProductOptionSetSetting } from '../OptionSet';
import { createTestOptionSetProps } from '../../__tests__/helpers/CatalogFixtures';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('OptionSet (domain)', () => {
  it('constructs with all props', () => {
    const now = new Date('2024-01-15T10:00:00Z');
    const os = new OptionSet(createTestOptionSetProps({
      Id: 'os-1',
      name: 'Size',
      options: { 'opt-1': { name: 'Small', isActive: true } },
      minSelection: 1,
      maxSelection: 3,
      displayOrder: 2,
      displayTier: 1,
      optionDisplayOrder: ['opt-1'],
      preselectedOptionIds: ['opt-1'],
      imageUrls: ['img.jpg'],
      imageGsls: ['gs://img'],
      isActive: true,
      linkedObjects: { square: { linkedObjectId: 'sq-1' } },
      created: now,
      updated: now,
    }));

    expect(os.Id).toBe('os-1');
    expect(os.name).toBe('Size');
    expect(os.options['opt-1'].name).toBe('Small');
    expect(os.minSelection).toBe(1);
    expect(os.maxSelection).toBe(3);
    expect(os.displayOrder).toBe(2);
    expect(os.displayTier).toBe(1);
    expect(os.optionDisplayOrder).toEqual(['opt-1']);
    expect(os.preselectedOptionIds).toEqual(['opt-1']);
    expect(os.imageUrls).toEqual(['img.jpg']);
    expect(os.imageGsls).toEqual(['gs://img']);
    expect(os.isActive).toBe(true);
    expect(os.linkedObjects.square.linkedObjectId).toBe('sq-1');
  });

  it('auto-generates UUID', () => {
    const os = new OptionSet(createTestOptionSetProps());
    expect(os.Id).toMatch(UUID_REGEX);
  });

  it('defaults options to {}', () => {
    const os = new OptionSet(createTestOptionSetProps());
    expect(os.options).toEqual({});
  });

  it('defaults optionDisplayOrder to []', () => {
    const os = new OptionSet(createTestOptionSetProps());
    expect(os.optionDisplayOrder).toEqual([]);
  });

  it('defaults preselectedOptionIds to []', () => {
    const os = new OptionSet(createTestOptionSetProps());
    expect(os.preselectedOptionIds).toEqual([]);
  });

  it('defaults imageUrls/imageGsls to []', () => {
    const os = new OptionSet(createTestOptionSetProps());
    expect(os.imageUrls).toEqual([]);
    expect(os.imageGsls).toEqual([]);
  });

  it('defaults locationInventory to {}', () => {
    const os = new OptionSet(createTestOptionSetProps());
    expect(os.locationInventory).toEqual({});
  });

  it('defaults linkedObjects to {}', () => {
    const os = new OptionSet(createTestOptionSetProps());
    expect(os.linkedObjects).toEqual({});
  });

  it('metadata() returns OptionSetMeta', () => {
    const os = new OptionSet(createTestOptionSetProps({
      name: 'Toppings',
      displayOrder: 5,
      displayTier: 2,
    }));
    expect(os.metadata()).toEqual({
      name: 'Toppings',
      displayOrder: 5,
      displayTier: 2,
    });
  });

  it('ProductOptionSetSetting interface works', () => {
    const setting: ProductOptionSetSetting = {
      minSelection: 0,
      maxSelection: 3,
      preSelected: ['opt-1'],
      isActive: true,
    };
    expect(setting.minSelection).toBe(0);
    expect(setting.preSelected).toEqual(['opt-1']);
  });

  it('inherits DomainEntity fields', () => {
    const now = new Date('2024-06-01T12:00:00Z');
    const os = new OptionSet(createTestOptionSetProps({ created: now, updated: now, isDeleted: true }));
    expect(os.created).toEqual(now);
    expect(os.updated).toEqual(now);
    expect(os.isDeleted).toBe(true);
  });

  it('instantiates without Firebase', () => {
    const os = new OptionSet(createTestOptionSetProps());
    expect(os).toBeDefined();
  });
});
