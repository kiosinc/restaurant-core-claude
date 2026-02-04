import { describe, it, expect } from 'vitest';
import { TaxRate } from '../TaxRate';
import { createTestTaxRateProps } from '../../__tests__/helpers/CatalogFixtures';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('TaxRate (domain)', () => {
  it('constructs with all props', () => {
    const now = new Date('2024-01-15T10:00:00Z');
    const taxRate = new TaxRate(createTestTaxRateProps({
      Id: 'tax-1',
      name: 'State Tax',
      rate: 0.075,
      isCalculatedSubTotalPhase: true,
      isInclusive: false,
      linkedObjects: { square: { linkedObjectId: 'sq-1' } },
      created: now,
      updated: now,
    }));

    expect(taxRate.Id).toBe('tax-1');
    expect(taxRate.name).toBe('State Tax');
    expect(taxRate.rate).toBe(0.075);
    expect(taxRate.isCalculatedSubTotalPhase).toBe(true);
    expect(taxRate.isInclusive).toBe(false);
    expect(taxRate.linkedObjects.square.linkedObjectId).toBe('sq-1');
  });

  it('auto-generates UUID', () => {
    const taxRate = new TaxRate(createTestTaxRateProps());
    expect(taxRate.Id).toMatch(UUID_REGEX);
  });

  it('defaults linkedObjects to {}', () => {
    const taxRate = new TaxRate(createTestTaxRateProps());
    expect(taxRate.linkedObjects).toEqual({});
  });

  it('no metadata() method', () => {
    const taxRate = new TaxRate(createTestTaxRateProps());
    expect('metadata' in taxRate).toBe(false);
  });

  it('inherits DomainEntity fields', () => {
    const now = new Date('2024-06-01T12:00:00Z');
    const taxRate = new TaxRate(createTestTaxRateProps({ created: now, updated: now, isDeleted: true }));
    expect(taxRate.created).toEqual(now);
    expect(taxRate.updated).toEqual(now);
    expect(taxRate.isDeleted).toBe(true);
  });

  it('instantiates without Firebase', () => {
    const taxRate = new TaxRate(createTestTaxRateProps());
    expect(taxRate).toBeDefined();
  });
});
