/**
 * Claims module
 * Documents user claims
 */
import { Role } from '../domain/roots/Business';

/** Claim body that contains the dictionary
 * of user roles for given businessId
 *
 * P34 (rcc#131) AC-7 verification, performed 2026-09-03/04 — `businessRole` does NOT need to be
 * kept in sync with the new `Business.members` map, because nothing depends on its contents:
 *
 * - **Read in exactly one place.** businesses `src/routes/kioskHealthRouter.ts` →
 *   `verifiedBusinessId()`, and only to decide whether to stamp a `businessId` label on a
 *   rejected-batch *log line*. The authorization one frame up is `user.role !== 'kiosk'`, which
 *   rejects business users regardless of what this map says.
 * - **Nothing writes it.** The only `setCustomUserClaims` callers in the tree are the kiosk claims
 *   in businesses `src/services/kioskClaimsService.ts` (`setKioskClaims`/`clearKioskClaims`). The
 *   map is therefore always empty, and that log line already stamps `'unknown'`.
 *
 * P34 deliberately does not put business roles in custom claims (contract rcc#130 §1.4);
 * authorization reads `members` from the business document on every request instead.
 *
 * The one live coupling, for contract §3.4: `Body` types `businessRole` as `Role`, so deleting the
 * `Role` enum breaks this file, `src/user/User.ts`, that `verifiedBusinessId()` read, and a
 * duplicate declaration at `libs/kios-firestore/src/user/Claims.ts`. (Symbols, not line numbers.)
 */
export interface Body {
  businessRole: { [businessId: string]: Role };
}

/** Wraps a claim body to be readable on decodedIdToken
 *"token.claims.businessRole" not "token.claims.claims.businessRole"
 */
export function wrapper(body: Body) {
  return { claims: body };
}
