import { describe, it, expect } from 'vitest';
import * as Lib from '../index';
import { createTestOrderInput } from '../domain/__tests__/helpers/OrderFixtures';

/**
 * Outbound-boundary tests for rcc#63 (P6 platform fee, Stage 0-1).
 *
 * These import through the package root barrel rather than the deep module
 * paths on purpose. square-gateway-claude#91 and #393 consume these two
 * symbols through the published entrypoint, so a symbol that exists in
 * `src/domain/utils/` but was never wired into `src/domain/index.ts` would
 * pass every deep-import test and still be unreachable for the consumer.
 * That is the failure this file exists to catch.
 */
describe('public API surface (#63)', () => {
  it('exposes Domain.Utils.roundHalfEven through the package root barrel', () => {
    expect(typeof Lib.Domain.Utils.roundHalfEven).toBe('function');
    // Callable AND correct — presence alone would not tell the consumer anything.
    expect(Lib.Domain.Utils.roundHalfEven(107.5)).toBe(108);
    expect(Lib.Domain.Utils.roundHalfEven(108.5)).toBe(108);
  });

  it('exposes Order.appFee through the package root barrel', () => {
    const order = Lib.Domain.Orders.createOrder(createTestOrderInput({ appFee: 34 }));
    expect(order.appFee).toBe(34);
  });

  it('leaves appFee absent on the root-barrel factory when it is not supplied', () => {
    const order = Lib.Domain.Orders.createOrder(createTestOrderInput());
    expect('appFee' in order).toBe(false);
  });
});

/**
 * Outbound-boundary tests for rcc#163 (P41 availability entries, contract rcc#162 §1).
 *
 * square-gateway-claude and businesses reach the entries repository as
 * `Domain.Services.*`, the path resolvers as `Persistence.PathResolver.*` and the
 * collection name as `Paths.CollectionNames.entries` — all through the published
 * root barrel. Same failure class as #63 above: a symbol that exists in its module
 * but never made it into `services/index.ts` would pass every deep-import test.
 */
describe('public API surface (#163)', () => {
  it('#163 exposes the entries repository through Domain.Services', () => {
    const services = Lib.Domain.Services;
    expect(typeof services.entryRef).toBe('function');
    expect(typeof services.isDefaultEntry).toBe('function');
    expect(typeof services.setEntry).toBe('function');
    expect(typeof services.setEntryCountGuarded).toBe('function');
    expect(typeof services.getEntries).toBe('function');
    expect(typeof services.deleteEntries).toBe('function');
    // Callable AND correct: the gateway#375 clause is the one a consumer is most likely to lean on.
    expect(services.isDefaultEntry({ kind: 'option', isInventoryTracked: false })).toBe(false);
    expect(services.isDefaultEntry({ kind: 'option' })).toBe(true);
    expect(services.isDefaultEntry({ kind: 'option', count: services.UNTRACKED_COUNT })).toBe(true);
    expect(services.ENTRY_WRITABLE_FIELDS).toContain('isInventoryTracked');
    expect(services.ENTRY_WRITABLE_FIELDS).not.toContain('isAvailable');
  });

  it('#163 exposes PathResolver.inventoryEntriesCollection/inventoryEntryDoc through Persistence', () => {
    // Presence only: resolving a ref would call getFirestore(), which needs an initialised app.
    expect(typeof Lib.Persistence.PathResolver.inventoryEntriesCollection).toBe('function');
    expect(typeof Lib.Persistence.PathResolver.inventoryEntryDoc).toBe('function');
  });

  it("#163 exposes Paths.CollectionNames.entries === 'entries'", () => {
    expect(Lib.Paths.CollectionNames.entries).toBe('entries');
  });
});

/**
 * Outbound-boundary tests for rcc#131 (P34 team invites, contract rcc#130 §1.1).
 *
 * businesses#325 and remy#402 reach the member helpers as `Domain.Roots.*`, the E.164
 * normalizer as `Domain.Utils.toE164`, the invitation store and converter as `Persistence.*`,
 * the corrected invitation paths as `Persistence.PathResolver.*`, the collection name as
 * `Paths.CollectionNames.invitations` and the middleware as `Authorization.*` — every one of them
 * through the published root barrel. Same failure class as the two blocks above: a helper that
 * exists in `roots/Business.ts` but never made it onto `roots/index.ts` would pass every
 * deep-import test in `roots/__tests__/` and still be unreachable for the consumer.
 *
 * Callable-and-correct for the pure functions; presence-only for anything that would call
 * `getFirestore()`, which needs an initialised app.
 */
describe('public API surface (#131)', () => {
  const Roots = Lib.Domain.Roots;
  const ADDED_AT = 1_700_000_000_000;

  const activeAdmin = Roots.createBusinessMember({
    role: 'admin', addedAt: ADDED_AT, addedBy: 'uid-owner',
  });
  const unusableAdmin = { ...activeAdmin, status: 'unusable' as const };

  it('#131 exposes roleForPermission through Domain.Roots', () => {
    expect(typeof Roots.roleForPermission).toBe('function');
    // Callable AND correct: these two maps are what a consumer seeds `permissions` from.
    expect(Roots.roleForPermission('admin')).toEqual({
      kiosk: true, menu: true, profile: true, account: true,
    });
    expect(Roots.roleForPermission('regular')).toEqual({
      kiosk: true, menu: true, profile: true, account: false,
    });
  });

  it('#131 exposes isActiveMember/hasPermission/isLocationInScope through Domain.Roots', () => {
    expect(Roots.isActiveMember(activeAdmin)).toBe(true);
    expect(Roots.isActiveMember(undefined)).toBe(false);
    expect(Roots.hasPermission(activeAdmin, 'account')).toBe(true);
    expect(Roots.hasPermission(undefined, 'kiosk')).toBe(false);
    // Status beats role (O4 / AC 8) — the deny a consumer is most likely to lean on.
    expect(Roots.isActiveMember(unusableAdmin)).toBe(false);
    expect(Roots.hasPermission(unusableAdmin, 'kiosk')).toBe(false);
    expect(Roots.isLocationInScope(activeAdmin, 'loc-1')).toBe(true);
    expect(Roots.isLocationInScope({ ...activeAdmin, locationScope: ['loc-2'] }, 'loc-1')).toBe(false);
    expect(Roots.isLocationInScope(unusableAdmin, 'loc-1')).toBe(false);
  });

  it('#131 exposes createBusinessMember through Domain.Roots', () => {
    expect(Roots.createBusinessMember({ role: 'regular', addedAt: ADDED_AT, addedBy: 'uid-owner' })).toEqual({
      role: 'regular',
      permissions: { kiosk: true, menu: true, profile: true, account: false },
      locationScope: 'all',
      status: 'active',
      addedAt: ADDED_AT,
      addedBy: 'uid-owner',
    });
  });

  it('#131 exposes migrateRolesToMembers through Domain.Roots', () => {
    const business = Roots.createBusinessRoot({
      agent: 'ios-device',
      createdBy: 'uid-owner',
      type: Roots.BusinessType.restaurant,
      businessProfile: { name: 'Test Restaurant' },
      roles: { 'uid-owner': Roots.Role.owner, 'uid-sys': Roots.Role.sysadmin },
    });
    const members = Roots.migrateRolesToMembers(business);
    // owner → active admin; sysadmin excluded.
    expect(Object.keys(members)).toEqual(['uid-owner']);
    expect(members['uid-owner'].role).toBe('admin');
    expect(members['uid-owner'].status).toBe('active');
    expect(members['uid-owner'].addedBy).toBe('uid-owner');
  });

  it('#131 exposes createBusinessInvitation and INVITE_TTL_MS through Domain.Roots', () => {
    expect(Roots.INVITE_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
    const invite = Roots.createBusinessInvitation({
      channel: 'sms', phoneNumber: '+14155550132', role: 'regular', invitedBy: 'uid-owner',
    });
    // The TTL constant and the factory must agree through the barrel — a consumer computing an
    // expiry from the published constant has to land on the same value the factory stamped.
    expect(invite.expiresAt - invite.createdAt).toBe(Roots.INVITE_TTL_MS);
    expect(invite.status).toBe('pending');
    expect(typeof invite.token).toBe('string');
  });

  it('#131 exposes Domain.Utils.toE164 through the package root barrel', () => {
    expect(typeof Lib.Domain.Utils.toE164).toBe('function');
    expect(Lib.Domain.Utils.toE164('4155550132', 'US')).toBe('+14155550132');
  });

  it('#131 exposes the invitation store and converter through Persistence', () => {
    // Presence only: every store function resolves a ref, which calls getFirestore().
    expect(typeof Lib.Persistence.invitationRef).toBe('function');
    expect(typeof Lib.Persistence.setInvitation).toBe('function');
    expect(typeof Lib.Persistence.getInvitation).toBe('function');
    expect(typeof Lib.Persistence.listInvitations).toBe('function');
    expect(typeof Lib.Persistence.findInvitationByToken).toBe('function');
    expect(typeof Lib.Persistence.updateInvitationStatus).toBe('function');
    expect(Lib.Persistence.invitationConverter.modelKey).toBe('businessInvitation');
  });

  it('#131 exposes PathResolver.invitationsDoc/invitationsCollection/invitationDoc through Persistence', () => {
    // Presence only: resolving a ref would call getFirestore(), which needs an initialised app.
    expect(typeof Lib.Persistence.PathResolver.invitationsDoc).toBe('function');
    expect(typeof Lib.Persistence.PathResolver.invitationsCollection).toBe('function');
    expect(typeof Lib.Persistence.PathResolver.invitationDoc).toBe('function');
  });

  it("#131 exposes Paths.CollectionNames.invitations === 'invitations'", () => {
    expect(Lib.Paths.CollectionNames.invitations).toBe('invitations');
  });

  it('#131 exposes the permission middleware through Authorization', () => {
    expect(typeof Lib.Authorization.requirePermission).toBe('function');
    expect(typeof Lib.Authorization.requireLocationScope).toBe('function');
    expect(typeof Lib.Authorization.resolveMember).toBe('function');
    // The factory itself is pure — it hands back the handler without touching Firestore, so this
    // much is callable-and-correct even here. Invoking the handler is Authorization.test.ts's job.
    expect(typeof Lib.Authorization.requirePermission('kiosk')).toBe('function');
    // The error codes are the contract §1.5 wire values a consumer branches on.
    expect(Lib.Authorization.PERMISSION_DENIED).toBe('PERMISSION_DENIED');
    expect(Lib.Authorization.LOCATION_OUT_OF_SCOPE).toBe('LOCATION_OUT_OF_SCOPE');
  });

  it('#131 defaults Business.members to {} through the root barrel', () => {
    const business = Roots.createBusinessRoot({
      agent: 'ios-device',
      createdBy: 'uid-owner',
      type: Roots.BusinessType.restaurant,
      businessProfile: { name: 'Test Restaurant' },
    });
    expect(business.members).toEqual({});
  });
});

/**
 * Outbound-boundary tests for rcc#240 (P34 team invites replan, contract rcc#239 §1.1, §1.2, §1.5).
 *
 * businesses#464 reads the rollout allowlists as `Domain.Services.*`, hands `requireLocationScope`
 * a `resolveLocationId` option, and stamps `BusinessInvitation.name` through `Domain.Roots.*` —
 * every one of them through the published root barrel. Same failure class as the blocks above:
 * a reader that exists in `FeatureFlagService.ts` but never made it onto `services/index.ts`
 * would pass every deep-import test and still be unreachable for the consumer.
 *
 * Callable-and-correct for the pure functions; presence-only for anything that would call
 * `getFirestore()`, which needs an initialised app.
 */
describe('public API surface (#240)', () => {
  const Roots = Lib.Domain.Roots;

  it('#240 exposes the rollout allowlist reader through Domain.Services', () => {
    const services = Lib.Domain.Services;
    // Presence only: the readers resolve `/config/rolloutAllowlists`, which calls getFirestore().
    expect(typeof services.getRolloutAllowlists).toBe('function');
    expect(typeof services.isTeamRolesV2Enabled).toBe('function');
    expect(typeof services.clearRolloutAllowlistCache).toBe('function');
    expect(typeof services.createRolloutAllowlistService).toBe('function');
    // Clearing the cache touches no Firestore state, so this much is callable even here.
    expect(() => services.clearRolloutAllowlistCache()).not.toThrow();
  });

  it('#240 accepts resolveLocationId on requireLocationScope through Authorization', () => {
    // The factory itself is pure — it hands back the handler without touching Firestore.
    // Invoking the handler with a resolver is Authorization.test.ts's job.
    const handler = Lib.Authorization.requireLocationScope('locationId', {
      resolveLocationId: () => 'loc-1',
    });
    expect(typeof handler).toBe('function');
  });

  it('#240 exposes BusinessInvitation.name and INVITE_NAME_MAX_LENGTH through Domain.Roots', () => {
    expect(Roots.INVITE_NAME_MAX_LENGTH).toBe(80);
    const smsInput = {
      channel: 'sms' as const, phoneNumber: '+14155550132', role: 'regular' as const, invitedBy: 'uid-owner',
    };
    // Trimmed on the write path, like `email` — the consumer stores what the factory returns.
    expect(Roots.createBusinessInvitation({ ...smsInput, name: '  Sam  ' }).name).toBe('Sam');
    // Absent, not `undefined`, when it is not supplied (#200 / #204 rule).
    expect('name' in Roots.createBusinessInvitation(smsInput)).toBe(false);
  });
});
