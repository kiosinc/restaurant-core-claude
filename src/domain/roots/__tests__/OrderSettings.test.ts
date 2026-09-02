import { describe, it, expect } from 'vitest';
import { OrderSettings, createOrderSettings } from '../Orders';

function createFullInput(overrides: Partial<OrderSettings> = {}) {
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
    const os = createOrderSettings(createFullInput());
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
    const os = createOrderSettings(createFullInput({ gratuityRates: undefined as any }));
    expect(os.gratuityRates).toEqual([10, 15, 20]);
  });

  it('defaults isSquareAutoApplyTaxes to true', () => {
    const os = createOrderSettings(createFullInput({ isSquareAutoApplyTaxes: undefined as any }));
    expect(os.isSquareAutoApplyTaxes).toBe(true);
  });

  it('defaults isKioskSessionIdleTimerOn to true', () => {
    const os = createOrderSettings(createFullInput({ isKioskSessionIdleTimerOn: undefined as any }));
    expect(os.isKioskSessionIdleTimerOn).toBe(true);
  });

  it('defaults isFreeOrdersEnabled to false (#216)', () => {
    const os = createOrderSettings(createFullInput({ isFreeOrdersEnabled: undefined as any }));
    expect(os.isFreeOrdersEnabled).toBe(false);
  });

  it('keeps an explicit isFreeOrdersEnabled: true', () => {
    const os = createOrderSettings(createFullInput({ isFreeOrdersEnabled: true }));
    expect(os.isFreeOrdersEnabled).toBe(true);
  });

  it('keeps an explicit isFreeOrdersEnabled: false', () => {
    const os = createOrderSettings(createFullInput({ isFreeOrdersEnabled: false }));
    expect(os.isFreeOrdersEnabled).toBe(false);
  });

  it('defaults other booleans to false', () => {
    const os = createOrderSettings(createFullInput({
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
    const os = createOrderSettings(createFullInput({
      ticketHeaderFormat: undefined as any,
      smsReadyTextFormat: undefined as any,
      smsReceiptTextFormat: undefined as any,
    }));
    expect(os.ticketHeaderFormat).toBeNull();
    expect(os.smsReadyTextFormat).toBeNull();
    expect(os.smsReceiptTextFormat).toBeNull();
  });

  it('creates plain object with BaseEntity fields', () => {
    const os = createOrderSettings(createFullInput());
    expect(os.Id).toBeDefined();
    expect(os.created).toBeInstanceOf(Date);
    expect(os.updated).toBeInstanceOf(Date);
    expect(os.isDeleted).toBe(false);
  });

  it('resolves every default from the minimal required input (#216)', () => {
    const pinned = new Date('2024-01-15T10:00:00.000Z');
    const os = createOrderSettings({
      isSMSStateUpdate: true,
      isLoyaltyAccrue: true,
      isStateAutoNewToInProgress: false,
      Id: 'orders',
      created: pinned,
      updated: pinned,
    });

    expect(os).toEqual({
      Id: 'orders',
      created: pinned,
      updated: pinned,
      isDeleted: false,
      isSMSStateUpdate: true,
      isLoyaltyAccrue: true,
      isStateAutoNewToInProgress: false,
      gratuityRates: [10, 15, 20],
      isSquareDiscountCodeAPI: false,
      isSquareAutoApplyDiscounts: false,
      isSquareAutoApplyTaxes: true,
      isSquareDiscountCodeAutoEnabled: false,
      isKioskSessionIdleTimerOn: true,
      isFreeOrdersEnabled: false,
      isSingleLineItemsOnly: false,
      ticketHeaderFormat: null,
      smsReadyTextFormat: null,
      smsReceiptTextFormat: null,
    });
  });
});
