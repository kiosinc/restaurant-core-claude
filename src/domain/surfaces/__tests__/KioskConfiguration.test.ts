import { describe, it, expect } from 'vitest';
import { createKioskConfiguration } from '../KioskConfiguration';
import { createTestKioskConfigurationInput } from '../../__tests__/helpers/SurfacesFixtures';
import { ValidationError } from '../../validation';

describe('KioskConfiguration (domain)', () => {
  it('constructs with all props', () => {
    const now = new Date('2024-01-15T10:00:00Z');
    const kc = createKioskConfiguration(createTestKioskConfigurationInput({
      Id: 'kc-1',
      name: 'Front Kiosk',
      unlockCode: '1234',
      checkoutOptionId: 'co-1',
      version: '2.0',
      created: now,
      updated: now,
    }));

    expect(kc.Id).toBe('kc-1');
    expect(kc.name).toBe('Front Kiosk');
    expect(kc.unlockCode).toBe('1234');
    expect(kc.checkoutOptionId).toBe('co-1');
    expect(kc.version).toBe('2.0');
  });

  it('defaults unlockCode to null', () => {
    const kc = createKioskConfiguration(createTestKioskConfigurationInput());
    expect(kc.unlockCode).toBeNull();
  });

  it('defaults checkoutOptionId to null', () => {
    const kc = createKioskConfiguration(createTestKioskConfigurationInput());
    expect(kc.checkoutOptionId).toBeNull();
  });

  it('defaults version to 1.0', () => {
    const kc = createKioskConfiguration(createTestKioskConfigurationInput());
    expect(kc.version).toBe('1.0');
  });

  describe('validation', () => {
    it('allows empty name', () => {
      const kc = createKioskConfiguration(createTestKioskConfigurationInput({ name: '' }));
      expect(kc.name).toBe('');
    });
  });

});
