import { describe, it, expect } from 'vitest';
import { createCatalog } from '../Catalog';

describe('Catalog', () => {
  it('constructs with no args', () => {
    const catalog = createCatalog();
    expect(catalog.Id).toBeDefined();
  });

  it('constructs with explicit props', () => {
    const ts = new Date('2024-01-01T00:00:00Z');
    const catalog = createCatalog({ Id: 'catalog', created: ts, updated: ts, isDeleted: false });
    expect(catalog.Id).toBe('catalog');
    expect(catalog.created.getTime()).toBe(ts.getTime());
    expect(catalog.updated.getTime()).toBe(ts.getTime());
  });

  it('has BaseEntity fields', () => {
    const catalog = createCatalog();
    expect(catalog.created).toBeInstanceOf(Date);
    expect(catalog.updated).toBeInstanceOf(Date);
    expect(catalog.isDeleted).toBe(false);
  });

  it('instantiates without Firebase', () => {
    const catalog = createCatalog();
    expect(catalog).toBeDefined();
  });
});
