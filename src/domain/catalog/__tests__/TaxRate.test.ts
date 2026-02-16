import { describe, it, expect } from 'vitest';
import { createTaxRate } from '../TaxRate';
import { createTestTaxRateInput } from '../../__tests__/helpers/CatalogFixtures';
import { ValidationError } from '../../validation';

describe('TaxRate (domain)', () => {
  it('constructs with all props', () => {
    const now = new Date('2024-01-15T10:00:00Z');
    const taxRate = createTaxRate({
      ...createTestTaxRateInput(),
      Id: 'tax-1',
      name: 'State Tax',
      rate: 0.075,
      isCalculatedSubTotalPhase: true,
      isInclusive: false,
      linkedObjects: { square: { linkedObjectId: 'sq-1' } },
      created: now,
      updated: now,
    });

    expect(taxRate.Id).toBe('tax-1');
    expect(taxRate.name).toBe('State Tax');
    expect(taxRate.rate).toBe(0.075);
    expect(taxRate.isCalculatedSubTotalPhase).toBe(true);
    expect(taxRate.isInclusive).toBe(false);
    expect(taxRate.linkedObjects.square.linkedObjectId).toBe('sq-1');
  });

  it('defaults linkedObjects to {}', () => {
    const taxRate = createTaxRate(createTestTaxRateInput());
    expect(taxRate.linkedObjects).toEqual({});
  });

  it('no metadata() method', () => {
    const taxRate = createTaxRate(createTestTaxRateInput());
    expect('metadata' in taxRate).toBe(false);
  });

  describe('validation', () => {
    it('throws for empty name', () => {
      expect(() => createTaxRate({ ...createTestTaxRateInput(), name: '' })).toThrow(ValidationError);
    });

    it('throws for negative rate', () => {
      expect(() => createTaxRate({ ...createTestTaxRateInput(), rate: -0.05 })).toThrow(ValidationError);
    });

    it('allows zero rate', () => {
      expect(() => createTaxRate({ ...createTestTaxRateInput(), rate: 0 })).not.toThrow();
    });
  });

});
