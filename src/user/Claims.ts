/**
 * Claims module
 * Documents user claims
 */
import * as Constants from '../firestore-core/Constants';

/** Claim body that contains the dictionary
 * of user roles for given businessId */
export interface Body {
  businessRole: { [businessId: string]: Constants.Role };
}

/** Wraps a claim body to be readable on decodedIdToken
 *"token.claims.businessRole" not "token.claims.claims.businessRole"
 */
export function wrapper(body: Body) {
  return { claims: body };
}
