import { randomBytes } from 'node:crypto';
import { BaseEntity, baseEntityDefaults, generateId } from '../BaseEntity';
import {
  requireE164, requireNonEmptyString, requireNonNegativeInteger, requireOneOf,
} from '../validation';
import { BusinessProfile } from '../misc/BusinessProfile';

export enum BusinessType {
  restaurant = 'restaurant',
}

export enum Role {
  sysadmin = 'sysadmin',
  owner = 'owner',
}

// ---------------------------------------------------------------------------
// P34 team members and invitations — contract kiosinc/restaurant-core-claude#130 §1.1.
//
// These are plain string-literal unions, never TS enums: the declarations must stay
// byte-identical to `@kiosinc/kios-commons-types` (kios-commons-types#62), which the mobile apps
// consume and which has no enum to import. The legacy `Role` enum above is untouched — it is a
// different vocabulary on a different retirement clock (contract §3.4), and `roles` is kept
// alongside `members` on purpose (§3.2's expand→migrate→contract).
// ---------------------------------------------------------------------------

export type MemberRole = 'admin' | 'regular' | 'custom';
export type MemberStatus = 'active' | 'unusable';
export type InviteStatus = 'pending' | 'accepted' | 'revoked' | 'expired';
export type InviteChannel = 'sms' | 'email';
/** `'all'` is the every-location sentinel; an array is an explicit allow-list of location ids. */
export type LocationScope = 'all' | string[];

export interface MemberPermissions {
  kiosk: boolean;
  menu: boolean;
  profile: boolean;
  account: boolean;
}

export interface BusinessMember {
  role: MemberRole;
  permissions: MemberPermissions;
  locationScope: LocationScope;
  status: MemberStatus;
  addedAt: number;
  addedBy: string;
}

export interface BusinessInvitation {
  id: string;
  channel: InviteChannel;
  phoneNumber?: string;
  email?: string;
  role: MemberRole;
  permissions: MemberPermissions;
  locationScope: LocationScope;
  status: InviteStatus;
  invitedBy: string;
  createdAt: number;
  expiresAt: number;
  token: string;
}

/**
 * Runtime allow-lists for the unions above, typed against them so renaming a literal in the type
 * fails to compile here rather than silently letting the old spelling through a `requireOneOf`.
 *
 * Exported at module level for in-repo writers (the invitation store validates a status against
 * `INVITE_STATUSES` before its RPC); deliberately NOT on the `Domain.Roots` barrel, because a
 * published allow-list would become a second declaration of the contract for consumers to drift
 * from — the types are the contract.
 */
export const MEMBER_ROLES: readonly MemberRole[] = ['admin', 'regular', 'custom'];
export const MEMBER_STATUSES: readonly MemberStatus[] = ['active', 'unusable'];
export const INVITE_STATUSES: readonly InviteStatus[] = ['pending', 'accepted', 'revoked', 'expired'];
export const INVITE_CHANNELS: readonly InviteChannel[] = ['sms', 'email'];

export interface Business extends BaseEntity {
  agent: string;
  createdBy: string;
  type: BusinessType;
  businessProfile: BusinessProfile;
  /** Legacy. Retained for dual-write/back-compat only; retirement is contract §3.4, not this issue. */
  roles: { [uid: string]: Role };
  /** P34 source of truth for authorization. Required; defaulted to `{}` by the factory. */
  members: { [uid: string]: BusinessMember };
}

export function createBusinessRoot(input: Partial<Business> & {
  agent: string;
  createdBy: string;
  type: BusinessType;
  businessProfile: BusinessProfile;
}): Business {
  requireNonEmptyString('agent', input.agent);
  requireNonEmptyString('createdBy', input.createdBy);
  return {
    ...baseEntityDefaults(input),
    agent: input.agent,
    createdBy: input.createdBy,
    type: input.type,
    businessProfile: input.businessProfile,
    roles: input.roles ?? {},
    // Defaulted, never validated. `businessConverter.fromFirestore` routes every read of every
    // business document through this factory, so validating the map's contents here would turn a
    // single malformed legacy member entry into an exception on every read of that business.
    // The asymmetry is deliberate: writer-side validation lives in `createBusinessMember`, and
    // the read side degrades instead — `hasPermission`/`isLocationInScope` deny a malformed entry.
    members: input.members ?? {},
  };
}

/**
 * Role → the permission map a new member or invitation starts with.
 *
 * Status-blind by construction: a role cannot express "this member is suspended", so a caller
 * that already holds a `BusinessMember` must ask {@link hasPermission} instead — it denies an
 * `unusable` member whatever the role says. Use this one only to seed `permissions`.
 *
 * Returns a fresh object per call; the result is stored on a document and callers mutate it.
 */
export function roleForPermission(role: MemberRole): MemberPermissions {
  switch (role) {
    case 'admin':
      return {
        kiosk: true, menu: true, profile: true, account: true,
      };
    case 'regular':
      return {
        kiosk: true, menu: true, profile: true, account: false,
      };
    case 'custom':
    default:
      // `custom` means "the caller supplies the map", so the seed is a floor, not a grant. The
      // same branch catches an unknown role from an untyped caller, which therefore cannot widen
      // access.
      return {
        kiosk: false, menu: false, profile: false, account: false,
      };
  }
}

/**
 * The single definition of "usable member". Every authorization decision in this library and in
 * the consuming services funnels through it, so "suspended" has exactly one spelling and adding a
 * third `MemberStatus` later is one edit. An absent map entry is not a member.
 */
export function isActiveMember(member: BusinessMember | undefined): member is BusinessMember {
  return member !== undefined && member.status === 'active';
}

/**
 * Reads the member's **stored** permission map rather than re-deriving it from `role`: the
 * contract makes the stored map authoritative, which is what lets `custom` work with no special
 * case here and lets one permission be revoked from an individual admin.
 *
 * Strict `=== true`, so a legacy document with no map, a `null`, or a truthy string denies.
 */
export function hasPermission(
  member: BusinessMember | undefined,
  permission: keyof MemberPermissions,
): boolean {
  if (!isActiveMember(member)) return false;
  return member.permissions?.[permission] === true;
}

/** `'all'` matches every location; an array matches by membership; anything else denies. */
export function isLocationInScope(
  member: BusinessMember | undefined,
  locationId: string,
): boolean {
  if (!isActiveMember(member)) return false;
  const { locationScope } = member;
  if (locationScope === 'all') return true;
  if (Array.isArray(locationScope)) return locationScope.includes(locationId);
  // A scope that is neither the sentinel nor a list is a malformed document — deny, don't guess.
  return false;
}

/**
 * The one construction site for a `members[uid]` entry, and the only place member input is
 * validated (see the asymmetry note in {@link createBusinessRoot}). It exists as a factory
 * because the entry is built in more than one repo — the same literal duplicated across
 * repositories is how `buildKioskClaim` came about.
 */
export function createBusinessMember(input: {
  role: MemberRole;
  permissions?: MemberPermissions;
  locationScope?: LocationScope;
  status?: MemberStatus;
  addedAt: number;
  addedBy: string;
}): BusinessMember {
  requireOneOf('role', MEMBER_ROLES, input.role);
  if (input.status !== undefined) requireOneOf('status', MEMBER_STATUSES, input.status);
  requireNonNegativeInteger('addedAt', input.addedAt);
  requireNonEmptyString('addedBy', input.addedBy);
  return {
    role: input.role,
    permissions: input.permissions ?? roleForPermission(input.role),
    locationScope: input.locationScope ?? 'all',
    status: input.status ?? 'active',
    addedAt: input.addedAt,
    addedBy: input.addedBy,
  };
}

/**
 * Contract §3.1 backfill: derive a `members` map from the legacy `roles` map.
 *
 * `owner` → an active admin scoped to all locations. `sysadmin` is excluded — it is a
 * platform-level role, not a business membership — and any other legacy value is skipped rather
 * than guessed, so an unrecognised role fails closed to no access.
 *
 * `addedAt`/`addedBy` come from the business document itself, so a re-run produces a
 * byte-identical entry and the backfill is idempotent rather than merely re-runnable.
 *
 * Existing entries win over derived ones (`{ ...derived, ...business.members }`): a uid demoted
 * from admin, or given a narrower scope, must not be re-promoted the next time the backfill runs.
 */
export function migrateRolesToMembers(business: Business): { [uid: string]: BusinessMember } {
  const addedAt = business.created.getTime();
  const addedBy = business.createdBy;
  const derived: { [uid: string]: BusinessMember } = {};
  Object.entries(business.roles ?? {}).forEach(([uid, role]) => {
    if (role !== Role.owner) return;
    derived[uid] = createBusinessMember({ role: 'admin', addedAt, addedBy });
  });
  return { ...derived, ...business.members };
}

/** Contract §1.1: an invitation expires 7 days after it was created. */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Builds an invitation document. Mints an `id` and, when none is supplied, a bearer `token`:
 * 32 CSPRNG bytes, base64url so it survives a deep link unescaped.
 *
 * **Never call this from a converter's `fromFirestore`.** A stored invitation that reached us
 * without a `token` would be handed a brand-new one on read, silently rotating the credential the
 * recipient is holding. Hydration is a plain field map; minting belongs to the write path only.
 *
 * Channel invariant: `sms` requires an E.164 `phoneNumber` (callers normalize with
 * `Domain.Utils.toE164` first — {@link requireE164} is a shape gate, not a parser); `email`
 * requires an address, stored trimmed and lower-cased so a token lookup and an address lookup
 * agree. The channel that was not used is left **absent** rather than present-and-`undefined`:
 * consumers write to instances with `ignoreUndefinedProperties` off, where one `undefined` value
 * rejects the whole document (#200, #204).
 */
export function createBusinessInvitation(input: {
  id?: string;
  channel: InviteChannel;
  phoneNumber?: string;
  email?: string;
  role: MemberRole;
  permissions?: MemberPermissions;
  locationScope?: LocationScope;
  status?: InviteStatus;
  invitedBy: string;
  createdAt?: number;
  token?: string;
}): BusinessInvitation {
  requireOneOf('channel', INVITE_CHANNELS, input.channel);
  requireOneOf('role', MEMBER_ROLES, input.role);
  if (input.status !== undefined) requireOneOf('status', INVITE_STATUSES, input.status);
  requireNonEmptyString('invitedBy', input.invitedBy);
  if (input.createdAt !== undefined) requireNonNegativeInteger('createdAt', input.createdAt);
  // `??` only defaults a NULLISH value, so an empty supplied `id` or `token` would survive both
  // mints below. Neither is a harmless placeholder: an empty `id` is not a legal Firestore
  // document id, and an empty `token` is a bearer credential that `findInvitationByToken` would
  // then hand out to anyone presenting an empty token.
  if (input.id !== undefined) requireNonEmptyString('id', input.id);
  if (input.token !== undefined) requireNonEmptyString('token', input.token);

  let contact: { phoneNumber: string } | { email: string };
  if (input.channel === 'sms') {
    requireE164('phoneNumber', input.phoneNumber);
    contact = { phoneNumber: input.phoneNumber as string };
  } else {
    requireNonEmptyString('email', input.email);
    contact = { email: (input.email as string).trim().toLowerCase() };
  }

  const createdAt = input.createdAt ?? Date.now();
  return {
    id: input.id ?? generateId(),
    channel: input.channel,
    ...contact,
    role: input.role,
    permissions: input.permissions ?? roleForPermission(input.role),
    locationScope: input.locationScope ?? 'all',
    status: input.status ?? 'pending',
    invitedBy: input.invitedBy,
    createdAt,
    expiresAt: createdAt + INVITE_TTL_MS,
    token: input.token ?? randomBytes(32).toString('base64url'),
  };
}
