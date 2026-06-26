/**
 * User Module
 * A User contains a decoded token plus principal-specific data.
 *
 * `User` is a discriminated union keyed on `role`:
 *  - `BusinessUser` (existing shape, no `role`) carries JWT `claims`.
 *  - `KioskUser` (`role: 'kiosk'`) carries `businessId`/`locationId`.
 *
 * Consumers narrow on `req.user.role === 'kiosk'` without casts.
 */
import * as admin from 'firebase-admin';
import * as Claims from './Claims';

/**
 * Business principal — the existing shape. Carries the JWT claims
 * (e.g. `claims.businessRole`). `role` is absent (the discriminator),
 * so the runtime shape is byte-identical to the legacy `User`.
 */
export interface BusinessUser {
  role?: undefined;
  claims: Claims.Body;
  token: admin.auth.DecodedIdToken;
}

/**
 * Kiosk principal — detected via top-level `role: 'kiosk'` on the
 * decoded token. Carries the business/location it is bound to.
 */
export interface KioskUser {
  role: 'kiosk';
  businessId: string;
  locationId: string;
  token: admin.auth.DecodedIdToken;
}

/** Authenticated principal attached to `req.user`. */
export type User = BusinessUser | KioskUser;

/**
 * The top-level Firebase custom-claim object written for a kiosk principal via
 * `setCustomUserClaims`. It is the *encode* counterpart of {@link KioskUser}:
 * the auth middleware decodes these same top-level fields back into a
 * `KioskUser`. `claimsVersion` is the refresh signal mirrored on the device doc.
 */
export interface KioskClaim {
  role: 'kiosk';
  businessId: string;
  locationId: string;
  claimsVersion?: number;
}

/**
 * Single source of truth for the kiosk custom-claim shape. Both the businesses
 * service and the firestore-functions (cfb) kiosk trigger construct the claim
 * through this factory so the literal can never drift again (the missing
 * `claimsVersion` seam, cfb#22, was a direct symptom of the duplicated literal).
 *
 * Pure — it never touches Firebase Admin. Callers pass the result to
 * `getAuth().setCustomUserClaims(uid, buildKioskClaim(...))`. The `claimsVersion`
 * key is always present (possibly `undefined`); Firebase's JSON serialization
 * drops an `undefined` value, so omitting vs. passing `undefined` is identical
 * on the wire — matching the existing call-site behavior exactly.
 */
export function buildKioskClaim(params: {
  businessId: string;
  locationId: string;
  claimsVersion?: number;
}): KioskClaim {
  const { businessId, locationId, claimsVersion } = params;
  return {
    role: 'kiosk', businessId, locationId, claimsVersion,
  };
}
