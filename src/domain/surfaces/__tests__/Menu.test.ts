import { describe, it, expect } from 'vitest';
import { Menu } from '../Menu';
import { createTestMenuProps } from '../../__tests__/helpers/SurfacesFixtures';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('Menu (domain)', () => {
  it('constructs with all props', () => {
    const now = new Date('2024-01-15T10:00:00Z');
    const menu = new Menu(createTestMenuProps({
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
      created: now,
      updated: now,
    }));

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
  });

  it('auto-generates UUID when no Id', () => {
    const menu = new Menu(createTestMenuProps());
    expect(menu.Id).toMatch(UUID_REGEX);
  });

  it('defaults displayName to null', () => {
    const menu = new Menu(createTestMenuProps());
    expect(menu.displayName).toBeNull();
  });

  it('defaults groups to {}', () => {
    const menu = new Menu(createTestMenuProps());
    expect(menu.groups).toEqual({});
  });

  it('defaults groupDisplayOrder to []', () => {
    const menu = new Menu(createTestMenuProps());
    expect(menu.groupDisplayOrder).toEqual([]);
  });

  it('defaults coverImageGsl to null', () => {
    const menu = new Menu(createTestMenuProps());
    expect(menu.coverImageGsl).toBeNull();
  });

  it('defaults coverBackgroundImageGsl to null', () => {
    const menu = new Menu(createTestMenuProps());
    expect(menu.coverBackgroundImageGsl).toBeNull();
  });

  it('defaults coverVideoGsl to null', () => {
    const menu = new Menu(createTestMenuProps());
    expect(menu.coverVideoGsl).toBeNull();
  });

  it('defaults logoImageGsl to null', () => {
    const menu = new Menu(createTestMenuProps());
    expect(menu.logoImageGsl).toBeNull();
  });

  it('defaults gratuityRates to []', () => {
    const menu = new Menu(createTestMenuProps());
    expect(menu.gratuityRates).toEqual([]);
  });

  it('metadata() returns MenuMeta', () => {
    const menu = new Menu(createTestMenuProps({
      name: 'Dinner',
      displayName: 'Evening Menu',
    }));
    expect(menu.metadata()).toEqual({
      name: 'Dinner',
      displayName: 'Evening Menu',
    });
  });

  it('inherits DomainEntity fields', () => {
    const now = new Date('2024-06-01T12:00:00Z');
    const menu = new Menu(createTestMenuProps({ created: now, updated: now, isDeleted: true }));
    expect(menu.created).toEqual(now);
    expect(menu.updated).toEqual(now);
    expect(menu.isDeleted).toBe(true);
  });

  it('instantiates without Firebase', () => {
    const menu = new Menu(createTestMenuProps());
    expect(menu).toBeDefined();
  });
});
