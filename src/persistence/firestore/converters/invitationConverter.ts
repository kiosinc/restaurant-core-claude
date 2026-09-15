import { FirestoreRepositoryConfig } from '../FirestoreRepository';
import {
  BusinessInvitation, InviteChannel, InviteStatus, LocationScope, MemberPermissions, MemberRole,
} from '../../../domain/roots/Business';
import { PathResolver } from '../PathResolver';
import { stripUndefined } from '../sanitize';

/**
 * Serialization for a P34 invitation document at
 * `businesses/{businessId}/private/invitations/invitations/{inviteId}` (rcc#131 D1).
 *
 * **Hand-written, not `createConverter`.** `BusinessInvitation` is not a `BaseEntity` — the
 * contract (rcc#130 §1.1) gives it `id`/`createdAt`/`expiresAt` and no `Id`/`created`/`updated`/
 * `isDeleted`. `createConverter<T extends BaseEntity>` unconditionally calls
 * `baseFieldsToFirestore(entity)`, which dereferences `entity.created.toISOString()` and would
 * throw on this shape, and its `fromFirestore` stamps base fields the contract does not have.
 * `FirestoreRepositoryConfig<T>` is unconstrained, so the converter *type* is still the idiom;
 * only the factory is unusable. Persistence adapts to the contract type, never the reverse.
 *
 * **It calls `stripUndefined` itself, unlike `tokenConverter`.** `sanitize.ts`'s header names
 * `tokenConverter` as the one converter outside the strip boundary — a known hazard, not a
 * pattern to copy. `phoneNumber`, `email` and `name` are optional and are exactly the keys that
 * arrive `undefined` from an untyped caller; consumers write converter output to Firestore instances with
 * `ignoreUndefinedProperties` off, where a single `undefined` value rejects the whole document
 * (#200, #204).
 *
 * `id` is dropped from the body because it IS the document id — the same thing `createConverter`
 * does with `Id` — and is stamped back from the snapshot on read.
 *
 * **`fromFirestore` is a plain field map and must NOT call `createBusinessInvitation`.** That
 * factory mints a fresh CSPRNG `token` when one is absent, so hydrating through it would silently
 * rotate the bearer credential a recipient is already holding, on every read of a document that
 * lost its token. Reads never mint; minting belongs to the write path.
 */
export const invitationConverter: FirestoreRepositoryConfig<BusinessInvitation> = {
  modelKey: 'businessInvitation',
  collectionRef(businessId: string) {
    return PathResolver.invitationsCollection(businessId);
  },
  toFirestore(invitation: BusinessInvitation): FirebaseFirestore.DocumentData {
    const { id: _id, ...fields } = invitation;
    return stripUndefined({ ...fields });
  },
  fromFirestore(data: FirebaseFirestore.DocumentData, id: string): BusinessInvitation {
    // Conditional spreads rather than assignments, so the channel that was not used stays ABSENT
    // instead of present-and-`undefined` — the same distinction the factory keeps on the write
    // side, and what makes a hydrate→write round trip loss-free.
    return {
      id,
      channel: data.channel as InviteChannel,
      ...(data.phoneNumber === undefined ? {} : { phoneNumber: data.phoneNumber as string }),
      ...(data.email === undefined ? {} : { email: data.email as string }),
      ...(data.name === undefined ? {} : { name: data.name as string }),
      role: data.role as MemberRole,
      permissions: data.permissions as MemberPermissions,
      locationScope: data.locationScope as LocationScope,
      status: data.status as InviteStatus,
      invitedBy: data.invitedBy as string,
      createdAt: data.createdAt as number,
      expiresAt: data.expiresAt as number,
      token: data.token as string,
    };
  },
};
