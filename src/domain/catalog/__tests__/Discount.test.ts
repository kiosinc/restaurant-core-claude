import { describe, it, expect } from 'vitest';
import { Discount, DiscountType } from '../Discount';
import { createTestDiscountProps } from '../../__tests__/helpers/CatalogFixtures';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('Discount (domain)', () => {
  it('constructs with all props', () => {
    const now = new Date('2024-01-15T10:00:00Z');
    const discount = new Discount(createTestDiscountProps({
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
    }));

    expect(discount.Id).toBe('disc-1');
    expect(discount.name).toBe('10% Off');
    expect(discount.description).toBe('Holiday special');
    expect(discount.couponCode).toBe('SAVE10');
    expect(discount.type).toBe(DiscountType.percentage);
    expect(discount.value).toBe(10);
    expect(discount.isActive).toBe(true);
    expect(discount.linkedObjects.square.linkedObjectId).toBe('sq-1');
  });

  it('auto-generates UUID', () => {
    const discount = new Discount(createTestDiscountProps());
    expect(discount.Id).toMatch(UUID_REGEX);
  });

  it('DiscountType enum has expected values', () => {
    expect(DiscountType.percentage).toBe('percentage');
    expect(DiscountType.amount).toBe('amount');
    expect(DiscountType.unknown).toBe('unknown');
  });

  it('defaults description to empty string', () => {
    const discount = new Discount(createTestDiscountProps());
    expect(discount.description).toBe('');
  });

  it('defaults couponCode to empty string', () => {
    const discount = new Discount(createTestDiscountProps());
    expect(discount.couponCode).toBe('');
  });

  it('defaults linkedObjects to {}', () => {
    const discount = new Discount(createTestDiscountProps());
    expect(discount.linkedObjects).toEqual({});
  });

  it('inherits DomainEntity fields', () => {
    const now = new Date('2024-06-01T12:00:00Z');
    const discount = new Discount(createTestDiscountProps({ created: now, updated: now, isDeleted: true }));
    expect(discount.created).toEqual(now);
    expect(discount.updated).toEqual(now);
    expect(discount.isDeleted).toBe(true);
  });

  it('instantiates without Firebase', () => {
    const discount = new Discount(createTestDiscountProps());
    expect(discount).toBeDefined();
  });
});
