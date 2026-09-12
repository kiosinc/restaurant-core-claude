/**
 * Authorization Module
 *
 * Express middleware answering "what may this principal do?", as opposed to
 * `Authentication.ts`, which answers "who is this principal?". They are separate files because
 * they are separate concerns with different dependency footprints — authentication needs Firebase
 * Auth, authorization needs a Firestore read — and the root barrel already exports each
 * `src/user/` submodule individually.
 *
 * Every decision is made against the **live** `members` map on the business document (P34
 * contract kiosinc/restaurant-core-claude#130 §1.4), never against a Firebase custom claim. That is
 * what makes "delete `members[uid]` and the very next request is denied" true (contract §2), and it
 * sidesteps the claims-revocation rate limit that made the P31 kiosk-claims path awkward. The cost
 * is one document read per guarded request; `req.business` (see `src/global.d.ts`) is the escape
 * hatch for a route that has already loaded the business.
 *
 * **No logging.** This library ships no logger and has no request/business context to attach, so a
 * denial is returned as an error and the consuming service decides what to log about it.
 */
import { NextFunction, Request, RequestHandler, Response } from 'express';
import * as HttpErrors from 'http-errors';
import {
  Business, BusinessMember, MemberPermissions,
  hasPermission, isActiveMember, isLocationInScope,
} from '../domain/roots/Business';
import { PathResolver } from '../persistence/firestore/PathResolver';

/**
 * Error codes, carried on `err.code` alongside `err.status === 403` (contract §1.5), so the
 * consuming service's error handler and this library agree on exactly one spelling of each.
 */
export const PERMISSION_DENIED = 'PERMISSION_DENIED';
export const LOCATION_OUT_OF_SCOPE = 'LOCATION_OUT_OF_SCOPE';

export interface AuthorizationOptions {
  /**
   * Where to find the business id on the request. Defaults to `req.params.businessId`; supply this
   * for a route that carries it elsewhere (a body field, a sub-resource lookup, a header).
   */
  resolveBusinessId?: (req: Request) => string | undefined;
}

/** The default of `AuthorizationOptions.resolveBusinessId`, hoisted so it is not rebuilt per request. */
const businessIdFromParams = (req: Request): string | undefined => req.params.businessId;

/**
 * Reads one member entry from the business document.
 *
 * Deliberately reads the **raw snapshot's** `members` field rather than hydrating a `Business`
 * through `businessConverter.fromFirestore`: hydration runs `createBusinessRoot`, which
 * `requireNonEmptyString`s `agent` and `createdBy`, so a single malformed unrelated field would
 * turn an authorization decision into a 500. An authorization decision must depend on `members`
 * and on nothing else.
 *
 * `prefetched` short-circuits with **zero** Firestore reads — pass an already-loaded `Business`
 * (typically stamped once onto `req.business` upstream) and no read is issued. It is honoured only
 * when it IS the business being authorized. `Business.Id` is always the document id (the converter
 * stamps it from the snapshot), so a prefetch whose id does not match `businessId` was loaded for
 * some other business and is ignored in favour of the live read. Without that check a route whose
 * business id comes from somewhere other than the value the prefetch was loaded from — an
 * `options.resolveBusinessId` reading a body field while an upstream loader used `req.params` —
 * would have its authorization decision made against the wrong tenant's members map. Falling
 * through to the read is the fail-safe answer rather than a denial: it resolves the member of the
 * business actually being guarded.
 */
export async function resolveMember(
  businessId: string,
  uid: string,
  prefetched?: Business,
): Promise<BusinessMember | undefined> {
  if (prefetched && prefetched.Id === businessId) return prefetched.members?.[uid];

  const snapshot = await PathResolver.businessDoc(businessId).get();
  if (!snapshot.exists) return undefined;

  // A legacy document with no `members` field denies, exactly as an empty map would.
  const members = snapshot.data()?.members as { [uid: string]: BusinessMember } | undefined;
  return members?.[uid];
}

/** Builds a 403 carrying one of the two exported codes on `err.code`. */
function forbidden(code: string, message: string): HttpErrors.HttpError {
  const error = new HttpErrors.Forbidden(message);
  error.code = code;
  return error;
}

/**
 * Steps 1–4 of the §1.10 decision order, shared by both middlewares so that an absent or inactive
 * membership yields the same `PERMISSION_DENIED` from either — a scope-flavoured error for someone
 * who is not a usable member at all would send an operator looking in the wrong place.
 *
 * Returns either the active member or the error to hand to `next`; it never calls `next` itself.
 */
async function resolveActiveMember(
  req: Request,
  options: AuthorizationOptions,
): Promise<{ member: BusinessMember } | { error: HttpErrors.HttpError }> {
  // 1. No principal. Defence in depth — routes chain `authenticate, isAuthenticated,
  //    requirePermission(...)`. A kiosk principal needs no special case: it is a real principal
  //    with a uid, has no `members` entry, and is denied at step 3 by the map lookup itself.
  const uid = req.user?.token?.uid;
  if (!uid) return { error: new HttpErrors.Unauthorized('Unauthenticated user') };

  // 2. No business id. A route misconfiguration is not an authorization decision, so it answers
  //    400 rather than 403 — diagnostic, and impossible to mistake for a real denial. Still closed.
  const businessId = (options.resolveBusinessId ?? businessIdFromParams)(req);
  if (!businessId) return { error: new HttpErrors.BadRequest('businessId is required') };

  const member = await resolveMember(businessId, uid, req.business);

  // 3. Not a member of this business.
  if (member === undefined) {
    return { error: forbidden(PERMISSION_DENIED, 'Not a member of this business') };
  }

  // 4. A member, but not a usable one. Status beats role: an `unusable` admin is denied here.
  if (!isActiveMember(member)) {
    return { error: forbidden(PERMISSION_DENIED, 'Membership is not active') };
  }

  return { member };
}

/** Steps 1–5 for `requirePermission`. Returns the error rather than calling `next` — see below. */
async function decidePermission(
  req: Request,
  permission: keyof MemberPermissions,
  options: AuthorizationOptions,
): Promise<HttpErrors.HttpError | undefined> {
  const resolved = await resolveActiveMember(req, options);
  if ('error' in resolved) return resolved.error;

  // 5. The stored permission map is authoritative, so a `custom` member needs no special case.
  if (!hasPermission(resolved.member, permission)) {
    return forbidden(PERMISSION_DENIED, `Missing '${permission}' permission`);
  }

  return undefined;
}

/** Steps 1–4, then the route param, then the scope check. */
async function decideLocationScope(
  req: Request,
  locationIdParam: string,
  options: AuthorizationOptions,
): Promise<HttpErrors.HttpError | undefined> {
  const resolved = await resolveActiveMember(req, options);
  if ('error' in resolved) return resolved.error;

  const locationId = req.params[locationIdParam];
  if (!locationId) {
    return new HttpErrors.BadRequest(`${locationIdParam} is required`);
  }

  if (!isLocationInScope(resolved.member, locationId)) {
    return forbidden(LOCATION_OUT_OF_SCOPE, 'Location is out of scope for this member');
  }

  return undefined;
}

/**
 * Guards a route on one `MemberPermissions` key.
 *
 * Decision order (contract §1.10): no principal → 401; no business id → 400; absent membership →
 * 403 `PERMISSION_DENIED`; inactive membership → 403 `PERMISSION_DENIED`; missing permission → 403
 * `PERMISSION_DENIED`; otherwise `next()`.
 *
 * The async shape is deliberate. `decide*` **returns** the error instead of calling `next`, and the
 * handler forwards it with the two-argument `.then(next, next)` rather than
 * `.then(() => next()).catch((e) => next(e))`. In the chained form the `.catch` sits downstream of
 * the `.then`, so a synchronous throw raised by a *later* handler — reached through our own
 * `next()` — lands back in that `.catch` and calls `next` a second time. The two-argument form
 * invokes `next` exactly once on every path and cannot recapture a downstream throw.
 * (`Authentication.authenticate` still uses the chained form; fixing it is out of scope here.)
 */
export function requirePermission(
  permission: keyof MemberPermissions,
  options: AuthorizationOptions = {},
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    decidePermission(req, permission, options).then(next, next);
  };
}

/**
 * Guards a route on the member's `locationScope` against a location id read from
 * `req.params[locationIdParam]`.
 *
 * Steps 1–4 are `requirePermission`'s, so an absent or inactive member answers `PERMISSION_DENIED`
 * and only a genuine scope miss answers `LOCATION_OUT_OF_SCOPE`. A missing route param answers 400,
 * for the same reason step 2 does. Same two-argument `.then(next, next)` contract.
 */
export function requireLocationScope(
  locationIdParam: string,
  options: AuthorizationOptions = {},
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    decideLocationScope(req, locationIdParam, options).then(next, next);
  };
}
