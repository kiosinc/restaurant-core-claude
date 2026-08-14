import { describe, it, expect } from 'vitest';
import { createMenuGroup, menuGroupMeta, MenuGroupMeta } from '../MenuGroup';
import { createTestMenuGroupInput } from '../../__tests__/helpers/SurfacesFixtures';
import { ValidationError } from '../../validation';

describe('MenuGroup (domain)', () => {
  it('constructs with all props', () => {
    const now = new Date('2024-01-15T10:00:00Z');
    const mg = createMenuGroup({
      ...createTestMenuGroupInput(),
      Id: 'mg-1',
      name: 'Appetizers',
      displayName: 'Starters',
      products: { 'prod-1': { name: 'Fries', isActive: true, imageUrls: [], imageGsls: [], minPrice: 500, maxPrice: 500, variationCount: 1 } },
      productDisplayOrder: ['prod-1'],
      parentGroup: 'mg-parent',
      childGroup: 'mg-child',
      mirrorCategoryId: 'cat-1',
      managedBy: 'square',
      created: now,
      updated: now,
    });

    expect(mg.Id).toBe('mg-1');
    expect(mg.name).toBe('Appetizers');
    expect(mg.displayName).toBe('Starters');
    expect(mg.products['prod-1'].name).toBe('Fries');
    expect(mg.productDisplayOrder).toEqual(['prod-1']);
    expect(mg.parentGroup).toBe('mg-parent');
    expect(mg.childGroup).toBe('mg-child');
    expect(mg.mirrorCategoryId).toBe('cat-1');
    expect(mg.managedBy).toBe('square');
  });

  it('defaults displayName to null', () => {
    const mg = createMenuGroup(createTestMenuGroupInput());
    expect(mg.displayName).toBeNull();
  });

  it('defaults products to {}', () => {
    const mg = createMenuGroup(createTestMenuGroupInput());
    expect(mg.products).toEqual({});
  });

  it('defaults productDisplayOrder to []', () => {
    const mg = createMenuGroup(createTestMenuGroupInput());
    expect(mg.productDisplayOrder).toEqual([]);
  });

  it('defaults parentGroup to null', () => {
    const mg = createMenuGroup(createTestMenuGroupInput());
    expect(mg.parentGroup).toBeNull();
  });

  it('defaults childGroup to null', () => {
    const mg = createMenuGroup(createTestMenuGroupInput());
    expect(mg.childGroup).toBeNull();
  });

  it('defaults mirrorCategoryId to null', () => {
    const mg = createMenuGroup(createTestMenuGroupInput());
    expect(mg.mirrorCategoryId).toBeNull();
  });

  it('defaults managedBy to null', () => {
    const mg = createMenuGroup(createTestMenuGroupInput());
    expect(mg.managedBy).toBeNull();
  });

  it('menuGroupMeta() returns MenuGroupMeta', () => {
    const mg = createMenuGroup(createTestMenuGroupInput({
      name: 'Entrees',
      displayName: 'Main Dishes',
    }));
    expect(menuGroupMeta(mg)).toEqual({
      name: 'Entrees',
      displayName: 'Main Dishes',
    });
  });

  it('MenuGroupMeta carries managedBy', () => {
    const meta: MenuGroupMeta = { name: 'G', displayName: null, managedBy: 'square' };
    expect(meta.managedBy).toBe('square');
  });

  it('menuGroupMeta() does not project managedBy (rebuild owns it)', () => {
    const mg = createMenuGroup(createTestMenuGroupInput({ managedBy: 'square' }));
    expect('managedBy' in menuGroupMeta(mg)).toBe(false);
  });

  it('products stores ProductMeta', () => {
    const mg = createMenuGroup(createTestMenuGroupInput({
      products: {
        'prod-1': { name: 'Burger', isActive: true, imageUrls: ['burger.jpg'], imageGsls: [], minPrice: 1000, maxPrice: 1200, variationCount: 2 },
        'prod-2': { name: 'Pizza', isActive: false, imageUrls: [], imageGsls: ['gs://pizza'], minPrice: 800, maxPrice: 800, variationCount: 1 },
      },
    }));
    expect(mg.products['prod-1'].name).toBe('Burger');
    expect(mg.products['prod-2'].isActive).toBe(false);
  });

  it('products stores squareOrdinal on ProductMeta', () => {
    const mg = createMenuGroup(createTestMenuGroupInput({
      products: {
        'prod-1': { name: 'Sauteed Kale', isActive: true, imageUrls: [], imageGsls: [], minPrice: 500, maxPrice: 500, variationCount: 1, squareOrdinal: 68719476736 },
      },
    }));
    expect(mg.products['prod-1'].squareOrdinal).toBe(68719476736);
  });

  it('createMenuGroup does not rewrite products entries to inject squareOrdinal', () => {
    const products = {
      'prod-1': { name: 'Burger', isActive: true, imageUrls: [], imageGsls: [], minPrice: 500, maxPrice: 500, variationCount: 1 },
    };
    const mg = createMenuGroup(createTestMenuGroupInput({ products }));
    expect(mg.products['prod-1']).toBe(products['prod-1']);
    expect('squareOrdinal' in mg.products['prod-1']).toBe(false);
  });

  describe('validation', () => {
    it('allows empty name', () => {
      const mg = createMenuGroup(createTestMenuGroupInput({ name: '' }));
      expect(mg.name).toBe('');
    });
  });

});
