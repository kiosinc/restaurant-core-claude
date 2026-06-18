/** UserRequest module
 * Takes an Express Request and injects
 * a User into the request
 */
import { Request } from 'express';
import * as auth from 'firebase-admin/auth';

/**
 * Authenticates a request and injects resulting User
 * into the request.
 *
 * A kiosk principal is detected by a top-level `role: 'kiosk'` on the
 * decoded token (NEVER a `role` nested under `.claims`). Business
 * principals keep the legacy `{ claims, token }` shape exactly.
 */
export default async function authenticateRequest(req: Request) {
  const bearerHeader = req.headers.authorization;

  if (bearerHeader) {
    const bearer = bearerHeader.split(' ');
    const bearerToken = bearer[1];

    const decodedIdToken = await auth.getAuth().verifyIdToken(bearerToken);

    if (decodedIdToken.role === 'kiosk') {
      // Kiosk principal. businessId/locationId may be absent at this
      // boundary — permissive-attach (downstream enforces presence).
      req.user = {
        role: 'kiosk',
        businessId: decodedIdToken.businessId,
        locationId: decodedIdToken.locationId,
        token: decodedIdToken,
      };
    } else {
      // Business principal — byte-identical to the legacy shape.
      req.user = {
        claims: decodedIdToken.claims,
        token: decodedIdToken,
      };
    }
  }
}
