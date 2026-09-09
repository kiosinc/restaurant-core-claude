import {
  BusinessInvitation, INVITE_STATUSES, InviteStatus,
} from '../../domain/roots/Business';
import { requireOneOf } from '../../domain/validation';
import { invitationConverter } from './converters/invitationConverter';
import { PathResolver } from './PathResolver';

/**
 * Persistence for P34 invitations at
 * `businesses/{businessId}/private/invitations/invitations/{inviteId}` (rcc#131 D1).
 *
 * Module functions rather than a `FirestoreRepository`, because `FirestoreRepository<T extends
 * BaseEntity>` cannot be instantiated with `BusinessInvitation` — the contract's shape has no
 * `Id`/`created`/`updated`/`isDeleted`. Same shape as `BusinessFactory` and
 * `AvailabilityEntryService`. What that costs, stated so nobody rediscovers it: no metadata
 * fan-out, no relationship handlers, no `findByLinkedObject`. Invitations need none of them. If
 * the contract ever grows the base fields, the right move is to switch to `createConverter` plus
 * the repository, not to bolt those fields onto the type.
 *
 * Queries here are single-field equality only. Firestore indexes every single field
 * automatically, so nothing below needs a composite index and `FIRESTORE_INDEXES.md` gains no
 * entry — this repo applies indexes imperatively against live GCP projects, so an accidental
 * composite requirement is a deploy-time surprise, not a build failure. That is also why there is
 * deliberately no `orderBy`: adding one to a filtered query forces a composite index. Callers sort
 * in memory.
 */

/** `…/private/invitations/invitations/{inviteId}`. */
export function invitationRef(businessId: string, inviteId: string): FirebaseFirestore.DocumentReference {
  return PathResolver.invitationDoc(businessId, inviteId);
}

/**
 * Writes the whole invitation document — a plain `set`, deliberately NOT `{ merge: true }`.
 * An invitation is authored once by its creator and its fields are not partitioned across
 * writers, so a full replace is the honest write; a merge would let a stale caller leave a
 * half-updated document behind. Status changes go through {@link updateInvitationStatus}.
 */
export async function setInvitation(businessId: string, invitation: BusinessInvitation): Promise<void> {
  await invitationRef(businessId, invitation.id).set(invitationConverter.toFirestore(invitation));
}

export async function getInvitation(businessId: string, inviteId: string): Promise<BusinessInvitation | null> {
  const snapshot = await invitationRef(businessId, inviteId).get();
  if (!snapshot.exists) return null;
  return invitationConverter.fromFirestore(snapshot.data() as FirebaseFirestore.DocumentData, snapshot.id, businessId);
}

/** Every invitation for the business, optionally narrowed to one status. Unordered — see the module note. */
export async function listInvitations(
  businessId: string,
  options?: { status?: InviteStatus },
): Promise<BusinessInvitation[]> {
  let query: FirebaseFirestore.Query = PathResolver.invitationsCollection(businessId);
  if (options?.status !== undefined) query = query.where('status', '==', options.status);
  const snapshot = await query.get();
  return snapshot.docs.map((doc) => invitationConverter.fromFirestore(doc.data(), doc.id, businessId));
}

/**
 * Looks an invitation up by the opaque deep-link token, scoped to one business.
 *
 * Throws when more than one document matches, following the `findByLinkedObjectId` precedent: two
 * invitations sharing a bearer token is a data-integrity failure, and picking one would hand an
 * accepting recipient an arbitrary membership. The message names the document ids only — never the
 * token itself, which is a credential.
 */
export async function findInvitationByToken(
  businessId: string,
  token: string,
): Promise<BusinessInvitation | null> {
  const snapshot = await PathResolver.invitationsCollection(businessId)
    .where('token', '==', token)
    .get();

  if (snapshot.empty) return null;
  if (snapshot.docs.length > 1) {
    throw new Error(
      `There is more than one invitation ${snapshot.docs.map((d) => d.id)} `
      + `with the same token in business ${businessId}`,
    );
  }
  const [doc] = snapshot.docs;
  return invitationConverter.fromFirestore(doc.data(), doc.id, businessId);
}

/**
 * Targeted `update({ status })`, so the write carries Firestore's implicit document-must-exist
 * precondition: a status change against a missing invitation surfaces as NOT_FOUND instead of
 * silently creating a document with nothing but a status. The status is validated before the RPC
 * is issued, so a bad value costs no round trip and cannot land.
 */
export async function updateInvitationStatus(
  businessId: string,
  inviteId: string,
  status: InviteStatus,
): Promise<void> {
  requireOneOf('status', INVITE_STATUSES, status);
  await invitationRef(businessId, inviteId).update({ status });
}
