/**
 * User Module
 * A User contains a claims and decoded
 * Token
 */
import * as admin from 'firebase-admin';
import * as Claims from './Claims';

export interface User {
  claims: Claims.Body;
  token: admin.auth.DecodedIdToken;
}
