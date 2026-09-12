import { describe, it, expect } from 'vitest';
import {
  Business,
  BusinessMember,
  BusinessType,
  Role,
  createBusinessMember,
  createBusinessRoot,
  hasPermission,
  isActiveMember,
  isLocationInScope,
  migrateRolesToMembers,
  roleForPermission,
} from '../Business';
import { ValidationError } from '../../validation';

const ADDED_AT = 1_700_000_000_000;
const CREATED = new Date('2024-03-04T05:06:07.000Z');

function member(overrides: Partial<BusinessMember> = {}): BusinessMember {
  return createBusinessMember({
    role: 'admin', addedAt: ADDED_AT, addedBy: 'uid-owner', ...overrides,
  });
}

function business(overrides: Partial<Business> = {}): Business {
  return createBusinessRoot({
    agent: 'ios-device',
    createdBy: 'uid-owner',
    type: BusinessType.restaurant,
    businessProfile: { name: 'Test Restaurant' },
    created: CREATED,
    ...overrides,
  });
}

describe('roleForPermission', () => {
  it('grants an admin every permission', () => {
    expect(roleForPermission('admin')).toEqual({
      kiosk: true, menu: true, profile: true, account: true,
    });
  });

  it('grants a regular member everything but account', () => {
    expect(roleForPermission('regular')).toEqual({
      kiosk: true, menu: true, profile: true, account: false,
    });
  });

  it('floors custom at no permissions — the caller supplies the explicit map', () => {
    expect(roleForPermission('custom')).toEqual({
      kiosk: false, menu: false, profile: false, account: false,
    });
  });

  it('returns a fresh object per call so a stored map is never shared', () => {
    const first = roleForPermission('admin');
    const second = roleForPermission('admin');
    expect(first).not.toBe(second);
    first.account = false;
    expect(second.account).toBe(true);
  });
});

describe('isActiveMember', () => {
  it('is true for an active member', () => {
    expect(isActiveMember(member())).toBe(true);
  });

  it('is false for an unusable member', () => {
    expect(isActiveMember(member({ status: 'unusable' }))).toBe(false);
  });

  it('is false for an absent member', () => {
    expect(isActiveMember(undefined)).toBe(false);
  });
});

describe('hasPermission', () => {
  it('allows an active admin every permission', () => {
    const admin = member();
    expect(hasPermission(admin, 'kiosk')).toBe(true);
    expect(hasPermission(admin, 'menu')).toBe(true);
    expect(hasPermission(admin, 'profile')).toBe(true);
    expect(hasPermission(admin, 'account')).toBe(true);
  });

  it('denies an active regular member the account permission', () => {
    const regular = member({ role: 'regular' });
    expect(hasPermission(regular, 'menu')).toBe(true);
    expect(hasPermission(regular, 'account')).toBe(false);
  });

  it('honours an active custom member explicit map rather than the role', () => {
    const custom = member({
      role: 'custom',
      permissions: {
        kiosk: false, menu: true, profile: false, account: false,
      },
    });
    expect(hasPermission(custom, 'menu')).toBe(true);
    expect(hasPermission(custom, 'kiosk')).toBe(false);
  });

  it('denies an unusable ADMIN — status beats role', () => {
    const suspended = member({ status: 'unusable' });
    expect(suspended.role).toBe('admin');
    expect(suspended.permissions.account).toBe(true);
    expect(hasPermission(suspended, 'account')).toBe(false);
  });

  it('denies an absent member', () => {
    expect(hasPermission(undefined, 'kiosk')).toBe(false);
  });

  it('denies when the stored permissions map is missing', () => {
    const malformed = { ...member(), permissions: undefined } as unknown as BusinessMember;
    expect(hasPermission(malformed, 'kiosk')).toBe(false);
  });

  it('denies when the stored value is truthy but not strictly true', () => {
    const malformed = { ...member(), permissions: { kiosk: 'yes' } } as unknown as BusinessMember;
    expect(hasPermission(malformed, 'kiosk')).toBe(false);
    expect(hasPermission(malformed, 'menu')).toBe(false);
  });
});

describe('isLocationInScope', () => {
  it("matches any location for the 'all' sentinel", () => {
    const anywhere = member({ locationScope: 'all' });
    expect(isLocationInScope(anywhere, 'loc-1')).toBe(true);
    expect(isLocationInScope(anywhere, 'loc-anything')).toBe(true);
  });

  it('matches only the listed locations for an array scope', () => {
    const scoped = member({ locationScope: ['loc-1', 'loc-2'] });
    expect(isLocationInScope(scoped, 'loc-2')).toBe(true);
    expect(isLocationInScope(scoped, 'loc-3')).toBe(false);
  });

  it('matches nothing for an empty array scope', () => {
    expect(isLocationInScope(member({ locationScope: [] }), 'loc-1')).toBe(false);
  });

  it('denies an unusable member even when the location is listed', () => {
    const suspended = member({ status: 'unusable', locationScope: ['loc-1'] });
    expect(isLocationInScope(suspended, 'loc-1')).toBe(false);
  });

  it('denies an absent member', () => {
    expect(isLocationInScope(undefined, 'loc-1')).toBe(false);
  });

  it('denies a malformed scope value rather than guessing', () => {
    const malformed = { ...member(), locationScope: 'loc-1' } as unknown as BusinessMember;
    expect(isLocationInScope(malformed, 'loc-1')).toBe(false);
  });
});

describe('createBusinessMember', () => {
  it('defaults permissions from the role, scope to all and status to active', () => {
    const created = createBusinessMember({ role: 'regular', addedAt: ADDED_AT, addedBy: 'uid-owner' });
    expect(created).toEqual({
      role: 'regular',
      permissions: {
        kiosk: true, menu: true, profile: true, account: false,
      },
      locationScope: 'all',
      status: 'active',
      addedAt: ADDED_AT,
      addedBy: 'uid-owner',
    });
  });

  it('honours explicit permissions, scope and status', () => {
    const created = createBusinessMember({
      role: 'custom',
      permissions: {
        kiosk: true, menu: false, profile: false, account: false,
      },
      locationScope: ['loc-1'],
      status: 'unusable',
      addedAt: ADDED_AT,
      addedBy: 'uid-owner',
    });
    expect(created.permissions).toEqual({
      kiosk: true, menu: false, profile: false, account: false,
    });
    expect(created.locationScope).toEqual(['loc-1']);
    expect(created.status).toBe('unusable');
  });

  it('throws for an unknown role', () => {
    expect(() => createBusinessMember({
      role: 'superuser' as never, addedAt: ADDED_AT, addedBy: 'uid-owner',
    })).toThrow(ValidationError);
  });

  it('throws for an unknown status', () => {
    expect(() => createBusinessMember({
      role: 'admin', status: 'suspended' as never, addedAt: ADDED_AT, addedBy: 'uid-owner',
    })).toThrow(ValidationError);
  });

  it('throws for an empty addedBy', () => {
    expect(() => createBusinessMember({ role: 'admin', addedAt: ADDED_AT, addedBy: '   ' }))
      .toThrow(ValidationError);
  });

  it('throws for a negative addedAt', () => {
    expect(() => createBusinessMember({ role: 'admin', addedAt: -1, addedBy: 'uid-owner' }))
      .toThrow(ValidationError);
  });

  it('throws for a non-integer addedAt', () => {
    expect(() => createBusinessMember({ role: 'admin', addedAt: 1.5, addedBy: 'uid-owner' }))
      .toThrow(ValidationError);
  });
});

describe('migrateRolesToMembers', () => {
  it('maps a legacy owner to an active admin scoped to all locations', () => {
    const migrated = migrateRolesToMembers(business({ roles: { 'uid-owner': Role.owner } }));
    expect(migrated['uid-owner']).toEqual({
      role: 'admin',
      permissions: {
        kiosk: true, menu: true, profile: true, account: true,
      },
      locationScope: 'all',
      status: 'active',
      addedAt: CREATED.getTime(),
      addedBy: 'uid-owner',
    });
  });

  it('stamps addedAt from business.created and addedBy from business.createdBy', () => {
    const biz = business({ createdBy: 'uid-founder', roles: { 'uid-a': Role.owner } });
    const migrated = migrateRolesToMembers(biz);
    expect(migrated['uid-a'].addedAt).toBe(CREATED.getTime());
    expect(migrated['uid-a'].addedBy).toBe('uid-founder');
  });

  it('excludes sysadmin — it is platform-level, not a business membership', () => {
    const migrated = migrateRolesToMembers(business({
      roles: { 'uid-sys': Role.sysadmin, 'uid-owner': Role.owner },
    }));
    expect(migrated['uid-sys']).toBeUndefined();
    expect(migrated['uid-owner']).toBeDefined();
  });

  it('returns {} for an empty roles map', () => {
    expect(migrateRolesToMembers(business({ roles: {} }))).toEqual({});
  });

  it('skips an unrecognised legacy role value', () => {
    const migrated = migrateRolesToMembers(business({
      roles: { 'uid-x': 'manager' as unknown as Role },
    }));
    expect(migrated).toEqual({});
  });

  it('is idempotent — feeding its own output back changes nothing', () => {
    const biz = business({ roles: { 'uid-owner': Role.owner } });
    const first = migrateRolesToMembers(biz);
    const second = migrateRolesToMembers({ ...biz, members: first });
    expect(second).toEqual(first);
    expect(migrateRolesToMembers(biz)).toEqual(first);
  });

  it('keeps an existing members entry over the derived one', () => {
    const demoted = createBusinessMember({
      role: 'regular', locationScope: ['loc-1'], addedAt: ADDED_AT, addedBy: 'uid-admin',
    });
    const migrated = migrateRolesToMembers(business({
      roles: { 'uid-owner': Role.owner },
      members: { 'uid-owner': demoted },
    }));
    expect(migrated['uid-owner']).toEqual(demoted);
  });

  it('keeps an explicit members entry for a uid whose legacy role is sysadmin', () => {
    const explicit = createBusinessMember({ role: 'regular', addedAt: ADDED_AT, addedBy: 'uid-owner' });
    const migrated = migrateRolesToMembers(business({
      roles: { 'uid-sys': Role.sysadmin },
      members: { 'uid-sys': explicit },
    }));
    expect(migrated['uid-sys']).toEqual(explicit);
  });
});
