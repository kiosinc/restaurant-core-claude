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
