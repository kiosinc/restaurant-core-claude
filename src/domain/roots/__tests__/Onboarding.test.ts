import { describe, it, expect } from 'vitest';
import {
  Onboarding, OnboardingStage, OnboardingStageStatus, DEFAULT_ONBOARDING_STATUS,
} from '../Onboarding';
import { DomainEntity } from '../../DomainEntity';

describe('Onboarding', () => {
  it('constructs with all props', () => {
    const status = { [OnboardingStage.createBusiness]: OnboardingStageStatus.complete };
    const ob = new Onboarding({
      stripeCustomerId: 'cus_123',
      onboardingStatus: status,
      onboardingOrderId: 'order-1',
      menuCategories: ['cat-1', 'cat-2'],
    });
    expect(ob.stripeCustomerId).toBe('cus_123');
    expect(ob.onboardingStatus[OnboardingStage.createBusiness]).toBe(OnboardingStageStatus.complete);
    expect(ob.onboardingOrderId).toBe('order-1');
    expect(ob.menuCategories).toEqual(['cat-1', 'cat-2']);
  });

  it('defaults onboardingStatus to DEFAULT_ONBOARDING_STATUS', () => {
    const ob = new Onboarding({
      stripeCustomerId: null,
      onboardingStatus: null,
      onboardingOrderId: null,
      menuCategories: null,
    });
    const stages = Object.values(OnboardingStage);
    for (const stage of stages) {
      expect(ob.onboardingStatus[stage]).toBe(OnboardingStageStatus.pending);
    }
  });

  it('OnboardingStage enum has all 12 values', () => {
    const values = Object.values(OnboardingStage);
    expect(values).toHaveLength(12);
    expect(values).toContain('createBusiness');
    expect(values).toContain('squareIntegration');
    expect(values).toContain('categorySync');
    expect(values).toContain('scheduleMeeting');
    expect(values).toContain('configMenu');
    expect(values).toContain('menuCreate');
    expect(values).toContain('onboardingSync');
    expect(values).toContain('shippingInfo');
    expect(values).toContain('kioskPurchase');
    expect(values).toContain('kioskCheckout');
    expect(values).toContain('previewKiosk');
    expect(values).toContain('onboardingComplete');
  });

  it('OnboardingStageStatus enum has 3 values', () => {
    const values = Object.values(OnboardingStageStatus);
    expect(values).toHaveLength(3);
    expect(values).toContain('pending');
    expect(values).toContain('complete');
    expect(values).toContain('skipped');
  });

  it('defaults stripeCustomerId to null', () => {
    const ob = new Onboarding({
      stripeCustomerId: undefined as any,
      onboardingStatus: null,
      onboardingOrderId: null,
      menuCategories: null,
    });
    expect(ob.stripeCustomerId).toBeNull();
  });

  it('defaults onboardingOrderId to null', () => {
    const ob = new Onboarding({
      stripeCustomerId: null,
      onboardingStatus: null,
      onboardingOrderId: undefined as any,
      menuCategories: null,
    });
    expect(ob.onboardingOrderId).toBeNull();
  });

  it('defaults menuCategories to null', () => {
    const ob = new Onboarding({
      stripeCustomerId: null,
      onboardingStatus: null,
      onboardingOrderId: null,
      menuCategories: undefined as any,
    });
    expect(ob.menuCategories).toBeNull();
  });

  it('instantiates without Firebase', () => {
    const ob = new Onboarding({
      stripeCustomerId: null,
      onboardingStatus: null,
      onboardingOrderId: null,
      menuCategories: null,
    });
    expect(ob).toBeInstanceOf(DomainEntity);
    expect(ob).toBeInstanceOf(Onboarding);
  });
});
