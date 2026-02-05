import { describe, it, expect } from 'vitest';
import { Services } from '../Services';
import { DomainEntity } from '../../DomainEntity';

describe('Services', () => {
  it('constructs with all props', () => {
    const svc = new Services({ kioskFeeRate: 2.5, experiments: { darkMode: true } });
    expect(svc.kioskFeeRate).toBe(2.5);
    expect(svc.experiments).toEqual({ darkMode: true });
  });

  it('defaults kioskFeeRate to 1.5', () => {
    const svc = new Services({ kioskFeeRate: undefined as any, experiments: {} });
    expect(svc.kioskFeeRate).toBe(1.5);
  });

  it('defaults experiments to {}', () => {
    const svc = new Services({ kioskFeeRate: 1.0, experiments: undefined as any });
    expect(svc.experiments).toEqual({});
  });

  it('instantiates without Firebase', () => {
    const svc = new Services({ kioskFeeRate: 1.5, experiments: {} });
    expect(svc).toBeInstanceOf(DomainEntity);
    expect(svc).toBeInstanceOf(Services);
  });
});
