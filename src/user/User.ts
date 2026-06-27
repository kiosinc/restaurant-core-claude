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
