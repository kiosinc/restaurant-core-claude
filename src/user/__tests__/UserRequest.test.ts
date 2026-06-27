import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';
import type { Request } from 'express';

const verifyIdToken = vi.fn();

vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({ verifyIdToken }),
}));

import authenticateRequest from '../UserRequest';
import { authenticate } from '../Authentication';
import type { User } from '../User';

/**
 * Builds a minimal Express Request carrying the given authorization header.
 */
function reqWithAuth(authorization?: string): Request {
  return { headers: authorization ? { authorization } : {} } as unknown as Request;
}

describe('authenticateRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('happy path — top-level role:"kiosk" attaches a KioskUser', async () => {
    verifyIdToken.mockResolvedValue({
      role: 'kiosk',
      businessId: 'biz-1',
      locationId: 'loc-1',
      uid: 'kiosk-device-1',
    });

    const req = reqWithAuth('Bearer kiosk-token');
    await authenticateRequest(req);

    expect(verifyIdToken).toHaveBeenCalledWith('kiosk-token');
    expect(req.user).toBeDefined();
    expect(req.user!.role).toBe('kiosk');
    if (req.user!.role === 'kiosk') {
      expect(req.user.businessId).toBe('biz-1');
      expect(req.user.locationId).toBe('loc-1');
      expect(req.user.token.uid).toBe('kiosk-device-1');
    }
    // Kiosk principal must NOT carry the business `claims` field.
    expect((req.user as Record<string, unknown>).claims).toBeUndefined();
  });

  it('business no-regression — nested claims.businessRole still resolves', async () => {
    const decoded = {
      claims: { businessRole: { 'biz-1': 'owner' } },
      uid: 'user-1',
    };
    verifyIdToken.mockResolvedValue(decoded);

    const req = reqWithAuth('Bearer business-token');
    await authenticateRequest(req);

    expect(req.user).toBeDefined();
    expect(req.user!.role).toBeUndefined();
    if (req.user!.role !== 'kiosk') {
      expect(req.user!.claims.businessRole['biz-1']).toBe('owner');
      expect(req.user!.token).toBe(decoded);
    }
  });

  it('negative — role nested under .claims is NOT treated as kiosk', async () => {
    verifyIdToken.mockResolvedValue({
      claims: { role: 'kiosk', businessRole: { 'biz-1': 'owner' } },
      uid: 'user-2',
    });

    const req = reqWithAuth('Bearer sneaky-token');
    await authenticateRequest(req);

    expect(req.user).toBeDefined();
    // Detection only reads the TOP-LEVEL role; nested role is ignored.
    expect(req.user!.role).toBeUndefined();
    if (req.user!.role !== 'kiosk') {
      expect(req.user!.claims.businessRole['biz-1']).toBe('owner');
    }
  });

  it('missing bearer header — req.user undefined, verify not called', async () => {
    const req = reqWithAuth(undefined);
    await authenticateRequest(req);

    expect(req.user).toBeUndefined();
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it('malformed token — verifyIdToken rejection propagates', async () => {
    verifyIdToken.mockRejectedValue(new Error('invalid token'));

    const req = reqWithAuth('Bearer bad-token');
    await expect(authenticateRequest(req)).rejects.toThrow('invalid token');
    expect(req.user).toBeUndefined();
  });

  it('boundary — role:"kiosk" missing businessId/locationId permissively attaches', async () => {
    verifyIdToken.mockResolvedValue({
      role: 'kiosk',
      uid: 'kiosk-device-2',
    });

    const req = reqWithAuth('Bearer partial-kiosk-token');
    await authenticateRequest(req);

    expect(req.user).toBeDefined();
    expect(req.user!.role).toBe('kiosk');
    if (req.user!.role === 'kiosk') {
      // Permissive-attach: present but undefined, no throw.
      expect(req.user.businessId).toBeUndefined();
      expect(req.user.locationId).toBeUndefined();
    }
  });
});

describe('authenticate middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls next() with no error on a valid kiosk token', async () => {
    verifyIdToken.mockResolvedValue({
      role: 'kiosk',
      businessId: 'biz-1',
      locationId: 'loc-1',
    });
    const req = reqWithAuth('Bearer kiosk-token');
    const next = vi.fn();

    await new Promise<void>((resolve) => {
      authenticate(req, {} as never, (...args: unknown[]) => {
        next(...args);
        resolve();
      });
    });

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it('calls next(Unauthorized) when verifyIdToken rejects', async () => {
    verifyIdToken.mockRejectedValue(new Error('invalid token'));
    const req = reqWithAuth('Bearer bad-token');
    const next = vi.fn();

    await new Promise<void>((resolve) => {
      authenticate(req, {} as never, (...args: unknown[]) => {
        next(...args);
        resolve();
      });
    });

    const err = next.mock.calls[0][0] as { status?: number; message?: string };
    expect(err).toBeDefined();
    expect(err.status).toBe(401);
    expect(err.message).toContain('invalid token');
  });
});

/**
 * Compile-time narrowing assertion: narrowing `User` on `role === 'kiosk'`
 * yields `KioskUser` and `businessId` is readable with no cast. This block
 * is never executed; it exists to fail `tsc` if the union regresses.
 */
function _narrowingAssertion(user: User): string | undefined {
  if (user.role === 'kiosk') {
    const id: string = user.businessId;
    return id;
  }
  // Business branch: `claims` is readable, `businessId` is not on this variant.
  return user.claims.businessRole ? 'business' : undefined;
}
void _narrowingAssertion;
