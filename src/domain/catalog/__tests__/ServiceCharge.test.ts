import { describe, it, expect } from 'vitest';
import { ServiceCharge, ServiceChargeType } from '../ServiceCharge';
import { createTestServiceChargeProps } from '../../__tests__/helpers/CatalogFixtures';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('ServiceCharge (domain)', () => {
  it('constructs with all props', () => {
    const now = new Date('2024-01-15T10:00:00Z');
    const sc = new ServiceCharge(createTestServiceChargeProps({
      Id: 'sc-1',
      name: 'Delivery Fee',
      value: 500,
      type: ServiceChargeType.amount,
      isCalculatedSubTotalPhase: false,
      isTaxable: true,
      linkedObjects: { square: { linkedObjectId: 'sq-1' } },
      created: now,
      updated: now,
    }));

    expect(sc.Id).toBe('sc-1');
    expect(sc.name).toBe('Delivery Fee');
    expect(sc.value).toBe(500);
    expect(sc.type).toBe(ServiceChargeType.amount);
    expect(sc.isCalculatedSubTotalPhase).toBe(false);
    expect(sc.isTaxable).toBe(true);
    expect(sc.linkedObjects.square.linkedObjectId).toBe('sq-1');
  });

  it('auto-generates UUID', () => {
    const sc = new ServiceCharge(createTestServiceChargeProps());
    expect(sc.Id).toMatch(UUID_REGEX);
  });

  it('ServiceChargeType enum has expected values', () => {
    expect(ServiceChargeType.percentage).toBe('percentage');
    expect(ServiceChargeType.amount).toBe('amount');
  });

  it('defaults linkedObjects to {}', () => {
    const sc = new ServiceCharge(createTestServiceChargeProps());
    expect(sc.linkedObjects).toEqual({});
  });

  it('inherits DomainEntity fields', () => {
    const now = new Date('2024-06-01T12:00:00Z');
    const sc = new ServiceCharge(createTestServiceChargeProps({ created: now, updated: now, isDeleted: true }));
    expect(sc.created).toEqual(now);
    expect(sc.updated).toEqual(now);
    expect(sc.isDeleted).toBe(true);
  });

  it('instantiates without Firebase', () => {
    const sc = new ServiceCharge(createTestServiceChargeProps());
    expect(sc).toBeDefined();
  });
});
