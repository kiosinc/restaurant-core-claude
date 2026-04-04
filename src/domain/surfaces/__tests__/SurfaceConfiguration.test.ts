import { describe, it, expect } from 'vitest';
import { createSurfaceConfiguration } from '../SurfaceConfiguration';
import { CoverConfiguration, CheckoutFlowConfiguration, TipConfiguration } from '../SurfaceConfiguration';
import { createTestSurfaceConfigurationInput } from '../../__tests__/helpers/SurfacesFixtures';
import { ValidationError } from '../../validation';

describe('SurfaceConfiguration (domain)', () => {
  it('constructs with all props', () => {
    const now = new Date('2024-01-15T10:00:00Z');
    const sc = createSurfaceConfiguration(createTestSurfaceConfigurationInput({
      Id: 'sc-1',
      name: 'Main Config',
      isChargeCustomerServiceFee: true,
      coverConfiguration: { isCoverNoticeEnabled: true, coverNoticeText: 'Welcome' },
      tipConfiguration: { isTipsEnabled: true, isSmartTipsEnabled: false },
      checkoutFlowConfiguration: {
        isCouponsEnabled: true, isSquareGiftCardEnabled: false, isOrderNoteEnabled: true,
        checkoutCustomerNamePromptText: null, checkoutCustomerPhoneNumberPromptHeading: null,
        checkoutCustomerPhoneNumberPromptText: null, isDineInEnabled: true, isDineInNoticeEnabled: false,
        dineInNoticeText: null, isDineInCustomerEnterIdEnabled: false, dineInCustomerEnterIdPrompt: null,
        isDineInCustomerNameRequired: false, dineInCustomerNameRequiredPrompt: null, isToGoEnabled: true,
        isToGoNoticeEnabled: false, toGoNoticeText: null, orderConfirmationText: 'Thank you!',
        isReferralCodeEnabled: false, referralCodePromptText: null,
      },
      version: '1.5',
      created: now,
      updated: now,
    }));

    expect(sc.Id).toBe('sc-1');
    expect(sc.name).toBe('Main Config');
    expect(sc.isChargeCustomerServiceFee).toBe(true);
    expect(sc.coverConfiguration!.isCoverNoticeEnabled).toBe(true);
    expect(sc.tipConfiguration!.isTipsEnabled).toBe(true);
    expect(sc.checkoutFlowConfiguration!.isCouponsEnabled).toBe(true);
    expect(sc.version).toBe('1.5');
  });

  it('defaults coverConfiguration to null', () => {
    const sc = createSurfaceConfiguration(createTestSurfaceConfigurationInput());
    expect(sc.coverConfiguration).toBeNull();
  });

  it('defaults tipConfiguration to null', () => {
    const sc = createSurfaceConfiguration(createTestSurfaceConfigurationInput());
    expect(sc.tipConfiguration).toBeNull();
  });

  it('defaults checkoutFlowConfiguration to null', () => {
    const sc = createSurfaceConfiguration(createTestSurfaceConfigurationInput());
    expect(sc.checkoutFlowConfiguration).toBeNull();
  });

  it('defaults version to 0.0', () => {
    const sc = createSurfaceConfiguration(createTestSurfaceConfigurationInput());
    expect(sc.version).toBe('0.0');
  });

  it('CoverConfiguration interface works', () => {
    const cover: CoverConfiguration = { isCoverNoticeEnabled: true, coverNoticeText: 'Hello' };
    expect(cover.isCoverNoticeEnabled).toBe(true);
    expect(cover.coverNoticeText).toBe('Hello');
  });

  it('CheckoutFlowConfiguration interface works', () => {
    const config: CheckoutFlowConfiguration = {
      isCouponsEnabled: false, isSquareGiftCardEnabled: false, isOrderNoteEnabled: false,
      checkoutCustomerNamePromptText: null, checkoutCustomerPhoneNumberPromptHeading: null,
      checkoutCustomerPhoneNumberPromptText: null, isDineInEnabled: false, isDineInNoticeEnabled: false,
      dineInNoticeText: null, isDineInCustomerEnterIdEnabled: false, dineInCustomerEnterIdPrompt: null,
      isDineInCustomerNameRequired: false, dineInCustomerNameRequiredPrompt: null, isToGoEnabled: false,
      isToGoNoticeEnabled: false, toGoNoticeText: null, orderConfirmationText: null,
      isReferralCodeEnabled: false, referralCodePromptText: null,
    };
    expect(config.isCouponsEnabled).toBe(false);
  });

  it('TipConfiguration interface works', () => {
    const tip: TipConfiguration = { isTipsEnabled: true, isSmartTipsEnabled: true };
    expect(tip.isTipsEnabled).toBe(true);
    expect(tip.isSmartTipsEnabled).toBe(true);
  });

  describe('validation', () => {
    it('allows empty name', () => {
      const sc = createSurfaceConfiguration(createTestSurfaceConfigurationInput({ name: '' }));
      expect(sc.name).toBe('');
    });
  });

});
