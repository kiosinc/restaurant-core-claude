/** Merge declaration for Express Request
 * Adds an optional User property to the request
 */
import { User } from './user'

declare module 'express' {
  interface Request {
    user?: User;
  }
}
