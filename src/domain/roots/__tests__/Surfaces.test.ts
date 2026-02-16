import { describe, it, expect } from 'vitest';
import { createSurfaces } from '../Surfaces';

describe('Surfaces', () => {
  it('constructs with all props', () => {
    const menus = { 'm-1': { name: 'Lunch', displayName: 'Lunch Menu' } };
    const menuGroups = { 'mg-1': { name: 'Sides', displayName: null } };
    const surfaces = createSurfaces({ menus, menuGroups });
    expect(surfaces.menus).toEqual(menus);
    expect(surfaces.menuGroups).toEqual(menuGroups);
  });

  it('defaults menus to {} when nullish', () => {
    const surfaces = createSurfaces({ menus: undefined as any, menuGroups: {} });
    expect(surfaces.menus).toEqual({});
  });

  it('defaults menuGroups to {} when nullish', () => {
    const surfaces = createSurfaces({ menus: {}, menuGroups: undefined as any });
    expect(surfaces.menuGroups).toEqual({});
  });

  it('menus stores MenuMeta', () => {
    const surfaces = createSurfaces({
      menus: { 'm-1': { name: 'Dinner', displayName: 'Dinner Menu' } },
      menuGroups: {},
    });
    expect(surfaces.menus['m-1'].name).toBe('Dinner');
    expect(surfaces.menus['m-1'].displayName).toBe('Dinner Menu');
  });

  it('menuGroups stores MenuGroupMeta', () => {
    const surfaces = createSurfaces({
      menus: {},
      menuGroups: { 'mg-1': { name: 'Appetizers', displayName: null } },
    });
    expect(surfaces.menuGroups['mg-1'].name).toBe('Appetizers');
    expect(surfaces.menuGroups['mg-1'].displayName).toBeNull();
  });

  it('creates plain object with BaseEntity fields', () => {
    const surfaces = createSurfaces({ menus: {}, menuGroups: {} });
    expect(surfaces.Id).toBeDefined();
    expect(surfaces.created).toBeInstanceOf(Date);
    expect(surfaces.updated).toBeInstanceOf(Date);
    expect(surfaces.isDeleted).toBe(false);
  });
});
