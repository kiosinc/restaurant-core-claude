import { describe, it, expect } from 'vitest';
import { Address, emptyAddress } from '../Address';

describe('Address (domain)', () => {
  it('Address interface works', () => {
    const addr: Address = {
      addressLine1: '123 Main St',
      addressLine2: 'Apt 4',
      city: 'New York',
      state: 'NY',
      zip: '10001',
      country: 'US',
    };
    expect(addr.addressLine1).toBe('123 Main St');
    expect(addr.city).toBe('New York');
    expect(addr.country).toBe('US');
  });

  it('emptyAddress has all empty strings', () => {
    expect(emptyAddress.addressLine1).toBe('');
    expect(emptyAddress.addressLine2).toBe('');
    expect(emptyAddress.city).toBe('');
    expect(emptyAddress.state).toBe('');
    expect(emptyAddress.zip).toBe('');
    expect(emptyAddress.country).toBe('');
  });
});
