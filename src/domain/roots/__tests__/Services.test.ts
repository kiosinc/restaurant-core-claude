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
});
