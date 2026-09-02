import { describe, it, expect } from 'vitest';
import { createServices } from '../Services';
import { ValidationError } from '../../validation';

describe('Services', () => {
  it('constructs with all props', () => {
    const svc = createServices({ kioskFeeRate: 2.5, experiments: { darkMode: true } });
    expect(svc.kioskFeeRate).toBe(2.5);
    expect(svc.experiments).toEqual({ darkMode: true });
  });

  it('defaults kioskFeeRate to 1.5', () => {
    const svc = createServices({});
    expect(svc.kioskFeeRate).toBe(1.5);
  });

  it('defaults experiments to {}', () => {
    const svc = createServices({ kioskFeeRate: 1.0 });
    expect(svc.experiments).toEqual({});
  });

  it('instantiates without Firebase', () => {
    const svc = createServices({ kioskFeeRate: 1.5, experiments: {} });
    expect(svc).toBeDefined();
    expect(svc.Id).toBeDefined();
  });

  describe('validation', () => {
    it('throws for negative kioskFeeRate', () => {
      expect(() => createServices({ kioskFeeRate: -1 })).toThrow(ValidationError);
    });

    it('allows omitted kioskFeeRate (defaults to 1.5)', () => {
      expect(() => createServices({})).not.toThrow();
    });
  });

  // #63 (P6 Stage 0-1) deliberately adds NOTHING here: no `devFeeRate`, `devFeeAmount`,
  // `devFeeOrderMax`, `devFeeMonthMax` or `isUsePlanAppFee`. Only `Order.appFee` and the
  // `roundHalfEven` helper land in this stage, and the billing-profile fields come later. This
  // test pins the shape so a later stage cannot quietly widen it here, and pins the 1.5
  // `kioskFeeRate` seed that abbevillian-era businesses rely on.
  //
  // Key set = `baseEntityDefaults` (Id/created/updated/isDeleted always; syncTraceId only when
  // supplied, and it is not here) plus the two fields createServices adds.
  it('#63 — createServices({}) shape and defaults are unchanged (no devFee* fields)', () => {
    const svc = createServices({});
    expect(Object.keys(svc).sort())
      .toEqual(['Id', 'created', 'experiments', 'isDeleted', 'kioskFeeRate', 'updated']);
    expect(svc.kioskFeeRate).toBe(1.5);
    expect(svc.experiments).toEqual({});
  });
});
