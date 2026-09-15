import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';
import { NextFunction, Request, RequestHandler, Response } from 'express';
import * as HttpErrors from 'http-errors';
import {
  Business, BusinessMember, BusinessType, createBusinessRoot,
} from '../../domain/roots/Business';
import { mockCollectionRef, mockDb, mockDocRef } from '../../persistence/firestore/__tests__/helpers/firestoreMocks';
import {
  LOCATION_OUT_OF_SCOPE, PERMISSION_DENIED, requireLocationScope, requirePermission, resolveMember,
} from '../Authorization';

vi.mock('firebase-admin/firestore', () => ({ getFirestore: () => mockDb }));

const ALL_PERMISSIONS = {
  kiosk: true, menu: true, profile: true, account: true,
};

const ACTIVE_ADMIN: BusinessMember = {
  role: 'admin',
  permissions: ALL_PERMISSIONS,
  locationScope: 'all',
  status: 'active',
  addedAt: 1_700_000_000_000,
  addedBy: 'uid-owner',
};

const ACTIVE_REGULAR: BusinessMember = {
  role: 'regular',
  permissions: {
    kiosk: true, menu: true, profile: true, account: false,
  },
  locationScope: 'all',
  status: 'active',
  addedAt: 1_700_000_000_000,
  addedBy: 'uid-owner',
};

/** The O4 proof fixture: an admin by role, denied by status. */
const UNUSABLE_ADMIN: BusinessMember = { ...ACTIVE_ADMIN, status: 'unusable' };

function memberWithScope(locationScope: BusinessMember['locationScope']): BusinessMember {
  return { ...ACTIVE_ADMIN, locationScope };
}

/**
 * `Id` is stamped explicitly because the prefetch is honoured only when it is the business being
 * authorized — `resolveMember` compares `prefetched.Id` against the resolved `businessId`, and a
 * real prefetch always carries the document id (the converter stamps it from the snapshot).
 */
function businessWith(
  members: { [uid: string]: BusinessMember },
  Id = 'biz-1',
): Business {
  return createBusinessRoot({
    Id,
    agent: 'ios-device',
    createdBy: 'uid-owner',
    type: BusinessType.restaurant,
    businessProfile: { name: 'Test Restaurant' },
    members,
  });
}

/** `undefined` data models a document that does not exist. */
function snapshotOf(data: Record<string, unknown> | undefined) {
  return { exists: data !== undefined, data: () => data };
}

function businessPrincipal(uid: string) {
  return { claims: { businessRole: {} }, token: { uid } };
}

function kioskPrincipal(uid: string) {
  return {
    role: 'kiosk', businessId: 'biz-1', locationId: 'loc-1', token: { uid },
  };
}

/**
 * A platform sysadmin: the `role: 'sysadmin'` custom claim sits TOP-LEVEL on the verified decoded
 * token, the same position `role: 'kiosk'` occupies. `UserRequest.ts` does not narrow on it, so the
 * principal is a `BusinessUser` carrying the claim — which is exactly the shape prod produced for
 * `jjc@kios.cloud` when the first `teamRolesV2` flip 403'd them.
 */
function sysadminPrincipal(uid = 'uid-sys') {
  return { claims: { businessRole: {} }, token: { uid, role: 'sysadmin' } };
}

/** The same uid WITHOUT the claim — the negative control's other half. */
function unclaimedPrincipal(uid = 'uid-sys') {
  return { claims: { businessRole: {} }, token: { uid } };
}

/**
 * The request every case starts from: an authenticated business user, the `businessId` param both
 * middlewares resolve, and the `locationId` param `requireLocationScope` reads. Each case overrides
 * only the part it is about, so the thing under test is the only thing that varies.
 */
function request(overrides: Record<string, unknown> = {}) {
  return {
    user: businessPrincipal('uid-1'),
    params: { businessId: 'biz-1', locationId: 'loc-1' },
    ...overrides,
  };
}

/** `next()` resolves `undefined` (allow); `next(err)` resolves the error (deny). */
function run(handler: RequestHandler, request: unknown): Promise<unknown> {
  return new Promise((resolve) => {
    handler(request as Request, {} as Response, resolve as NextFunction);
  });
}

/** A macrotask turn, so every pending microtask has certainly run. */
function flush(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function asHttpError(result: unknown): HttpErrors.HttpError {
  return result as HttpErrors.HttpError;
}

describe('Authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: the business exists and `uid-1` is an active admin. Individual tests override.
    mockDocRef.get.mockResolvedValue(snapshotOf({ members: { 'uid-1': ACTIVE_ADMIN } }));
  });

  describe('requirePermission', () => {
    it('allows an active admin', async () => {
      expect(await run(requirePermission('account'), request())).toBeUndefined();
    });

    it('allows an active regular for menu', async () => {
      mockDocRef.get.mockResolvedValue(snapshotOf({ members: { 'uid-1': ACTIVE_REGULAR } }));
      expect(await run(requirePermission('menu'), request())).toBeUndefined();
    });

    it('denies a permission the member does not hold', async () => {
      mockDocRef.get.mockResolvedValue(snapshotOf({ members: { 'uid-1': ACTIVE_REGULAR } }));
      const error = asHttpError(await run(requirePermission('account'), request()));
      expect(error.status).toBe(403);
      expect(error.code).toBe(PERMISSION_DENIED);
    });

    it('denies absent membership', async () => {
      mockDocRef.get.mockResolvedValue(snapshotOf({ members: { 'uid-other': ACTIVE_ADMIN } }));
      const error = asHttpError(await run(requirePermission('menu'), request()));
      expect(error.status).toBe(403);
      expect(error.code).toBe(PERMISSION_DENIED);
    });

    it('denies an unusable admin — status beats role (AC 8 / O4)', async () => {
      mockDocRef.get.mockResolvedValue(snapshotOf({ members: { 'uid-1': UNUSABLE_ADMIN } }));
      const error = asHttpError(await run(requirePermission('menu'), request()));
      expect(error.status).toBe(403);
      expect(error.code).toBe(PERMISSION_DENIED);
    });

    it('denies a kiosk principal through the members lookup, with no kiosk branch in the code', async () => {
      // The business has an active admin (`uid-1`, from the default) — just not this principal.
      const error = asHttpError(await run(
        requirePermission('kiosk'),
        request({ user: kioskPrincipal('kiosk-uid') }),
      ));
      expect(error.status).toBe(403);
      expect(error.code).toBe(PERMISSION_DENIED);
    });

    it('answers 401 when there is no principal', async () => {
      const error = asHttpError(await run(
        requirePermission('menu'),
        request({ user: undefined }),
      ));
      expect(error.status).toBe(401);
      expect(mockDocRef.get).not.toHaveBeenCalled();
    });

    it('answers 400 when the business id cannot be resolved', async () => {
      const error = asHttpError(await run(requirePermission('menu'), request({ params: {} })));
      expect(error.status).toBe(400);
      expect(mockDocRef.get).not.toHaveBeenCalled();
    });

    it('honours options.resolveBusinessId', async () => {
      const result = await run(
        requirePermission('menu', { resolveBusinessId: () => 'biz-override' }),
        request({ params: {} }),
      );
      expect(result).toBeUndefined();
      expect(mockCollectionRef.doc).toHaveBeenCalledWith('biz-override');
    });

    it('denies when the business document does not exist', async () => {
      mockDocRef.get.mockResolvedValue(snapshotOf(undefined));
      const error = asHttpError(await run(requirePermission('menu'), request()));
      expect(error.status).toBe(403);
      expect(error.code).toBe(PERMISSION_DENIED);
    });

    it('denies when the business document has no members field', async () => {
      mockDocRef.get.mockResolvedValue(snapshotOf({ agent: 'ios-device' }));
      const error = asHttpError(await run(requirePermission('menu'), request()));
      expect(error.status).toBe(403);
      expect(error.code).toBe(PERMISSION_DENIED);
    });

    it('reuses req.business and issues no Firestore read', async () => {
      const result = await run(
        requirePermission('account'),
        request({ business: businessWith({ 'uid-1': ACTIVE_ADMIN }) }),
      );
      expect(result).toBeUndefined();
      expect(mockDocRef.get).not.toHaveBeenCalled();
    });

    it('ignores a req.business loaded for a different business and reads the live one', async () => {
      // The prefetch is a hot-path optimisation, not a decision input: honouring one belonging to
      // another business would answer for the wrong tenant's members map. `uid-1` is an admin of
      // `biz-other` and absent from `biz-1`, so trusting the prefetch would ALLOW; reading the
      // real document denies.
      mockDocRef.get.mockResolvedValue(snapshotOf({ members: {} }));
      const error = asHttpError(await run(
        requirePermission('account'),
        request({ business: businessWith({ 'uid-1': ACTIVE_ADMIN }, 'biz-other') }),
      ));
      expect(error.status).toBe(403);
      expect(error.code).toBe(PERMISSION_DENIED);
      expect(mockDocRef.get).toHaveBeenCalledTimes(1);
    });

    it('reads exactly once when req.business is absent', async () => {
      await run(requirePermission('account'), request());
      expect(mockDocRef.get).toHaveBeenCalledTimes(1);
    });

    it('calls next exactly once on the allow path', async () => {
      const next = vi.fn();
      requirePermission('account')(
        request() as unknown as Request,
        {} as Response,
        next as unknown as NextFunction,
      );
      await flush();
      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(undefined);
    });

    it('calls next exactly once on the deny path', async () => {
      mockDocRef.get.mockResolvedValue(snapshotOf({ members: {} }));
      const next = vi.fn();
      requirePermission('account')(
        request() as unknown as Request,
        {} as Response,
        next as unknown as NextFunction,
      );
      await flush();
      expect(next).toHaveBeenCalledTimes(1);
      expect(asHttpError(next.mock.calls[0][0]).code).toBe(PERMISSION_DENIED);
    });
  });

  /**
   * The platform sysadmin bypass.
   *
   * The defect these pin is a production lockout, not a hypothetical: `teamRolesV2` was flipped on
   * in `kios-master` and rolled back at 23:30 UTC because `GET /business/team-members` answered 403
   * to a sysadmin. `migrateRolesToMembers` excludes `sysadmin` by design, so no backfill can ever
   * put one in a `members` map — a members-only guard denies every sysadmin on every business,
   * permanently. The bypass has to live here.
   */
  describe('platform sysadmin bypass', () => {
    /**
     * The headline case, and the shape of the prod failure: the business exists, its members map
     * holds two OTHER uids, and the caller is in neither.
     */
    it('allows a sysadmin who has no members entry', async () => {
      mockDocRef.get.mockResolvedValue(snapshotOf({
        members: { 'uid-1': ACTIVE_ADMIN, 'uid-2': ACTIVE_REGULAR },
      }));
      const result = await run(
        requirePermission('account'),
        request({ user: sysadminPrincipal() }),
      );
      expect(result).toBeUndefined();
    });

    /**
     * NEGATIVE CONTROL. Identical in every respect to the case above except the one claim, so it
     * fails if — and only if — the bypass is the thing doing the allowing. Delete the
     * `isSysadminPrincipal` branch from `resolveActiveMember` and the case above turns into this
     * one; weaken the check to "any `role` claim" or to an email domain and this one turns into
     * the case above.
     */
    it('NEGATIVE CONTROL — the same uid without the claim is denied', async () => {
      mockDocRef.get.mockResolvedValue(snapshotOf({
        members: { 'uid-1': ACTIVE_ADMIN, 'uid-2': ACTIVE_REGULAR },
      }));
      const error = asHttpError(await run(
        requirePermission('account'),
        request({ user: unclaimedPrincipal() }),
      ));
      expect(error.status).toBe(403);
      expect(error.code).toBe(PERMISSION_DENIED);
    });

    /**
     * Step 5, not just step 3. Clearing membership and then denying on `permissions` would move the
     * denial one step later and leave the operator with the identical 403 — a sysadmin has no
     * permission map to be checked against.
     */
    it('clears the permission check too, for every permission key', async () => {
      mockDocRef.get.mockResolvedValue(snapshotOf({ members: {} }));
      const results = await Promise.all(
        (['kiosk', 'menu', 'profile', 'account'] as const).map(
          (permission) => run(requirePermission(permission), request({ user: sysadminPrincipal() })),
        ),
      );
      expect(results).toEqual([undefined, undefined, undefined, undefined]);
    });

    /** Ahead of the lookup, not after it: nothing in the document can change the answer. */
    it('issues no Firestore read', async () => {
      await run(requirePermission('account'), request({ user: sysadminPrincipal() }));
      expect(mockDocRef.get).not.toHaveBeenCalled();
    });

    /**
     * The claim is the whole grant, so it beats a narrower membership the same uid happens to hold.
     * Revoking platform access means revoking the claim with the Admin SDK — never editing one
     * tenant's members map, which could not reach the other tenants anyway.
     */
    it('beats a restrictive members entry for the same uid', async () => {
      mockDocRef.get.mockResolvedValue(snapshotOf({
        members: { 'uid-sys': { ...ACTIVE_REGULAR, status: 'unusable' } },
      }));
      expect(await run(
        requirePermission('account'),
        request({ user: sysadminPrincipal() }),
      )).toBeUndefined();
    });

    /**
     * The claim must be the VERIFIED top-level token field and nothing else. A `role` under the
     * nested `.claims` body is the legacy `Claims.Body` position — writable through a different
     * path and not what `set:sysadmin-claim` writes.
     */
    it('denies a role nested under .claims rather than on the token', async () => {
      mockDocRef.get.mockResolvedValue(snapshotOf({ members: {} }));
      const error = asHttpError(await run(
        requirePermission('account'),
        request({
          user: { claims: { businessRole: {}, role: 'sysadmin' }, token: { uid: 'uid-sys' } },
        }),
      ));
      expect(error.status).toBe(403);
      expect(error.code).toBe(PERMISSION_DENIED);
    });

    /**
     * Never a Firestore field. A business document that names a uid `sysadmin` in its legacy
     * `roles` map grants nothing — otherwise anyone who can write their own tenant document could
     * promote themselves across every tenant.
     */
    it('denies a sysadmin role read from the business document', async () => {
      mockDocRef.get.mockResolvedValue(snapshotOf({
        roles: { 'uid-sys': 'sysadmin' },
        members: {},
      }));
      const error = asHttpError(await run(
        requirePermission('account'),
        request({ user: unclaimedPrincipal() }),
      ));
      expect(error.status).toBe(403);
      expect(error.code).toBe(PERMISSION_DENIED);
    });

    /**
     * The kiosk denial is deliberate and load-bearing — businesses' `/events` exemption relies on
     * it. A kiosk carries `role: 'kiosk'` at the very position this bypass reads, so the strict
     * equality is what keeps the two apart.
     */
    it('still denies a kiosk principal, whose token carries role at the same position', async () => {
      const error = asHttpError(await run(
        requirePermission('kiosk'),
        request({ user: kioskPrincipal('kiosk-uid') }),
      ));
      expect(error.status).toBe(403);
      expect(error.code).toBe(PERMISSION_DENIED);
    });

    /** An unusable member with no claim is still denied — status still beats role (AC 8 / O4). */
    it('still denies an unusable member', async () => {
      mockDocRef.get.mockResolvedValue(snapshotOf({ members: { 'uid-1': UNUSABLE_ADMIN } }));
      const error = asHttpError(await run(requirePermission('menu'), request()));
      expect(error.status).toBe(403);
      expect(error.code).toBe(PERMISSION_DENIED);
    });

    /** Steps 1 and 2 still run first: the claim is not a licence to skip a malformed request. */
    it('answers 401 to a sysadmin claim with no principal attached', async () => {
      const error = asHttpError(await run(
        requirePermission('menu'),
        request({ user: undefined }),
      ));
      expect(error.status).toBe(401);
      expect(mockDocRef.get).not.toHaveBeenCalled();
    });

    it('answers 400 to a sysadmin when the business id cannot be resolved', async () => {
      const error = asHttpError(await run(
        requirePermission('menu'),
        request({ user: sysadminPrincipal(), params: {} }),
      ));
      expect(error.status).toBe(400);
      expect(mockDocRef.get).not.toHaveBeenCalled();
    });

    it('clears requireLocationScope for a location no member could reach', async () => {
      mockDocRef.get.mockResolvedValue(snapshotOf({ members: { 'uid-1': memberWithScope([]) } }));
      expect(await run(
        requireLocationScope('locationId'),
        request({ user: sysadminPrincipal() }),
      )).toBeUndefined();
    });

    it('still answers 400 to a sysadmin when the location param is absent', async () => {
      const error = asHttpError(await run(
        requireLocationScope('locationId'),
        request({ user: sysadminPrincipal(), params: { businessId: 'biz-1' } }),
      ));
      expect(error.status).toBe(400);
    });
  });

  describe('requireLocationScope', () => {
    it("allows the 'all' sentinel", async () => {
      mockDocRef.get.mockResolvedValue(snapshotOf({ members: { 'uid-1': memberWithScope('all') } }));
      expect(await run(requireLocationScope('locationId'), request())).toBeUndefined();
    });

    it('allows an array containing the location', async () => {
      mockDocRef.get.mockResolvedValue(
        snapshotOf({ members: { 'uid-1': memberWithScope(['loc-9', 'loc-1']) } }),
      );
      expect(await run(requireLocationScope('locationId'), request())).toBeUndefined();
    });

    it('denies a location outside the scope', async () => {
      mockDocRef.get.mockResolvedValue(
        snapshotOf({ members: { 'uid-1': memberWithScope(['loc-9']) } }),
      );
      const error = asHttpError(await run(requireLocationScope('locationId'), request()));
      expect(error.status).toBe(403);
      expect(error.code).toBe(LOCATION_OUT_OF_SCOPE);
    });

    it('denies an empty array scope', async () => {
      mockDocRef.get.mockResolvedValue(snapshotOf({ members: { 'uid-1': memberWithScope([]) } }));
      const error = asHttpError(await run(requireLocationScope('locationId'), request()));
      expect(error.status).toBe(403);
      expect(error.code).toBe(LOCATION_OUT_OF_SCOPE);
    });

    it('denies absent membership with PERMISSION_DENIED, not LOCATION_OUT_OF_SCOPE', async () => {
      mockDocRef.get.mockResolvedValue(snapshotOf({ members: {} }));
      const error = asHttpError(await run(requireLocationScope('locationId'), request()));
      expect(error.status).toBe(403);
      expect(error.code).toBe(PERMISSION_DENIED);
    });

    it('denies an unusable member with PERMISSION_DENIED', async () => {
      mockDocRef.get.mockResolvedValue(snapshotOf({ members: { 'uid-1': UNUSABLE_ADMIN } }));
      const error = asHttpError(await run(requireLocationScope('locationId'), request()));
      expect(error.status).toBe(403);
      expect(error.code).toBe(PERMISSION_DENIED);
    });

    it('answers 400 when the named route param is absent', async () => {
      const error = asHttpError(await run(
        requireLocationScope('locationId'),
        request({ params: { businessId: 'biz-1' } }),
      ));
      expect(error.status).toBe(400);
    });

    it('reuses req.business and issues no Firestore read', async () => {
      const result = await run(
        requireLocationScope('locationId'),
        request({ business: businessWith({ 'uid-1': memberWithScope(['loc-1']) }) }),
      );
      expect(result).toBeUndefined();
      expect(mockDocRef.get).not.toHaveBeenCalled();
    });
  });

  /**
   * `options.resolveLocationId` (contract rcc#239 §1.2). The resolver is consulted first and
   * `req.params[locationIdParam]` is the fallback for `undefined` only — an `''` is unresolved and
   * 400s, a throw or rejection reaches `next(err)` and never grants. The suite above is the
   * no-resolver control: it proves the param path is unchanged.
   */
  describe('requireLocationScope with options.resolveLocationId (#240)', () => {
    it("uses the resolver's value over req.params", async () => {
      mockDocRef.get.mockResolvedValue(snapshotOf({ members: { 'uid-1': memberWithScope(['loc-9']) } }));
      expect(await run(
        requireLocationScope('locationId', { resolveLocationId: () => 'loc-9' }),
        request({ params: { businessId: 'biz-1', locationId: 'loc-1' } }),
      )).toBeUndefined();
    });

    /** NEGATIVE pairing of the case above: the param would allow, the resolver's value denies. */
    it("denies on the resolver's value even when req.params would be in scope", async () => {
      mockDocRef.get.mockResolvedValue(snapshotOf({ members: { 'uid-1': memberWithScope(['loc-1']) } }));
      const error = asHttpError(await run(
        requireLocationScope('locationId', { resolveLocationId: () => 'loc-9' }),
        request({ params: { businessId: 'biz-1', locationId: 'loc-1' } }),
      ));
      expect(error.status).toBe(403);
      expect(error.code).toBe(LOCATION_OUT_OF_SCOPE);
    });

    it('awaits an async resolver', async () => {
      mockDocRef.get.mockResolvedValue(snapshotOf({ members: { 'uid-1': memberWithScope(['loc-9']) } }));
      expect(await run(
        requireLocationScope('locationId', { resolveLocationId: async () => 'loc-9' }),
        request(),
      )).toBeUndefined();
    });

    it('falls back to req.params when the resolver returns undefined', async () => {
      mockDocRef.get.mockResolvedValue(snapshotOf({ members: { 'uid-1': memberWithScope(['loc-1']) } }));
      expect(await run(
        requireLocationScope('locationId', { resolveLocationId: () => undefined }),
        request(),
      )).toBeUndefined();
    });

    /** `??`, not `||`: `''` is unresolved, and the present param must NOT rescue it. */
    it("answers 400 when the resolver returns '' even though the param is present", async () => {
      const error = asHttpError(await run(
        requireLocationScope('locationId', { resolveLocationId: () => '' }),
        request({ params: { businessId: 'biz-1', locationId: 'loc-1' } }),
      ));
      expect(error.status).toBe(400);
      // Membership was read: the resolver runs after steps 1–4, not before.
      expect(mockDocRef.get).toHaveBeenCalledTimes(1);
    });

    it('answers 400 when both resolver and param are undefined', async () => {
      const error = asHttpError(await run(
        requireLocationScope('locationId', { resolveLocationId: () => undefined }),
        request({ params: { businessId: 'biz-1' } }),
      ));
      expect(error.status).toBe(400);
    });

    it('forwards a rejecting resolver to next with the error and never grants', async () => {
      const notFound = new HttpErrors.NotFound('Device not found');
      const result = await run(
        requireLocationScope('locationId', { resolveLocationId: async () => { throw notFound; } }),
        request(),
      );
      expect(result).toBe(notFound);
    });

    it('forwards a synchronously throwing resolver to next', async () => {
      const boom = new Error('boom');
      const result = await run(
        requireLocationScope('locationId', { resolveLocationId: () => { throw boom; } }),
        request(),
      );
      expect(result).toBe(boom);
    });

    /** The claim clears the scope check, not a resolver failure — the masked 404 survives it. */
    it('forwards a rejecting resolver for a sysadmin too', async () => {
      const notFound = new HttpErrors.NotFound('Device not found');
      const result = await run(
        requireLocationScope('locationId', { resolveLocationId: async () => { throw notFound; } }),
        request({ user: sysadminPrincipal() }),
      );
      expect(result).toBe(notFound);
      expect(mockDocRef.get).not.toHaveBeenCalled();
    });

    it('calls next exactly once when the resolver rejects', async () => {
      const notFound = new HttpErrors.NotFound('Device not found');
      const next = vi.fn();
      requireLocationScope('locationId', { resolveLocationId: async () => { throw notFound; } })(
        request() as unknown as Request,
        {} as Response,
        next as unknown as NextFunction,
      );
      await flush();
      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(notFound);
    });

    it('still answers 400 to a sysadmin when the resolver and param are both unresolved', async () => {
      const error = asHttpError(await run(
        requireLocationScope('locationId', { resolveLocationId: () => undefined }),
        request({ user: sysadminPrincipal(), params: { businessId: 'biz-1' } }),
      ));
      expect(error.status).toBe(400);
    });

    it('sysadmin passes a resolved location without a members read', async () => {
      expect(await run(
        requireLocationScope('locationId', { resolveLocationId: () => 'loc-x' }),
        request({ user: sysadminPrincipal(), params: { businessId: 'biz-1' } }),
      )).toBeUndefined();
      expect(mockDocRef.get).not.toHaveBeenCalled();
    });

    it("scope 'all' passes a resolver-supplied location", async () => {
      mockDocRef.get.mockResolvedValue(snapshotOf({ members: { 'uid-1': memberWithScope('all') } }));
      expect(await run(
        requireLocationScope('locationId', { resolveLocationId: () => 'loc-x' }),
        request({ params: { businessId: 'biz-1' } }),
      )).toBeUndefined();
    });

    it('a listed id passes', async () => {
      mockDocRef.get.mockResolvedValue(
        snapshotOf({ members: { 'uid-1': memberWithScope(['loc-9', 'loc-x']) } }),
      );
      expect(await run(
        requireLocationScope('locationId', { resolveLocationId: () => 'loc-x' }),
        request({ params: { businessId: 'biz-1' } }),
      )).toBeUndefined();
    });

    it('an unlisted id is 403 LOCATION_OUT_OF_SCOPE', async () => {
      mockDocRef.get.mockResolvedValue(snapshotOf({ members: { 'uid-1': memberWithScope(['loc-9']) } }));
      const error = asHttpError(await run(
        requireLocationScope('locationId', { resolveLocationId: () => 'loc-x' }),
        request({ params: { businessId: 'biz-1' } }),
      ));
      expect(error.status).toBe(403);
      expect(error.code).toBe(LOCATION_OUT_OF_SCOPE);
    });

    /** After steps 1–4: a non-member must never trigger the consumer's device read. */
    it('does not invoke the resolver when the caller is not an active member', async () => {
      mockDocRef.get.mockResolvedValue(snapshotOf({ members: {} }));
      const resolveLocationId = vi.fn(() => 'loc-1');
      const error = asHttpError(await run(
        requireLocationScope('locationId', { resolveLocationId }),
        request(),
      ));
      expect(error.status).toBe(403);
      expect(error.code).toBe(PERMISSION_DENIED);
      expect(resolveLocationId).not.toHaveBeenCalled();
    });

    it('passes the request object to the resolver', async () => {
      const req = request();
      const resolveLocationId = vi.fn(() => 'loc-1');
      expect(await run(requireLocationScope('locationId', { resolveLocationId }), req)).toBeUndefined();
      expect(resolveLocationId).toHaveBeenCalledTimes(1);
      expect(resolveLocationId.mock.calls[0][0]).toBe(req);
    });
  });

  describe('resolveMember', () => {
    it('returns the member from a prefetched Business without reading', async () => {
      const member = await resolveMember(
        'biz-1',
        'uid-1',
        businessWith({ 'uid-1': ACTIVE_ADMIN }),
      );
      expect(member).toEqual(ACTIVE_ADMIN);
      expect(mockDocRef.get).not.toHaveBeenCalled();
    });

    it('ignores a prefetch whose Id is not the business being resolved', async () => {
      mockDocRef.get.mockResolvedValue(snapshotOf({ members: {} }));
      const member = await resolveMember(
        'biz-1',
        'uid-1',
        businessWith({ 'uid-1': ACTIVE_ADMIN }, 'biz-other'),
      );
      expect(member).toBeUndefined();
      expect(mockDocRef.get).toHaveBeenCalledTimes(1);
    });

    it('reads the business document when there is no prefetch', async () => {
      const member = await resolveMember('biz-1', 'uid-1');
      expect(member).toEqual(ACTIVE_ADMIN);
      expect(mockDocRef.get).toHaveBeenCalledTimes(1);
    });

    it('returns undefined when the business document is missing', async () => {
      mockDocRef.get.mockResolvedValue(snapshotOf(undefined));
      expect(await resolveMember('biz-1', 'uid-1')).toBeUndefined();
    });

    it('returns undefined when the document has no members map', async () => {
      mockDocRef.get.mockResolvedValue(snapshotOf({ agent: 'ios-device' }));
      expect(await resolveMember('biz-1', 'uid-1')).toBeUndefined();
    });

    it('returns undefined when the uid is not in the members map', async () => {
      mockDocRef.get.mockResolvedValue(snapshotOf({ members: { 'uid-other': ACTIVE_ADMIN } }));
      expect(await resolveMember('biz-1', 'uid-1')).toBeUndefined();
    });
  });
});
