import { describe, it, expect } from 'vitest';
import { createDiscount, DiscountType } from '../Discount';
import { createTestDiscountInput } from '../../__tests__/helpers/CatalogFixtures';
import { ValidationError } from '../../validation';

describe('Discount (domain)', () => {
  it('constructs with all props', () => {
    const now = new Date('2024-01-15T10:00:00Z');
    const discount = createDiscount({
      ...createTestDiscountInput(),
      Id: 'disc-1',
      name: '10% Off',
      description: 'Holiday special',
      couponCode: 'SAVE10',
      type: DiscountType.percentage,
      value: 10,
      isActive: true,
      linkedObjects: { square: { linkedObjectId: 'sq-1' } },
      created: now,
      updated: now,
    });

    expect(discount.Id).toBe('disc-1');
    expect(discount.name).toBe('10% Off');
    expect(discount.description).toBe('Holiday special');
    expect(discount.couponCode).toBe('SAVE10');
    expect(discount.type).toBe(DiscountType.percentage);
    expect(discount.value).toBe(10);
    expect(discount.isActive).toBe(true);
    expect(discount.linkedObjects.square.linkedObjectId).toBe('sq-1');
  });

  it('DiscountType enum has expected values', () => {
    expect(DiscountType.percentage).toBe('percentage');
    expect(DiscountType.amount).toBe('amount');
    expect(DiscountType.unknown).toBe('unknown');
  });

  it('defaults description to empty string', () => {
    const discount = createDiscount(createTestDiscountInput());
    expect(discount.description).toBe('');
  });

  it('defaults couponCode to empty string', () => {
    const discount = createDiscount(createTestDiscountInput());
    expect(discount.couponCode).toBe('');
  });

  it('defaults linkedObjects to {}', () => {
    const discount = createDiscount(createTestDiscountInput());
    expect(discount.linkedObjects).toEqual({});
  });

  describe('validation', () => {
    it('allows empty name', () => {
      const discount = createDiscount(createTestDiscountInput({ name: '' }));
      expect(discount.name).toBe('');
    });

    it('throws for negative value', () => {
      expect(() => createDiscount(createTestDiscountInput({ value: -1 }))).toThrow(ValidationError);
    });

    it('allows zero value', () => {
      expect(() => createDiscount(createTestDiscountInput({ value: 0 }))).not.toThrow();
    });
  });

});
