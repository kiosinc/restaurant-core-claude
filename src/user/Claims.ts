/**
 * Claims module
 * Documents user claims
 */
import { Role } from '../domain/roots/Business';

/** Claim body that contains the dictionary
 * of user roles for given businessId */
export interface Body {
  businessRole: { [businessId: string]: Role };
}

/** Wraps a claim body to be readable on decodedIdToken
 *"token.claims.businessRole" not "token.claims.claims.businessRole"
 */
export function wrapper(body: Body) {
  return { claims: body };
}
