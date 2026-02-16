import { describe, it, expect } from 'vitest';
import { createMenu, menuMeta } from '../Menu';
import { createTestMenuInput } from '../../__tests__/helpers/SurfacesFixtures';
import { ValidationError } from '../../validation';

describe('Menu (domain)', () => {
  it('constructs with all props', () => {
    const now = new Date('2024-01-15T10:00:00Z');
    const menu = createMenu({
      ...createTestMenuInput(),
      Id: 'menu-1',
      name: 'Lunch Menu',
      displayName: 'Lunch',
      groups: { 'mg-1': { name: 'Appetizers', displayName: 'Apps' } },
      groupDisplayOrder: ['mg-1'],
      coverImageGsl: 'gs://cover',
      coverBackgroundImageGsl: 'gs://bg',
      coverVideoGsl: 'gs://video',
      logoImageGsl: 'gs://logo',
      gratuityRates: [15, 18, 20],
      managedBy: 'square',
      created: now,
      updated: now,
    });

    expect(menu.Id).toBe('menu-1');
    expect(menu.name).toBe('Lunch Menu');
    expect(menu.displayName).toBe('Lunch');
    expect(menu.groups['mg-1'].name).toBe('Appetizers');
    expect(menu.groupDisplayOrder).toEqual(['mg-1']);
    expect(menu.coverImageGsl).toBe('gs://cover');
    expect(menu.coverBackgroundImageGsl).toBe('gs://bg');
    expect(menu.coverVideoGsl).toBe('gs://video');
    expect(menu.logoImageGsl).toBe('gs://logo');
    expect(menu.gratuityRates).toEqual([15, 18, 20]);
    expect(menu.managedBy).toBe('square');
  });

  it('defaults displayName to null', () => {
    const menu = createMenu(createTestMenuInput());
    expect(menu.displayName).toBeNull();
  });

  it('defaults groups to {}', () => {
    const menu = createMenu(createTestMenuInput());
    expect(menu.groups).toEqual({});
  });

  it('defaults groupDisplayOrder to []', () => {
    const menu = createMenu(createTestMenuInput());
    expect(menu.groupDisplayOrder).toEqual([]);
  });

  it('defaults coverImageGsl to null', () => {
    const menu = createMenu(createTestMenuInput());
    expect(menu.coverImageGsl).toBeNull();
  });

  it('defaults coverBackgroundImageGsl to null', () => {
    const menu = createMenu(createTestMenuInput());
    expect(menu.coverBackgroundImageGsl).toBeNull();
  });

  it('defaults coverVideoGsl to null', () => {
    const menu = createMenu(createTestMenuInput());
    expect(menu.coverVideoGsl).toBeNull();
  });

  it('defaults logoImageGsl to null', () => {
    const menu = createMenu(createTestMenuInput());
    expect(menu.logoImageGsl).toBeNull();
  });

  it('defaults gratuityRates to []', () => {
    const menu = createMenu(createTestMenuInput());
    expect(menu.gratuityRates).toEqual([]);
  });

  it('defaults managedBy to null', () => {
    const menu = createMenu(createTestMenuInput());
    expect(menu.managedBy).toBeNull();
  });

  it('menuMeta() returns MenuMeta', () => {
    const menu = createMenu(createTestMenuInput({
      name: 'Dinner',
      displayName: 'Evening Menu',
    }));
    expect(menuMeta(menu)).toEqual({
      name: 'Dinner',
      displayName: 'Evening Menu',
    });
  });

  describe('validation', () => {
    it('throws for empty name', () => {
      expect(() => createMenu(createTestMenuInput({ name: '' }))).toThrow(ValidationError);
    });
  });

});
