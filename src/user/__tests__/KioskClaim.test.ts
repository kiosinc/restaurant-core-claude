import { describe, it, expect } from 'vitest';
import { buildKioskClaim, type KioskClaim } from '../User';

describe('buildKioskClaim', () => {
  it('happy path — with claimsVersion returns the full kiosk claim literal', () => {
    const claim = buildKioskClaim({
      businessId: 'biz-1',
      locationId: 'loc-1',
      claimsVersion: 3,
    });

    expect(claim).toEqual({
      role: 'kiosk',
      businessId: 'biz-1',
      locationId: 'loc-1',
      claimsVersion: 3,
    });
  });

  it('omitted claimsVersion — key is present and undefined (matches the businesses literal exactly)', () => {
    const claim = buildKioskClaim({ businessId: 'biz-1', locationId: 'loc-1' });

    expect(claim.role).toBe('kiosk');
    expect(claim.businessId).toBe('biz-1');
    expect(claim.locationId).toBe('loc-1');
    expect(claim.claimsVersion).toBeUndefined();
    // The key must exist on the object so the produced claim is byte-identical
    // to the current `{ role, businessId, locationId, claimsVersion }` literal.
    expect('claimsVersion' in claim).toBe(true);
  });

  it('role is always the literal "kiosk" regardless of inputs', () => {
    expect(buildKioskClaim({ businessId: '', locationId: '' }).role).toBe('kiosk');
  });

  it('boundary — empty-string ids pass through unchanged (permissive, mirrors auth-middleware attach)', () => {
    const claim = buildKioskClaim({ businessId: '', locationId: '', claimsVersion: 7 });

    expect(claim).toEqual({
      role: 'kiosk',
      businessId: '',
      locationId: '',
      claimsVersion: 7,
    });
  });

  it('boundary — claimsVersion 0 is preserved, not coerced or dropped', () => {
    const claim = buildKioskClaim({ businessId: 'biz-1', locationId: 'loc-1', claimsVersion: 0 });

    expect(claim.claimsVersion).toBe(0);
  });

  it('result is assignable to a Firebase custom-claims object (Record<string, unknown>)', () => {
    const claim: KioskClaim = buildKioskClaim({ businessId: 'biz-1', locationId: 'loc-1' });
    // Compile-time check: the claim is a valid setCustomUserClaims argument.
    const customClaims: Record<string, unknown> = claim;

    expect(customClaims.role).toBe('kiosk');
  });
});
