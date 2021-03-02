import { auth } from 'firebase-admin';
import * as Claims from './Claims';

export interface User {
  claims: Claims.Body;
  token: auth.DecodedIdToken;
}
