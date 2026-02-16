import { describe, it, expect } from 'vitest';
import { createCheckoutOptions, CheckoutOptionType } from '../CheckoutOptions';
import { TipOptions, FulfillmentOption, ManualIdConfig } from '../CheckoutOptions';
import { createTestCheckoutOptionsInput } from '../../__tests__/helpers/SurfacesFixtures';
import { ValidationError } from '../../validation';

describe('CheckoutOptions (domain)', () => {
  it('constructs with all props', () => {
    const now = new Date('2024-01-15T10:00:00Z');
    const co = createCheckoutOptions(createTestCheckoutOptionsInput({
      Id: 'co-1',
      name: 'Default Checkout',
      discounts: { isEnabled: true },
      giftCards: { isEnabled: true },
      referralCodes: { isEnabled: false },
      tipOptions: { isEnabled: true, isSmartTipEnabled: false, tipAmounts: [15, 18, 20], preselectedIdx: 1 },
      fulfillmentOptions: {
        toGo: {
          isEnabled: true,
          scheduleOptions: { isEnabled: false },
          contactOptions: { isEnabled: true },
          manualIdOptions: { isEnabled: false },
          options: [],
        },
      },
      created: now,
      updated: now,
    }));

    expect(co.Id).toBe('co-1');
    expect(co.name).toBe('Default Checkout');
    expect(co.discounts.isEnabled).toBe(true);
    expect(co.giftCards.isEnabled).toBe(true);
    expect(co.tipOptions!.tipAmounts).toEqual([15, 18, 20]);
    expect(co.fulfillmentOptions['toGo']!.isEnabled).toBe(true);
  });

  it('defaults tipOptions to null', () => {
    const co = createCheckoutOptions(createTestCheckoutOptionsInput());
    expect(co.tipOptions).toBeNull();
  });

  it('defaults fulfillmentOptions to {}', () => {
    const co = createCheckoutOptions(createTestCheckoutOptionsInput());
    expect(co.fulfillmentOptions).toEqual({});
  });

  it('CheckoutOptionType enum has expected values', () => {
    expect(CheckoutOptionType.switch).toBe('switch');
    expect(CheckoutOptionType.quantity).toBe('quantity');
  });

  it('TipOptions interface works', () => {
    const tip: TipOptions = { isEnabled: true, isSmartTipEnabled: true, tipAmounts: [10, 15, 20], preselectedIdx: 0 };
    expect(tip.isEnabled).toBe(true);
    expect(tip.tipAmounts).toEqual([10, 15, 20]);
  });

  it('FulfillmentOption interface works', () => {
    const fo: FulfillmentOption = {
      isEnabled: true,
      scheduleOptions: { isEnabled: true },
      contactOptions: { isEnabled: false },
      manualIdOptions: { isEnabled: true, config: { title: 'Table', text: 'Enter number', isQREnabled: true } },
      options: [{ name: 'Utensils', type: CheckoutOptionType.switch, productId: 'prod-1' }],
    };
    expect(fo.isEnabled).toBe(true);
    expect(fo.options[0].type).toBe(CheckoutOptionType.switch);
  });

  it('ManualIdConfig interface works', () => {
    const config: ManualIdConfig = { title: 'Table Number', text: 'Please enter', isQREnabled: false };
    expect(config.title).toBe('Table Number');
    expect(config.isQREnabled).toBe(false);
  });

  describe('validation', () => {
    it('throws for empty name', () => {
      expect(() => createCheckoutOptions(createTestCheckoutOptionsInput({ name: '' }))).toThrow(ValidationError);
    });
  });

});
