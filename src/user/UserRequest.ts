/** UserRequest module
 * Takes an Express Request and injects
 * a User into the request
 */
import { Request } from 'express';
// import './User+Request';
import * as auth from 'firebase-admin/auth';

/**
 * Authenticates a request and injects resulting User
 * into the request
 */
export default async function authenticateRequest(req: Request) {
  const bearerHeader = req.headers.authorization;

  if (bearerHeader) {
    const bearer = bearerHeader.split(' ');
    const bearerToken = bearer[1];

    const decodedIdToken = await auth.getAuth().verifyIdToken(bearerToken);

    req.user = {
      claims: decodedIdToken.claims,
      token: decodedIdToken,
    };
  }
}
