import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { PathResolver } from '../../persistence/firestore/PathResolver';
import { stripUndefined } from '../../persistence/firestore/sanitize';
import { requireNonNegativeIntegerOrNeg1 } from '../validation';

/**
 * P41 per-entity availability entry — one document per (location, catalog entity) at
 * `businesses/{businessId}/public/catalog/inventory/{locationId}/entries/{entityId}`
 * (doc id = KIOS entity `Id`: Product.Id or Option.Id).
 *
 * PARITY — the canonical declaration is `AvailabilityEntry` in `@kiosinc/commons-types`
 * `types/availabilityTypes.ts` (kiosinc/kios-commons-types#74). This one is structurally
 * assignable to it: same member names, order and optionality; the one intended difference is
 * `updatedAt`, typed as the Admin SDK `Timestamp` here and as `FirestoreTimestampLike` there
 * (the client SDKs' timestamp shape). `__tests__/AvailabilityEntry.parity.test.ts` asserts this
 * declaration member-for-member against the checked-in snapshot
 * `__tests__/fixtures/availabilityEntry.contract.json`, which pins the commons-types shape on this
 * side; a change to the contract must land in all three (commons-types, this file, the snapshot).
 * Contract: kiosinc/restaurant-core-claude#162 §1 as amended 2026-09-03.
 *
 * Every field except `kind`/`updatedAt` is optional and owned by exactly one writer (see the
 * contract's ownership table); a missing document and a missing field both mean "default".
 * `isAvailable` is deliberately NOT stored — the client fold derives
 * `isAvailable = !(isPresent === false || state === 'soldOut')`.
 *
 * The union types are written inline rather than through the aliases below on purpose: the
 * parity test compares the literal type text of each member against the snapshot, so an alias
 * here would hide a retype from it.
 */
export interface AvailabilityEntry {
  kind: 'product' | 'option';
  isPresent?: boolean;           // sync-owned. false = not sold at this location. Absent = present.
  state?: 'inStock' | 'soldOut'; // webhook-owned (tracked); sync-owned (untracked); remy manual override.
  count?: number;                // webhook-owned (tracked); sync writes -1 (untracked). Absent or -1 = untracked, 0 = sold out, >0 = max orderable.
  isInventoryTracked?: boolean;  // sync-owned, option entries. Absent = tracked; false persists and is never a default entry (gateway#375).
  isHidden?: boolean;            // remy-owned.
  timestamp?: string;            // webhook staleness guard (Square calculated_at, ISO-8601).
  updatedAt: Timestamp;          // set on EVERY write. Admin SDK: FieldValue.serverTimestamp(); client writers (Remy): Timestamp.now(). Readers tolerate a missing/null value (the probe reads the server-side max).
}

export type AvailabilityEntryKind = AvailabilityEntry['kind'];
export type AvailabilityEntryState = NonNullable<AvailabilityEntry['state']>;

/**
 * Caller-writable fields: `kind` required, `updatedAt` service-owned.
 *
 * `kind` is required here (and only optional-with-default on {@link AvailabilityCountWrite}) on
 * purpose: `setEntry` upserts, so any write may be the one that creates the document, and a
 * `kind`-less document is one the client fold cannot classify. The asymmetry with the count
 * write is deliberate — see the note there.
 */
export type AvailabilityEntryWrite =
  Pick<AvailabilityEntry, 'kind'> & Partial<Omit<AvailabilityEntry, 'kind' | 'updatedAt'>>;

/**
 * Runtime allow-list backing `AvailabilityEntryWrite`; the parity test pins it to the snapshot
 * minus `updatedAt`. Types only bind TypeScript callers — this list is what stops an untyped JS
 * caller's `isAvailable` or `updatedAt` from ever reaching the SDK.
 */
export const ENTRY_WRITABLE_FIELDS = [
  'kind', 'isPresent', 'state', 'count', 'isInventoryTracked', 'isHidden', 'timestamp',
] as const;

export interface AvailabilityCountWrite {
  state: AvailabilityEntryState;
  count: number;
  /** Square `calculated_at`, ISO-8601. Required: an unguarded count write would defeat the monotonic guard. */
  timestamp: string;
  /**
   * Written only when the entry does not yet exist. Square counts exist only for ITEM_VARIATIONs
   * (= Options), hence the `'option'` default — the one place `kind` is optional. On
   * {@link AvailabilityEntryWrite} it is required because there is no such default to fall back on.
   */
  kind?: AvailabilityEntryKind;
}

/**
 * What `setEntryCountGuarded` did. The two `skipped*` outcomes are the contract's "abort is not an
 * error" (#162 §2) — expected, silent, and reported through the return value rather than a log
 * line. This library has no logger and no business context (`businessId`, `syncTraceId`); the
 * gateway does, so it is the layer that decides whether a skip is worth a line or a batch summary
 * (LOGGING.md rules 1, 4, 10, 12).
 */
export type GuardedWriteOutcome = 'written' | 'skippedUntracked' | 'skippedStale';

/** `getAll` has no documented doc-count cap; 100 bounds each `BatchGetDocuments` stream. */
export const GET_ENTRIES_CHUNK = 100;
/** Firestore's per-`WriteBatch` ceiling; deletes carry no transforms so a delete is one write. */
export const DELETE_ENTRIES_CHUNK = 500;

export function entryRef(businessId: string, locationId: string, entityId: string): FirebaseFirestore.DocumentReference {
  return PathResolver.inventoryEntryDoc(businessId, locationId, entityId);
}

/**
 * True when the entry carries nothing worth storing — a missing document means exactly this.
 * `kind`, `timestamp` and `updatedAt` never affect defaultness.
 *
 * Comparisons are strict on purpose: `null` and `0` are stored values, not "absent", so a
 * `count: null` from a JS caller is NOT default, and `count: 0` (sold out) is not either.
 * `isInventoryTracked: false` persists and is never default (gateway#375) — an untracked option
 * that was swept away as "default" would be recreated tracked, and the next inventory webhook
 * would write a count onto it.
 */
export function isDefaultEntry(entry: Readonly<Partial<AvailabilityEntry>>): boolean {
  return entry.isPresent !== false
    && entry.state !== 'soldOut'
    && entry.isHidden !== true
    && (entry.count === undefined || entry.count === -1)
    && entry.isInventoryTracked !== false;
}

// ---------------------------------------------------------------------------
// Merge-set, never update()
//
// Every writer of an entry owns a disjoint field subset and must be able to
// upsert without knowing whether the document exists. `set(data, { merge: true })`
// derives its update mask from the leaf paths of `data`, so only the caller's
// own fields are touched and a missing document is created. `update()` carries
// an implicit "document must exist" precondition and would turn the first write
// at a new location into NOT_FOUND.
//
// The #157 "empty map erases a subtree" hazard documented in AvailabilityService
// does not apply here: `AvailabilityEntry` is all-scalar top-level fields, so a
// merge-set of `{}` plus `updatedAt` writes exactly `updatedAt` and nothing else.
// Any future NESTED field re-introduces it — an `{}` leaf replaces that subtree —
// and would need the prune-before-strip treatment AvailabilityService applies.
// ---------------------------------------------------------------------------

/**
 * Upsert the caller's owned fields onto an entry and bump `updatedAt`.
 *
 * Payload keys are allow-listed at runtime (`ENTRY_WRITABLE_FIELDS`), `undefined` values are
 * stripped, and `updatedAt` is always the server-timestamp sentinel — a caller-supplied
 * `updatedAt` is discarded, not merged.
 */
export async function setEntry(
  businessId: string,
  locationId: string,
  entityId: string,
  entry: AvailabilityEntryWrite,
): Promise<void> {
  if (entry.count !== undefined) requireNonNegativeIntegerOrNeg1('count', entry.count);
  const payload = stripUndefined({ ...pickWritable(entry), updatedAt: FieldValue.serverTimestamp() });
  await entryRef(businessId, locationId, entityId).set(payload, { merge: true });
}

/**
 * Inventory-webhook count write, protected against out-of-order delivery and against untracked
 * entries, inside one transaction.
 *
 * Both guards run BEFORE anything is queued on the transaction — the `fencedUpdate` idiom in
 * `WebhookClaim.ts` — so a rejected write is structurally absent rather than incidentally
 * skipped: returning early with zero queued writes is a successful, empty commit. The callback
 * has no side effects outside `tx`, so the SDK's contention retry is safe.
 *
 * Staleness is compared as instants (`Date.parse` millis on both ISO strings), not as strings —
 * string order mis-ranks mixed offsets (`+00:00` vs `Z`) and mixed precision. Equal instants abort
 * (`>=`), matching the gateway's guard. An unparseable STORED timestamp yields `NaN >= x`, which is
 * `false`, so a poisoned entry self-heals on the next good write instead of wedging forever. The
 * INCOMING timestamp is required and validated before the transaction opens: without it the
 * monotonic guard has nothing to compare, so it is a caller bug, not a skip.
 *
 * `kind` is written only when the document is being created here: an existing document already
 * has one, and Square inventory counts exist only for ITEM_VARIATIONs, so the create-on-missing
 * default is `'option'`. Overwriting an existing `kind` from a count write would let a webhook
 * reclassify a product entry.
 *
 * Nothing is logged on either skip path — see {@link GuardedWriteOutcome}.
 */
export async function setEntryCountGuarded(
  businessId: string,
  locationId: string,
  entityId: string,
  count: AvailabilityCountWrite,
): Promise<GuardedWriteOutcome> {
  const incomingMs = typeof count.timestamp === 'string' ? Date.parse(count.timestamp) : NaN;
  if (Number.isNaN(incomingMs)) {
    throw new Error('setEntryCountGuarded: timestamp must be an ISO-8601 string');
  }
  requireNonNegativeIntegerOrNeg1('count', count.count);

  const ref = entryRef(businessId, locationId, entityId);
  return getFirestore().runTransaction(async (tx): Promise<GuardedWriteOutcome> => {
    const snap = await tx.get(ref);
    const data = snap.data();
    // Trackedness first: an untracked entry is skipped regardless of how its timestamp compares.
    if (data?.isInventoryTracked === false) return 'skippedUntracked';
    const stored = data?.timestamp;
    if (typeof stored === 'string' && Date.parse(stored) >= incomingMs) return 'skippedStale';

    const payload = stripUndefined({
      ...(snap.exists ? {} : { kind: count.kind ?? 'option' }),
      state: count.state,
      count: count.count,
      timestamp: count.timestamp,
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.set(ref, payload, { merge: true });
    return 'written';
  });
}

/**
 * Existing entries for the given entity ids, keyed by entity id. Ids are deduped and falsy ones
 * dropped; missing documents are simply absent from the result. Chunks are fetched in parallel.
 */
export async function getEntries(
  businessId: string,
  locationId: string,
  entityIds: readonly string[],
): Promise<Map<string, AvailabilityEntry>> {
  const entries = new Map<string, AvailabilityEntry>();
  const ids = normalizeIds(entityIds);
  if (ids.length === 0) return entries;

  const db = getFirestore();
  const pages = await Promise.all(
    chunk(ids, GET_ENTRIES_CHUNK).map((page) => db.getAll(...page.map((id) => entryRef(businessId, locationId, id)))),
  );
  for (const snaps of pages) {
    for (const snap of snaps) {
      if (snap.exists) entries.set(snap.id, snap.data() as AvailabilityEntry);
    }
  }
  return entries;
}

/**
 * Delete entries through chunked `WriteBatch`es — one atomic `commit()` per chunk, chunks
 * sequential. `delete()` carries no exists-precondition, so missing documents are tolerated
 * without a read.
 */
export async function deleteEntries(
  businessId: string,
  locationId: string,
  entityIds: readonly string[],
): Promise<void> {
  const ids = normalizeIds(entityIds);
  if (ids.length === 0) return;

  const db = getFirestore();
  for (const page of chunk(ids, DELETE_ENTRIES_CHUNK)) {
    const batch = db.batch();
    for (const id of page) batch.delete(entryRef(businessId, locationId, id));
    await batch.commit();
  }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

type WritableEntryFields = Partial<Pick<AvailabilityEntry, (typeof ENTRY_WRITABLE_FIELDS)[number]>>;

/** Copies only allow-listed keys that are present on the input; `undefined` values are left for `stripUndefined`. */
function pickWritable(entry: AvailabilityEntryWrite): WritableEntryFields {
  const picked: Record<string, unknown> = {};
  for (const field of ENTRY_WRITABLE_FIELDS) {
    if (field in entry) picked[field] = entry[field];
  }
  return picked as WritableEntryFields;
}

function normalizeIds(ids: readonly string[]): string[] {
  return Array.from(new Set(ids.filter((id) => Boolean(id))));
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}
