import { describe, it, expect } from 'vitest';
import { BusinessProfile } from '../BusinessProfile';

describe('BusinessProfile (domain)', () => {
  it('BusinessProfile interface works', () => {
    const profile: BusinessProfile = {
      name: 'My Restaurant',
      address: { addressLine1: '123 Main', addressLine2: '', city: 'LA', state: 'CA', zip: '90001', country: 'US' },
      shippingAddress: { addressLine1: '456 Oak', addressLine2: '', city: 'SF', state: 'CA', zip: '94102', country: 'US' },
    };
    expect(profile.name).toBe('My Restaurant');
    expect(profile.address!.city).toBe('LA');
    expect(profile.shippingAddress!.city).toBe('SF');
  });

  it('address is optional', () => {
    const profile: BusinessProfile = { name: 'No Address Biz' };
    expect(profile.name).toBe('No Address Biz');
    expect(profile.address).toBeUndefined();
  });

  it('shippingAddress is optional', () => {
    const profile: BusinessProfile = {
      name: 'No Shipping',
      address: { addressLine1: '789 Elm', addressLine2: '', city: 'NYC', state: 'NY', zip: '10001', country: 'US' },
    };
    expect(profile.shippingAddress).toBeUndefined();
  });
});
