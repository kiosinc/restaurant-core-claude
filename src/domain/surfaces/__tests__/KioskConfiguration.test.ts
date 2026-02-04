import { describe, it, expect } from 'vitest';
import { KioskConfiguration } from '../KioskConfiguration';
import { createTestKioskConfigurationProps } from '../../__tests__/helpers/SurfacesFixtures';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('KioskConfiguration (domain)', () => {
  it('constructs with all props', () => {
    const now = new Date('2024-01-15T10:00:00Z');
    const kc = new KioskConfiguration(createTestKioskConfigurationProps({
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

  it('auto-generates UUID', () => {
    const kc = new KioskConfiguration(createTestKioskConfigurationProps());
    expect(kc.Id).toMatch(UUID_REGEX);
  });

  it('defaults unlockCode to null', () => {
    const kc = new KioskConfiguration(createTestKioskConfigurationProps());
    expect(kc.unlockCode).toBeNull();
  });

  it('defaults checkoutOptionId to null', () => {
    const kc = new KioskConfiguration(createTestKioskConfigurationProps());
    expect(kc.checkoutOptionId).toBeNull();
  });

  it('defaults version to 1.0', () => {
    const kc = new KioskConfiguration(createTestKioskConfigurationProps());
    expect(kc.version).toBe('1.0');
  });

  it('inherits DomainEntity fields', () => {
    const now = new Date('2024-06-01T12:00:00Z');
    const kc = new KioskConfiguration(createTestKioskConfigurationProps({ created: now, updated: now, isDeleted: true }));
    expect(kc.created).toEqual(now);
    expect(kc.updated).toEqual(now);
    expect(kc.isDeleted).toBe(true);
  });

  it('instantiates without Firebase', () => {
    const kc = new KioskConfiguration(createTestKioskConfigurationProps());
    expect(kc).toBeDefined();
  });
});
