import { describe, it, expect } from 'vitest';
import { createLocation, locationMeta } from '../Location';
import { createTestLocationInput } from '../../__tests__/helpers/LocationFixtures';
import { emptyAddress } from '../../misc/Address';
import { ValidationError } from '../../validation';

describe('Location (domain)', () => {
  it('constructs with all props', () => {
    const now = new Date('2024-01-15T10:00:00Z');
    const address = { ...emptyAddress, addressLine1: '123 Main St', city: 'Portland' };
    const location = createLocation({
      ...createTestLocationInput(),
      Id: 'loc-1',
      businessId: 'biz-1',
      name: 'Downtown',
      isActive: true,
      linkedObjects: { square: { linkedObjectId: 'sq-loc-1' } },
      address,
      isPrimary: true,
      dailyOrderCounter: 42,
      formattedAddress: '123 Main St, Portland',
      displayName: 'Downtown Store',
      imageUrls: ['https://img.example.com/1.jpg'],
      geoCoordinates: { geohash: 'abc', lat: 45.5, lng: -122.6 },
      utcOffset: -8,
      businessHours: { periods: [{ open: { day: 1, time: '0900' }, close: { day: 1, time: '1700' } }] },
      phoneNumber: '555-1234',
      email: 'downtown@example.com',
      currency: 'USD',
      isAcceptsMobileOrders: true,
      created: now,
      updated: now,
    });

    expect(location.Id).toBe('loc-1');
    expect(location.businessId).toBe('biz-1');
    expect(location.name).toBe('Downtown');
    expect(location.isActive).toBe(true);
    expect(location.linkedObjects.square.linkedObjectId).toBe('sq-loc-1');
    expect(location.address.addressLine1).toBe('123 Main St');
    expect(location.isPrimary).toBe(true);
    expect(location.dailyOrderCounter).toBe(42);
    expect(location.formattedAddress).toBe('123 Main St, Portland');
    expect(location.displayName).toBe('Downtown Store');
    expect(location.imageUrls).toEqual(['https://img.example.com/1.jpg']);
    expect(location.geoCoordinates!.lat).toBe(45.5);
    expect(location.utcOffset).toBe(-8);
    expect(location.businessHours!.periods).toHaveLength(1);
    expect(location.phoneNumber).toBe('555-1234');
    expect(location.email).toBe('downtown@example.com');
    expect(location.currency).toBe('USD');
    expect(location.isAcceptsMobileOrders).toBe(true);
  });

  it('uses provided Id', () => {
    const location = createLocation(createTestLocationInput({ Id: 'loc-123' }));
    expect(location.Id).toBe('loc-123');
  });

  it('has businessId', () => {
    const location = createLocation(createTestLocationInput({ businessId: 'biz-99' }));
    expect(location.businessId).toBe('biz-99');
  });

  it('defaults isPrimary to false', () => {
    const location = createLocation(createTestLocationInput());
    expect(location.isPrimary).toBe(false);
  });

  it('defaults dailyOrderCounter to 0', () => {
    const location = createLocation(createTestLocationInput());
    expect(location.dailyOrderCounter).toBe(0);
  });

  it('defaults nullable fields to null', () => {
    const location = createLocation(createTestLocationInput());
    expect(location.formattedAddress).toBeNull();
    expect(location.displayName).toBeNull();
    expect(location.geoCoordinates).toBeNull();
    expect(location.utcOffset).toBeNull();
    expect(location.businessHours).toBeNull();
    expect(location.phoneNumber).toBeNull();
    expect(location.email).toBeNull();
    expect(location.currency).toBeNull();
    expect(location.isAcceptsMobileOrders).toBeNull();
  });

  it('defaults imageUrls to empty array', () => {
    const location = createLocation(createTestLocationInput());
    expect(location.imageUrls).toEqual([]);
  });

  it('locationMeta() returns name and isActive', () => {
    const location = createLocation(createTestLocationInput({
      name: 'Test Location',
      isActive: false,
    }));
    expect(locationMeta(location)).toEqual({
      name: 'Test Location',
      isActive: false,
    });
  });

  it('locationMeta() reflects current field values', () => {
    const location = createLocation(createTestLocationInput({ name: 'Original', isActive: true }));
    location.name = 'Updated';
    location.isActive = false;
    expect(locationMeta(location)).toEqual({ name: 'Updated', isActive: false });
  });

  it('linkedObjects stores LinkedObjectRef', () => {
    const location = createLocation(createTestLocationInput({
      linkedObjects: {
        square: { linkedObjectId: 'sq-123' },
        system: { linkedObjectId: 'sys-456' },
      },
    }));
    expect(location.linkedObjects.square.linkedObjectId).toBe('sq-123');
    expect(location.linkedObjects.system.linkedObjectId).toBe('sys-456');
  });

  describe('validation', () => {
    it('throws for empty businessId', () => {
      expect(() => createLocation(createTestLocationInput({ businessId: '' }))).toThrow(ValidationError);
    });

    it('allows empty name', () => {
      const location = createLocation(createTestLocationInput({ name: '' }));
      expect(location.name).toBe('');
    });
  });
});
