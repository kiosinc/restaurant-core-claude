/** Merge declaration for Express Request
 * Adds an optional User property to the request
 * Adds an optional Business property — the P34 hot-path prefetch read by
 * `Authorization.resolveMember`, so a route that already loaded the business
 * makes its authorization decision with zero extra Firestore reads.
 */
import { User } from './user'
import { Business } from './domain/roots/Business'

declare module 'express' {
  interface Request {
    user?: User;
    business?: Business;
  }
}
