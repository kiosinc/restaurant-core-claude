import { FieldValue, GrpcStatus } from 'firebase-admin/firestore';
import { PathResolver } from '../../persistence/firestore/PathResolver';

export interface ProductAvailability {
  isAvailable: boolean;
  state?: 'inStock' | 'soldOut';
  // #134: Remy-owned merchant manual hide. Backend never writes it; clients
  // treat isHidden === true as "do not render", independent of isAvailable/state.
  isHidden?: boolean;
  timestamp?: string;
}

export interface OptionAvailability {
  isAvailable: boolean;
  count?: number;
  state?: 'inStock' | 'soldOut';
  // #134: same semantics as ProductAvailability.isHidden above.
  isHidden?: boolean;
  timestamp?: string;
}

export interface AvailabilityDoc {
  products: { [pid: string]: ProductAvailability };
  options: { [oid: string]: OptionAvailability };
}

export async function getAvailability(businessId: string, locationId: string): Promise<AvailabilityDoc | null> {
  const docRef = PathResolver.availabilityDoc(businessId, locationId);
  const snap = await docRef.get();
  if (!snap.exists) return null;
  const data = snap.data()!;
  return {
    products: data.products ?? {},
    options: data.options ?? {},
  };
}

// ---------------------------------------------------------------------------
// Empty maps are no-ops, never erasure (#157)
//
// set(data, { merge: true }) derives its update mask from the LEAF paths in
// `data`. A map with no entries has no leaves, so the mask entry becomes the
// map's OWN path and the empty map is written as that field's value — i.e. a
// full subtree replacement. That is documented Firestore behaviour, not an SDK
// bug: `{ options: {} }` wipes every option entry at a location, and
// `{ options: { <id>: {} } }` wipes that one entry's fields. A truthiness test
// cannot catch it — `{}` is truthy — and a top-level-only guard leaves the
// per-entity case open, so all four writers funnel through writeAvailability()
// below, which holds the file's ONLY merge-set and is unreachable with an
// empty payload.
//
// "Empty" means "no key whose value is DEFINED", not "no keys". The prune runs
// here, before the payload reaches the SDK, but ignoreUndefinedProperties (a
// consumer-side setting this library never sets) strips undefined properties
// INSIDE the SDK, before it computes the mask. So for such a consumer
// `{ <id>: { isAvailable: undefined } }` would survive a key-count test, then
// reach the wire as `{ <id>: {} }` and erase the entry anyway. Testing for
// defined values closes that. Falsy-but-defined must survive: dropping
// `{ isAvailable: false }` would stop sold-out items being marked sold out.
//
// Accepted trade-off: under the DEFAULT SDK config `{ isAvailable: undefined }`
// used to throw `Cannot use "undefined" as a Firestore value`; it now
// becomes a silent no-op. Same direction as the rest of this fix (erasing or
// failing writes become no-ops), so it is deliberate rather than incidental.
//
// Consequence for callers: `undefined` and `{}` are now indistinguishable —
// both mean "no change". Anything that genuinely wants to CLEAR data must use
// removeProductAvailability / removeOptionAvailability / deleteAvailabilityDoc.
// Note the deliberate contrast with the "Entry removal (#133)" block below:
// removal is update() + dotted-key FieldValue.delete() precisely because a
// merge-set cannot express a delete. Do not harmonise the two idioms.
// ---------------------------------------------------------------------------

// Non-objects (including null) are deliberately NOT empty: they are passed
// through untouched, preserving today's behaviour rather than silently
// swallowing a malformed entry.
function isEmptyEntry(entry: unknown): boolean {
  if (entry === null || typeof entry !== 'object') return false;
  return !Object.values(entry as Record<string, unknown>).some((value) => value !== undefined);
}

// Decides whether to keep a WHOLE entry; it never rewrites a surviving entry's
// contents (stripping undefined keys inside a survivor would turn a
// default-config throw into a silent partial write). Survivors are kept by
// reference, so an unpruned payload stays deep-equal to the caller's input.
function pruneEmptyEntries<T>(entries: { [id: string]: T } | undefined): { [id: string]: T } | undefined {
  if (!entries) return undefined;
  const kept = Object.entries(entries).filter(([, entry]) => !isEmptyEntry(entry));
  return kept.length > 0 ? Object.fromEntries(kept) : undefined;
}

// The single write path for every availability writer. Prunes empty entries,
// drops a products/options map that pruning emptied, and returns without
// touching Firestore — not even resolving the doc ref — when nothing survives.
async function writeAvailability(
  businessId: string,
  locationId: string,
  updates: {
    products?: { [pid: string]: ProductAvailability };
    options?: { [oid: string]: OptionAvailability };
  },
): Promise<void> {
  // pruneEmptyEntries returns undefined (never {}) for a map with no survivors,
  // so these two are the whole "did anything survive?" test.
  const products = pruneEmptyEntries(updates.products);
  const options = pruneEmptyEntries(updates.options);
  if (!products && !options) return;

  const payload: { products?: Record<string, ProductAvailability>; options?: Record<string, OptionAvailability> } = {
    ...(products ? { products } : {}),
    ...(options ? { options } : {}),
  };

  const docRef = PathResolver.availabilityDoc(businessId, locationId);
  // Nested-object merge-set (not a dotted key, not update()): nests under
  // products.<id> / options.<id> AND upserts, creating the doc when it does not
  // yet exist.
  await docRef.set(payload, { merge: true });
}

// An empty `availability` is a no-op, not an erasure of products.<id> — see the
// "Empty maps are no-ops" block above.
export async function setProductAvailability(
  businessId: string,
  locationId: string,
  productId: string,
  availability: ProductAvailability,
): Promise<void> {
  await writeAvailability(businessId, locationId, { products: { [productId]: availability } });
}

// An empty `availability` is a no-op, not an erasure of options.<id> — see the
// "Empty maps are no-ops" block above.
export async function setOptionAvailability(
  businessId: string,
  locationId: string,
  optionId: string,
  availability: OptionAvailability,
): Promise<void> {
  await writeAvailability(businessId, locationId, { options: { [optionId]: availability } });
}

// An empty map — or one whose every entry is empty — writes nothing rather than
// erasing the whole `products` subtree; see the "Empty maps are no-ops" block.
export async function setProductAvailabilityBatch(
  businessId: string,
  locationId: string,
  products: { [pid: string]: ProductAvailability },
): Promise<void> {
  await writeAvailability(businessId, locationId, { products });
}

// Present-but-empty `products` / `options` maps are dropped from the payload
// rather than erasing their subtrees, and empty per-entity maps are dropped
// rather than erasing that entity's fields; see the "Empty maps are no-ops"
// block. When nothing survives, no RPC is issued.
export async function updateAvailability(
  businessId: string,
  locationId: string,
  updates: {
    products?: { [pid: string]: ProductAvailability };
    options?: { [oid: string]: OptionAvailability };
  },
): Promise<void> {
  await writeAvailability(businessId, locationId, updates);
}

export async function getOptionTimestamp(
  businessId: string,
  locationId: string,
  optionId: string,
): Promise<Date | undefined> {
  const doc = await getAvailability(businessId, locationId);
  const ts = doc?.options?.[optionId]?.timestamp;
  return ts ? new Date(ts) : undefined;
}

// ---------------------------------------------------------------------------
// Entry removal (#133)
//
// Removal is the ONE deliberate exception to this file's merge-set convention
// (see the "#70 regression" tests). Two reasons, both load-bearing:
//
// 1. FieldValue.delete() is honoured ONLY at the root of an update() map, so
//    the key must be the dotted string `options.<id>` / `products.<id>`. The
//    nested form — update({ options: { <id>: FieldValue.delete() } }) — is
//    rejected by the client before it ever reaches the server.
// 2. Do NOT "fix" this back to set(..., { merge: true }). A merge-set upserts,
//    so pruning a location that has no AvailabilityDoc would materialise an
//    empty document and flip getAvailability() from null to {products:{},
//    options:{}}. A referential-integrity cleanup must not create garbage docs.
// ---------------------------------------------------------------------------

// update() carries an implicit "document must exist" precondition; a missing
// doc surfaces as gRPC NOT_FOUND (5), which is the expected no-op for a prune.
// The check stays narrow on purpose: a blanket swallow would also hide
// PERMISSION_DENIED (7), RESOURCE_EXHAUSTED (8), INVALID_ARGUMENT (3) and
// deadline errors, silently turning a broken sync into a successful no-op.
function isDocumentNotFound(err: unknown): boolean {
  return (err as { code?: number }).code === GrpcStatus.NOT_FOUND;
}

async function removeAvailabilityEntries(
  businessId: string,
  locationId: string,
  field: 'products' | 'options',
  ids: string[],
): Promise<void> {
  // update() rejects an empty field map SYNCHRONOUSLY ("At least one field must
  // be updated."), so guard before issuing any RPC.
  if (ids.length === 0) return;

  // All ids for one location coalesce into a single update() — same delete-map
  // idiom as CascadeRelationshipHandler.
  const deletes = Object.fromEntries(ids.map((id) => [`${field}.${id}`, FieldValue.delete()]));

  const docRef = PathResolver.availabilityDoc(businessId, locationId);
  try {
    await docRef.update(deletes);
  } catch (err) {
    if (!isDocumentNotFound(err)) throw err;
  }
}

export async function removeOptionAvailability(businessId: string, locationId: string, optionIds: string[]): Promise<void> {
  await removeAvailabilityEntries(businessId, locationId, 'options', optionIds);
}

export async function removeProductAvailability(businessId: string, locationId: string, productIds: string[]): Promise<void> {
  await removeAvailabilityEntries(businessId, locationId, 'products', productIds);
}

export async function deleteAvailabilityDoc(businessId: string, locationId: string): Promise<void> {
  // delete() has no existence precondition — it is already idempotent on a
  // missing document, so an exists-check or try/catch here would be dead code.
  await PathResolver.availabilityDoc(businessId, locationId).delete();
}
