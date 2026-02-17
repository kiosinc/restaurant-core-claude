import { describe, it, expect } from 'vitest';
import { createServiceCharge, ServiceChargeType } from '../ServiceCharge';
import { createTestServiceChargeInput } from '../../__tests__/helpers/CatalogFixtures';
import { ValidationError } from '../../validation';

describe('ServiceCharge (domain)', () => {
  it('constructs with all props', () => {
    const now = new Date('2024-01-15T10:00:00Z');
    const sc = createServiceCharge({
      ...createTestServiceChargeInput(),
      Id: 'sc-1',
      name: 'Delivery Fee',
      value: 500,
      type: ServiceChargeType.amount,
      isCalculatedSubTotalPhase: false,
      isTaxable: true,
      linkedObjects: { square: { linkedObjectId: 'sq-1' } },
      created: now,
      updated: now,
    });

    expect(sc.Id).toBe('sc-1');
    expect(sc.name).toBe('Delivery Fee');
    expect(sc.value).toBe(500);
    expect(sc.type).toBe(ServiceChargeType.amount);
    expect(sc.isCalculatedSubTotalPhase).toBe(false);
    expect(sc.isTaxable).toBe(true);
    expect(sc.linkedObjects.square.linkedObjectId).toBe('sq-1');
  });

  it('ServiceChargeType enum has expected values', () => {
    expect(ServiceChargeType.percentage).toBe('percentage');
    expect(ServiceChargeType.amount).toBe('amount');
  });

  it('defaults linkedObjects to {}', () => {
    const sc = createServiceCharge(createTestServiceChargeInput());
    expect(sc.linkedObjects).toEqual({});
  });

  describe('validation', () => {
    it('allows empty name', () => {
      const sc = createServiceCharge(createTestServiceChargeInput({ name: '' }));
      expect(sc.name).toBe('');
    });

    it('throws for negative value', () => {
      expect(() => createServiceCharge(createTestServiceChargeInput({ value: -1 }))).toThrow(ValidationError);
    });

    it('allows zero value', () => {
      expect(() => createServiceCharge(createTestServiceChargeInput({ value: 0 }))).not.toThrow();
    });
  });

});
