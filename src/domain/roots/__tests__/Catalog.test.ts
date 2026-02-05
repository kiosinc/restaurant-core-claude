import { describe, it, expect } from 'vitest';
import { Catalog } from '../Catalog';
import { DomainEntity } from '../../DomainEntity';

describe('Catalog', () => {
  it('constructs with no args', () => {
    const catalog = new Catalog();
    expect(catalog).toBeInstanceOf(Catalog);
    expect(catalog.Id).toBeDefined();
  });

  it('constructs with explicit props', () => {
    const ts = new Date('2024-01-01T00:00:00Z');
    const catalog = new Catalog({ Id: 'catalog', created: ts, updated: ts, isDeleted: false });
    expect(catalog.Id).toBe('catalog');
    expect(catalog.created.getTime()).toBe(ts.getTime());
    expect(catalog.updated.getTime()).toBe(ts.getTime());
  });

  it('inherits DomainEntity fields', () => {
    const catalog = new Catalog();
    expect(catalog).toBeInstanceOf(DomainEntity);
    expect(catalog.created).toBeInstanceOf(Date);
    expect(catalog.updated).toBeInstanceOf(Date);
    expect(catalog.isDeleted).toBe(false);
  });

  it('instantiates without Firebase', () => {
    const catalog = new Catalog();
    expect(catalog).toBeInstanceOf(Catalog);
  });
});
