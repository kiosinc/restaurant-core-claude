import { describe, it, expect } from 'vitest';
import { createOptionSet, optionSetMeta, ProductOptionSetSetting } from '../OptionSet';
import { createTestOptionSetInput } from '../../__tests__/helpers/CatalogFixtures';
import { ValidationError } from '../../validation';

describe('OptionSet (domain)', () => {
  it('constructs with all props', () => {
    const now = new Date('2024-01-15T10:00:00Z');
    const os = createOptionSet(createTestOptionSetInput({
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

  it('defaults options to {}', () => {
    const os = createOptionSet(createTestOptionSetInput());
    expect(os.options).toEqual({});
  });

  it('defaults optionDisplayOrder to []', () => {
    const os = createOptionSet(createTestOptionSetInput());
    expect(os.optionDisplayOrder).toEqual([]);
  });

  it('defaults preselectedOptionIds to []', () => {
    const os = createOptionSet(createTestOptionSetInput());
    expect(os.preselectedOptionIds).toEqual([]);
  });

  it('defaults imageUrls/imageGsls to []', () => {
    const os = createOptionSet(createTestOptionSetInput());
    expect(os.imageUrls).toEqual([]);
    expect(os.imageGsls).toEqual([]);
  });

  it('defaults locationInventory to {}', () => {
    const os = createOptionSet(createTestOptionSetInput());
    expect(os.locationInventory).toEqual({});
  });

  it('defaults linkedObjects to {}', () => {
    const os = createOptionSet(createTestOptionSetInput());
    expect(os.linkedObjects).toEqual({});
  });

  it('optionSetMeta() returns OptionSetMeta', () => {
    const os = createOptionSet(createTestOptionSetInput({
      name: 'Toppings',
      displayOrder: 5,
      displayTier: 2,
    }));
    expect(optionSetMeta(os)).toEqual({
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

  describe('validation', () => {
    it('allows empty name', () => {
      const os = createOptionSet(createTestOptionSetInput({ name: '' }));
      expect(os.name).toBe('');
    });

    it('allows -1 sentinel for minSelection', () => {
      expect(() => createOptionSet(createTestOptionSetInput({ minSelection: -1, maxSelection: -1 }))).not.toThrow();
    });

    it('throws for minSelection < -1', () => {
      expect(() => createOptionSet(createTestOptionSetInput({ minSelection: -2 }))).toThrow(ValidationError);
    });

    it('allows -1 sentinel for maxSelection', () => {
      expect(() => createOptionSet(createTestOptionSetInput({ maxSelection: -1 }))).not.toThrow();
    });

    it('throws for maxSelection < -1', () => {
      expect(() => createOptionSet(createTestOptionSetInput({ maxSelection: -2 }))).toThrow(ValidationError);
    });

    it('throws when minSelection > maxSelection', () => {
      expect(() => createOptionSet(createTestOptionSetInput({ minSelection: 5, maxSelection: 2 }))).toThrow(ValidationError);
    });

    it('allows minSelection equal to maxSelection', () => {
      expect(() => createOptionSet(createTestOptionSetInput({ minSelection: 1, maxSelection: 1 }))).not.toThrow();
    });

    it('throws for negative displayOrder', () => {
      expect(() => createOptionSet(createTestOptionSetInput({ displayOrder: -1 }))).toThrow(ValidationError);
    });

    it('throws for negative displayTier', () => {
      expect(() => createOptionSet(createTestOptionSetInput({ displayTier: -1 }))).toThrow(ValidationError);
    });
  });

});
