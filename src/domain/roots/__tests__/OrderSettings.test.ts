import { describe, it, expect } from 'vitest';
import { OrderSettings, OrderSettingsProps } from '../Orders';
import { DomainEntity } from '../../DomainEntity';

function createFullProps(overrides: Partial<OrderSettingsProps> = {}): OrderSettingsProps {
  return {
    isSMSStateUpdate: true,
    isLoyaltyAccrue: true,
    isStateAutoNewToInProgress: true,
    gratuityRates: [5, 10, 15],
    isSquareDiscountCodeAPI: true,
    isSquareAutoApplyDiscounts: true,
    isSquareAutoApplyTaxes: false,
    isSquareDiscountCodeAutoEnabled: true,
    isKioskSessionIdleTimerOn: false,
    isFreeOrdersEnabled: false,
    isSingleLineItemsOnly: true,
    ticketHeaderFormat: { dineIn: 'Table {table}' },
    smsReadyTextFormat: { pickup: 'Ready!' },
    smsReceiptTextFormat: { delivery: 'Delivered!' },
    ...overrides,
  };
}

describe('OrderSettings', () => {
  it('constructs with all props', () => {
    const os = new OrderSettings(createFullProps());
    expect(os.isSMSStateUpdate).toBe(true);
    expect(os.isLoyaltyAccrue).toBe(true);
    expect(os.isStateAutoNewToInProgress).toBe(true);
    expect(os.gratuityRates).toEqual([5, 10, 15]);
    expect(os.isSquareDiscountCodeAPI).toBe(true);
    expect(os.isSquareAutoApplyDiscounts).toBe(true);
    expect(os.isSquareAutoApplyTaxes).toBe(false);
    expect(os.isSquareDiscountCodeAutoEnabled).toBe(true);
    expect(os.isKioskSessionIdleTimerOn).toBe(false);
    expect(os.isFreeOrdersEnabled).toBe(false);
    expect(os.isSingleLineItemsOnly).toBe(true);
    expect(os.ticketHeaderFormat).toEqual({ dineIn: 'Table {table}' });
    expect(os.smsReadyTextFormat).toEqual({ pickup: 'Ready!' });
    expect(os.smsReceiptTextFormat).toEqual({ delivery: 'Delivered!' });
  });

  it('defaults gratuityRates to [10, 15, 20]', () => {
    const os = new OrderSettings(createFullProps({ gratuityRates: undefined as any }));
    expect(os.gratuityRates).toEqual([10, 15, 20]);
  });

  it('defaults isSquareAutoApplyTaxes to true', () => {
    const os = new OrderSettings(createFullProps({ isSquareAutoApplyTaxes: undefined as any }));
    expect(os.isSquareAutoApplyTaxes).toBe(true);
  });

  it('defaults isKioskSessionIdleTimerOn to true', () => {
    const os = new OrderSettings(createFullProps({ isKioskSessionIdleTimerOn: undefined as any }));
    expect(os.isKioskSessionIdleTimerOn).toBe(true);
  });

  it('defaults isFreeOrdersEnabled to true', () => {
    const os = new OrderSettings(createFullProps({ isFreeOrdersEnabled: undefined as any }));
    expect(os.isFreeOrdersEnabled).toBe(true);
  });

  it('defaults other booleans to false', () => {
    const os = new OrderSettings(createFullProps({
      isSquareDiscountCodeAPI: undefined as any,
      isSquareAutoApplyDiscounts: undefined as any,
      isSquareDiscountCodeAutoEnabled: undefined as any,
      isSingleLineItemsOnly: undefined as any,
    }));
    expect(os.isSquareDiscountCodeAPI).toBe(false);
    expect(os.isSquareAutoApplyDiscounts).toBe(false);
    expect(os.isSquareDiscountCodeAutoEnabled).toBe(false);
    expect(os.isSingleLineItemsOnly).toBe(false);
  });

  it('defaults format maps to null', () => {
    const os = new OrderSettings(createFullProps({
      ticketHeaderFormat: undefined as any,
      smsReadyTextFormat: undefined as any,
      smsReceiptTextFormat: undefined as any,
    }));
    expect(os.ticketHeaderFormat).toBeNull();
    expect(os.smsReadyTextFormat).toBeNull();
    expect(os.smsReceiptTextFormat).toBeNull();
  });

  it('instantiates without Firebase', () => {
    const os = new OrderSettings(createFullProps());
    expect(os).toBeInstanceOf(DomainEntity);
    expect(os).toBeInstanceOf(OrderSettings);
  });
});
