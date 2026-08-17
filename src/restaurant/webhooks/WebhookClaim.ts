/**
 * # `WebhookClaim` — the P42 webhook claim / lease / fence primitive
 *
 * The single canonical copy of the P42 webhook-delivery contract
 * (kiosinc/restaurant-core-claude#165, closed as a satisfied design gate; epic
 * kiosinc/square-gateway-claude#281). rcc#165 was closed *because* this file
 * carries the contract, so treat the documentation here as the specification: a
 * reviewer should be able to reconstruct the whole contract from this file alone.
 *
 * ## What the primitive is
 *
 * Distributed mutual exclusion with a **lease** and a **monotonic fencing token**,
 * over Firestore, protecting a side-effecting Square webhook handler whose lease
 * holder may be a zombie (a paused, GC-stalled or network-partitioned Cloud Run
 * instance that is still able to commit writes).
 *
 * Four moving parts, one per canonical part of the pattern:
 *
 * | Canonical part | Here |
 * |---|---|
 * | Atomic create-if-absent as the mutual-exclusion primitive (one server-evaluated RPC, no read-then-write TOCTOU window) | `DocumentReference.create()` — an `exists: false` precondition evaluated by the server |
 * | A lease, not a lock, so a dead holder cannot wedge the event forever | `leaseExpiresAt`, compared against the reader's clock on every read |
 * | A monotonic fencing token, so a resurrected holder cannot commit over the new holder | `leaseGeneration`, asserted `=== mine` inside every terminal transaction |
 * | Idempotency where the resource cannot honour a fencing token (Square's API) | {@link claimIdempotencyKey} — `kios-${eventId}-${phase}` |
 *
 * Plus a P42-specific fifth part: **the claim document is also the durable record**
 * of the delivery — see the `payload` rationale below.
 *
 * ## Collection: `webhookClaims/{eventId}` — top-level, deliberately
 *
 * The claim lives in a top-level collection (`PathResolver.webhookClaimsCollection()`),
 * not under `businesses/{businessId}`, for four reasons:
 *
 * 1. A claim is **delivery plumbing, not tenant data**. It records that *we* handled a
 *    Square notification; it is not part of any business's domain state.
 * 2. Square's `event_id` is **already globally unique**, so it needs no tenant prefix to
 *    be a safe document id (unlike the legacy RTDB key `${businessId}_${Id}`).
 * 3. A claim can be taken **before tenant resolution**. Keying on `businessId` would force
 *    two extra Firestore reads (merchant → business) on every duplicate delivery, on the
 *    hottest path there is.
 * 4. The sweeper (cf#82) needs exactly one query, and it is **cross-tenant**: "claims that
 *    are `claimed` with an expired lease". A collection-group query over per-tenant
 *    subcollections would buy nothing and cost an index.
 *
 * Consequence, stated so nobody discovers it by surprise: **claims do not cascade on
 * business delete.** Deleting a business leaves its claims in place; they expire on their
 * own 72 h TTL. That is intentional — a claim outliving its tenant is harmless, whereas a
 * claim deleted early would let a redelivered event reprocess.
 *
 * ## Expiry is read from stored fields, never from TTL
 *
 * Firestore's TTL service is **storage reclamation only**, and both of these are
 * documented platform behaviours:
 *
 * - *"Data is typically deleted within 24 hours after its expiration date."*
 * - *"Expired documents continue to appear in queries and lookup requests until the TTL
 *   process actually deletes them."*
 *
 * So a document whose `expiresAt` has passed may still be readable for up to a day, and a
 * document whose `leaseExpiresAt` has passed is *not* removed by anything. Every expiry
 * decision in this module therefore compares a **stored field** against the reader's clock
 * (`leaseExpiresAt` for the lease, `expiresAt` only as TTL's input). Nothing here relies on
 * TTL having run, and the sweeper must not either. This mirrors `SemaphoreV2.isExpired` /
 * `releaseIfExpired`, which evaluate a stored `expiresAt` for the same reason.
 *
 * `expiresAt` **must** be a real Firestore `Timestamp`: TTL policies only accept a
 * *Date and time* field, and silently ignore documents whose field is a string.
 *
 * ## Why `payload` is stored verbatim
 *
 * The claim document is the **only durable record of the notification**:
 *
 * - Square's Events API (which would let us re-fetch an event by id) is **not available**
 *   on these accounts, so a lost body cannot be re-read from Square.
 * - Cloud Tasks has **no dead-letter queue**: when a task exhausts its retries the task —
 *   and with it the request body — is **deleted**. Nothing else keeps a copy.
 * - The replay tool (cf#83) reconstructs a Cloud Task body from **this field**. Without it,
 *   a poisoned or rolled-back delivery is unrecoverable — which is the loss P42 exists to
 *   prevent.
 *
 * Cost is small and bounded: Square notification bodies are a few KB against Firestore's
 * 1 MiB document limit, and the 72 h `expiresAt` TTL reclaims them.
 *
 * ### Payload fidelity limits (know these before building a replay)
 *
 * A round-trip through Firestore preserves the *structure*, not the *bytes*:
 *
 * - **Map key order is not preserved** — Firestore stores map keys sorted. A replayed body
 *   is therefore **not byte-identical** to what Square sent, so it **cannot be re-verified
 *   against Square's HMAC signature**. Signature verification must stay at the receiver,
 *   *before* the claim is taken, and cf#83's replay must not attempt it.
 * - **Numbers are normalized** — integral JSON numbers come back as integers (`1.0` is
 *   already `1` after `express.json()`, before this module sees it).
 * - **Nested arrays (`[[1, 2]]`) are rejected by Firestore outright.** `create()` throws and
 *   the delivery 500s rather than silently losing data. Square payloads are not known to
 *   contain them; the behaviour is pinned by an emulator test rather than worked around,
 *   because swallowing it would mean writing a claim whose payload is not the payload.
 * - **Map keys that are empty strings or `__reserved__`-shaped are rejected** by Firestore.
 *
 * ## Two intentional divergences from repo convention (for reviewers)
 *
 * 1. **`Timestamp` fields instead of the repo's ISO-string convention.** Domain models here
 *    serialize dates as ISO strings via `baseFieldsToFirestore`. This module stores real
 *    `Timestamp`s because a Firestore TTL policy requires a *Date and time* field — an ISO
 *    string would make `expiresAt` inert and leak claims forever.
 * 2. **Free functions instead of a static class.** `SemaphoreV2` exposes statics on a class
 *    that also models a document. There is no `WebhookClaim` *object* to model — the claim
 *    is data read straight from Firestore — and the exhaustiveness machinery
 *    ({@link matchAcquireResult}) is function-shaped by nature.
 *
 * ## Precondition: REST transport must be off
 *
 * `acquireClaim` depends on `create()` **failing fast** with `ALREADY_EXISTS` when the claim
 * exists. With Firestore's REST transport that guarantee is broken:
 * `firebase/firebase-admin-node#2587` (still open) shows the endpoint returning HTTP **409**
 * both for "document already exists" *and* for a server-aborted request; a Firebase engineer
 * confirms on the thread that *"the SDK cannot distinguish these two conditions and it is
 * retrying the request"*, with no workaround. Under REST the duplicate path therefore
 * **hangs until timeout instead of rejecting**.
 *
 * REST transport is not only a settings choice — `@google-cloud/firestore` also picks
 * `preferRest` up from the **`FIRESTORE_PREFER_REST` environment variable**. So a consumer's
 * env can silently break this primitive.
 *
 * **Required of every consumer:** do not pass `preferRest: true` to `initializeFirestore`,
 * and do not set `FIRESTORE_PREFER_REST` in the service's environment. This module logs a
 * warning at module load if it sees the variable. It is deliberately **not** worked around in
 * code: a create-timeout-then-read fallback would reintroduce exactly the read-then-write
 * race the `create()` precondition exists to remove.
 *
 * ## Relationship to the legacy RTDB gate
 *
 * During the migration window an acquired or resumed claim also writes the legacy
 * `EventNotification` RTDB node, so flipping `useClaimLease` back off is a pure flag flip
 * with no data restoration. See {@link isDualWriteLegacyNotification}. The legacy module is
 * untouched by P42 and keeps working exactly as before — coexistence, not replacement, until
 * rcc#167 retires the node.
 *
 * @packageDocumentation
 */

import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import type { DocumentReference, DocumentSnapshot, Transaction } from 'firebase-admin/firestore';
import { PathResolver } from '../../persistence/firestore/PathResolver';
import * as Constants from '../../firestore-core/Constants';
import { ValidationError } from '../../domain/validation';
import EventNotification from '../connected-accounts/EventNotification';

/**
 * Lifecycle state of a claim.
 *
 * - `claimed` — a worker holds (or held) the lease and the delivery is unfinished. Whether
 *   the holder is alive is decided by `leaseExpiresAt`, not by this field.
 * - `done` — the delivery finished and `result` caches the HTTP status the handler returned.
 * - `failed` — the delivery is human-owned: it exhausted its attempts or hit a
 *   non-retryable error. Redeliveries reply 200 so Square and Cloud Tasks stop retrying,
 *   while the claim (and its `payload`) stays for cf#83 to replay.
 */
export type ClaimStatus = 'claimed' | 'done' | 'failed';

/**
 * The `webhookClaims/{eventId}` document.
 *
 * Field-by-field semantics — this is the stored shape, and the field set is exact
 * (a claim carries no other fields):
 *
 * - `eventId` — Square's `event_id`, verbatim. Also the document id, so it is stored
 *   redundantly on purpose: the sweeper's query results carry it without a `ref.id` hop.
 * - `eventType` — Square's `type` (e.g. `order.updated`). Renamed from the legacy
 *   `EventNotification.type`. Best-effort metadata: `''` when Square omitted it, never fatal.
 * - `businessId` — **a field, not a path segment, and may be absent.** A claim taken before
 *   tenant resolution has no `businessId`; it is written when known, and omitted entirely
 *   (never `undefined`, which Firestore rejects) when not. Consequence: such a claim gets no
 *   legacy dual-write, i.e. it is **not rollback-protected** — see
 *   {@link isDualWriteLegacyNotification}.
 * - `merchantId` — Square's `merchant_id`. Best-effort metadata like `eventType`.
 * - `status` — see {@link ClaimStatus}. Replaces the legacy "node exists ⇒ already seen"
 *   boolean, which could not tell *finished* from *in progress*.
 * - `phase` — **the recovery point.** A short handler-defined label for the last completed
 *   step (`'started'` on acquire, then whatever the handler advances to). A `resumed` worker
 *   restarts from this phase instead of from the beginning, and it is the `phase` component
 *   of {@link claimIdempotencyKey}. Never rewound by a reclaim.
 * - `result` — **absent until completion**, then the HTTP status the handler returned
 *   ({@link completeClaim}). A duplicate delivery of a `done` claim replays this status
 *   instead of re-running the handler.
 * - `payload` — the **verbatim** Square notification body, the only durable replay source.
 *   See the file header for why it is stored and what fidelity it does and does not have.
 * - `leaseExpiresAt` — when the current holder's lease lapses. Compared against the reader's
 *   clock on read; nothing expires it server-side. Renewed by {@link advancePhase}
 *   (progress is a heartbeat) and force-expired by {@link releaseClaim}.
 * - `leaseGeneration` — the **monotonic fencing token**. `1` on acquire, `+1` on every
 *   steal of an expired lease, never bumped by progress. Asserted `=== mine` inside every
 *   terminal transaction.
 * - `attemptCount` — how many workers have held this claim (`1` on acquire, `+1` per steal).
 *   The poison-message bound: the sweeper fails a claim that has burnt too many attempts.
 * - `createdAt` — when the claim was first taken (our clock, not Square's). Square's own
 *   `created_at` is deliberately **not** a separate field: it is already inside the verbatim
 *   `payload`, and duplicating it would put the stored field set out of step with the
 *   contract.
 * - `expiresAt` — `createdAt + 72 h`, and **TTL input only.** No code branches on it; it
 *   exists so Firestore's TTL service reclaims the claim (and its payload) after the replay
 *   window closes. Never slid forward by a reclaim, so a repeatedly stolen claim still
 *   expires 72 h after its first delivery.
 */
export interface WebhookClaim {
  eventId: string;
  eventType: string;
  businessId?: string;
  merchantId: string;
  status: ClaimStatus;
  phase: string;
  result?: number;
  payload: Record<string, unknown>;
  leaseExpiresAt: Timestamp;
  leaseGeneration: number;
  attemptCount: number;
  createdAt: Timestamp;
  expiresAt: Timestamp;
}

/**
 * The outcome of {@link acquireClaim} — a discriminated union with **no skip member**.
 *
 * ## Acquire / branch table
 *
 * | Claim state on arrival | Outcome | Caller does | HTTP |
 * |---|---|---|---|
 * | No claim document (`create()` succeeded) | `acquired` | Run the handler from the beginning | whatever the handler returns |
 * | `status: 'claimed'`, `leaseExpiresAt > now` (a live holder) | `inFlight` | **Return 429 so the delivery is retried.** Never treat as handled | **429** |
 * | `status: 'claimed'`, `leaseExpiresAt <= now` (holder is gone or wedged) | `resumed` | Resume the handler from `claim.phase` under the new `claim.leaseGeneration` | whatever the handler returns |
 * | `status: 'done'` | `done` | Replay the cached `result` without re-running the handler | the cached `result` (200 if it was never recorded) |
 * | `status: 'failed'` | `failed` | Return 200 so retries stop; the claim is human-owned and cf#83 can replay it | **200** |
 * | Claim absent again when read after `ALREADY_EXISTS` (TTL or the sweeper deleted it mid-operation) | `acquired` | Treated as a fresh delivery — the create is retried once | as `acquired` |
 * | Unrecognised `status` (data written by a future or broken version) | `inFlight` | Return 429 — degrade to *retry*, never to *drop* | **429** |
 *
 * **Skipping is never an outcome.** The legacy RTDB gate collapsed "already finished" and
 * "someone else is working on it" into one silent skip, and that is precisely how P42's
 * events were lost: an in-flight duplicate was answered 200 and the real work never
 * happened. There is no `'skip'` member of this union and no catch-all, so a consumer
 * cannot express that behaviour even by accident.
 *
 * ## Handling it exhaustively
 *
 * Preferred — {@link matchAcquireResult}, whose handler map has five **required** keys, so a
 * missing branch is a compile error regardless of the consumer's `tsconfig`:
 *
 * ```ts
 * return matchAcquireResult(await acquireClaim(input), {
 *   acquired: (claim) => runHandler(claim, INITIAL_PHASE),
 *   resumed:  (claim) => runHandler(claim, claim.phase),
 *   inFlight: () => res.sendStatus(429),
 *   done:     (result) => res.sendStatus(result),
 *   failed:   () => res.sendStatus(200),
 * });
 * ```
 *
 * Alternative — an exhaustive `switch`, which only *becomes* exhaustive if you add the
 * `never` tail (a bare `switch` compiles with a branch missing unless the consumer enables
 * `noImplicitReturns`):
 *
 * ```ts
 * switch (result.outcome) {
 *   case 'acquired': case 'resumed': return runHandler(result.claim);
 *   case 'inFlight': return res.sendStatus(429);
 *   case 'done': return res.sendStatus(result.result);
 *   case 'failed': return res.sendStatus(200);
 *   default: { const exhaustive: never = result; throw new Error(`unhandled ${exhaustive}`); }
 * }
 * ```
 *
 * Note that `claim` exists **only** on `acquired` and `resumed`: reading `result.claim`
 * without narrowing on `outcome` is a type error, which is the second, cheaper guard.
 */
export type AcquireResult =
  | { outcome: 'acquired'; claim: WebhookClaim }
  | { outcome: 'resumed'; claim: WebhookClaim }
  | { outcome: 'inFlight' }
  | { outcome: 'done'; result: number }
  | { outcome: 'failed' };

/** Input to {@link acquireClaim}. */
export interface AcquireClaimInput {
  /** Square's `event_id`, verbatim. Validated for UUID *shape* — see {@link EVENT_ID_PATTERN}. */
  eventId: string;
  /** Square's `type`. Absent ⇒ stored as `''` with a warning; metadata never costs an event. */
  eventType: string;
  /** Square's `merchant_id`. Absent ⇒ stored as `''` with a warning. */
  merchantId: string;
  /** The verbatim notification body. Stored as-is; `{}` is legal, `null`/non-object is a `ValidationError`. */
  payload: Record<string, unknown>;
  /**
   * Square's `created_at` (an ISO string on `SquareEventNotification`, or a `Date`).
   * Drives the {@link MAX_EVENT_AGE_MS} age gate. Missing or unparseable ⇒ warn and proceed.
   */
  eventCreatedAt: string | Date;
  /** Resolved tenant, when it is already known. Omitted from the document when absent. */
  businessId?: string;
  /** Lease length for this acquire. Defaults to {@link DEFAULT_LEASE_MS}. */
  leaseMs?: number;
}

/**
 * Handler map for {@link matchAcquireResult}. All five keys are **required** — that is the
 * whole point: it makes "we forgot to handle `inFlight`" a compile error in every consumer,
 * without depending on how strictly the consumer's `tsconfig` is configured.
 */
export interface AcquireHandlers<T> {
  acquired: (claim: WebhookClaim) => T;
  resumed: (claim: WebhookClaim) => T;
  inFlight: () => T;
  done: (result: number) => T;
  failed: () => T;
}

/**
 * Default lease length. Long enough for a Square webhook handler to finish, short enough
 * that a wedged holder is stolen from within one Cloud Tasks retry backoff.
 */
export const DEFAULT_LEASE_MS = 60_000;

/**
 * How long a claim (and therefore its `payload`) is retained: 72 h, the replay window for
 * cf#83. Applied as `expiresAt` and enforced only by Firestore's TTL service.
 */
export const CLAIM_TTL_MS = 72 * 60 * 60 * 1_000;

/**
 * Age beyond which a notification is considered undeliverable and is rejected with
 * {@link EventTooOldError} **before any write** — Square stops retrying long before this, so
 * a body this old is a replay or a stuck queue, not a live delivery.
 */
export const MAX_EVENT_AGE_MS = 24 * 60 * 60 * 1_000;

/** `phase` of a freshly acquired claim: nothing has been done yet. */
export const INITIAL_PHASE = 'started';

/**
 * RFC-4122 **shape** only — 8-4-4-4-12 hex, case-insensitive — with no version or variant
 * nibble check.
 *
 * Deliberately loose: a false rejection here is a **lost event**, which is the exact failure
 * P42 exists to prevent, whereas a false acceptance costs nothing worse than an oddly named
 * document. The check exists only to catch the classes that produced real garbage before —
 * an absent id, an empty string, and synthesized keys such as `${businessId}_undefined` —
 * not to police Square's UUID version.
 */
export const EVENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Internal migration gate for the legacy RTDB dual-write (req 6).
 *
 * While `true`, an `acquired` or `resumed` claim also writes the legacy
 * `EventNotification` node, so flipping the `useClaimLease` feature flag back off is a pure
 * flag flip: the legacy gate finds the node and skips the redelivery, with no data
 * restoration.
 *
 * Not exported from `src/index.ts` on purpose — consumers must not branch on it. Flip it to
 * `false`, then delete it along with the RTDB node in **rcc#167**.
 */
export const isDualWriteLegacyNotification = true;

/**
 * The `eventId` is missing, empty, or not UUID-shaped. Thrown **before any write**: no
 * fallback key is ever synthesized, because a synthesized key is how the legacy
 * `${businessId}_undefined` garbage class came about.
 */
export class InvalidEventIdError extends Error {
  readonly eventId: unknown;

  constructor(eventId: unknown, reason: string) {
    super(`Invalid Square event_id (${reason}): ${JSON.stringify(eventId) ?? String(eventId)}`);
    this.name = 'InvalidEventIdError';
    this.eventId = eventId;
  }
}

/**
 * The caller's `leaseGeneration` is not the one on the claim — it was stolen (or the claim
 * is gone). The fencing failure.
 *
 * Thrown **before any write is queued** on the transaction, so a fenced-out worker cannot
 * commit anything. `actualGeneration` is `undefined` when the claim document is absent.
 */
export class StaleLeaseError extends Error {
  readonly eventId: string;

  readonly expectedGeneration: number;

  readonly actualGeneration?: number;

  constructor(eventId: string, expectedGeneration: number, actualGeneration?: number) {
    super(
      `Stale lease for webhookClaims/${eventId}: expected leaseGeneration ${expectedGeneration}, `
      + `found ${actualGeneration === undefined ? 'no claim' : actualGeneration}`,
    );
    this.name = 'StaleLeaseError';
    this.eventId = eventId;
    this.expectedGeneration = expectedGeneration;
    this.actualGeneration = actualGeneration;
  }
}

/**
 * The notification is older than {@link MAX_EVENT_AGE_MS} and is refused before any claim is
 * written.
 *
 * A third error class rather than a sixth `AcquireResult` member on purpose: all five
 * outcomes presuppose that a claim exists, and an undeliverable event never gets one.
 * Widening the union would weaken the exhaustiveness guarantee that is the point of it.
 */
export class EventTooOldError extends Error {
  readonly eventId: string;

  readonly eventCreatedAt: string;

  readonly ageMs: number;

  constructor(eventId: string, eventCreatedAt: string, ageMs: number) {
    super(
      `Square event ${eventId} created at ${eventCreatedAt} is ${ageMs}ms old, `
      + `beyond the ${MAX_EVENT_AGE_MS}ms delivery window`,
    );
    this.name = 'EventTooOldError';
    this.eventId = eventId;
    this.eventCreatedAt = eventCreatedAt;
    this.ageMs = ageMs;
  }
}

if (process.env.FIRESTORE_PREFER_REST) {
  // eslint-disable-next-line no-console
  console.warn(
    '[WebhookClaim] FIRESTORE_PREFER_REST is set. Firestore REST transport cannot distinguish '
    + '"document already exists" from a server-aborted request (firebase-admin-node#2587), so '
    + 'create() retries instead of failing fast and acquireClaim\'s duplicate path will hang. '
    + 'Unset it before enabling useClaimLease.',
  );
}

/** `webhookClaims/{eventId}` — the claim document reference. */
function claimRef(eventId: string): DocumentReference {
  return PathResolver.webhookClaimsCollection().doc(eventId);
}

/**
 * The idempotency key for an **external** call made while holding a claim — in practice
 * Square's `idempotency_key`.
 *
 * Fencing tokens only work when the protected resource checks them, and Square's API does
 * not. Idempotency is the substitute: keying on `(eventId, phase)` means that if a fenced-out
 * zombie and the new holder both issue the same phase's call, Square collapses them into one
 * effect. `phase` is in the key because one delivery may make several distinct calls, and
 * each must be individually idempotent rather than aliased to its neighbours.
 */
export function claimIdempotencyKey(eventId: string, phase: string): string {
  return `kios-${eventId}-${phase}`;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled AcquireResult: ${JSON.stringify(value)}`);
}

/**
 * Dispatch an {@link AcquireResult} to a handler per outcome.
 *
 * **This is the exhaustiveness enforcement mechanism**, and the reason it exists as a
 * function rather than as advice in a comment. {@link AcquireHandlers} has five required
 * keys, so a handler map that omits `inFlight` (or `done`, or `failed`) **fails to
 * typecheck unconditionally** — no reliance on the consumer's `tsconfig`, unlike a bare
 * `switch`, which needs `noImplicitReturns` or an explicit `never` tail to catch the same
 * mistake. With six square-gateway-claude webhook handlers and two cloud-functions consumers
 * to migrate, "hope everyone wrote an exhaustive switch" is not a control.
 */
export function matchAcquireResult<T>(result: AcquireResult, handlers: AcquireHandlers<T>): T {
  switch (result.outcome) {
    case 'acquired':
      return handlers.acquired(result.claim);
    case 'resumed':
      return handlers.resumed(result.claim);
    case 'inFlight':
      return handlers.inFlight();
    case 'done':
      return handlers.done(result.result);
    case 'failed':
      return handlers.failed();
    default:
      return assertNever(result);
  }
}

/** Throws {@link InvalidEventIdError} unless `eventId` is a non-empty, UUID-shaped string. */
function assertValidEventId(eventId: unknown): asserts eventId is string {
  if (typeof eventId !== 'string' || eventId.length === 0) {
    throw new InvalidEventIdError(eventId, 'missing or empty');
  }
  if (!EVENT_ID_PATTERN.test(eventId)) {
    throw new InvalidEventIdError(eventId, 'not UUID-shaped');
  }
}

/**
 * `ALREADY_EXISTS` detection, defensively.
 *
 * The canonical signal is `GrpcStatus.ALREADY_EXISTS` (`6`), which is what `create()` rejects
 * with over gRPC. Detection also accepts the string `'ALREADY_EXISTS'` and falls back to the
 * message (`6 ALREADY_EXISTS: Document already exists: …`), because the shape reported in the
 * wild varies with transport and SDK version — and misclassifying this error would turn a
 * duplicate delivery into a 500 loop.
 */
function isAlreadyExistsError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const { code, message } = err as { code?: unknown; message?: unknown };
  if (code === 6 || code === 'ALREADY_EXISTS') return true;
  // Message fallback, applied whatever `code` says: only Firestore's own
  // "Document already exists: …" text matches, so it cannot swallow another failure.
  return typeof message === 'string' && /already exists/i.test(message);
}

/** `payload` must be a plain object. `{}` is legal — an empty body is still a delivery. */
function requirePayloadObject(payload: unknown): void {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new ValidationError('payload', 'must be an object');
  }
}

/**
 * Best-effort metadata: a missing `eventType`/`merchantId` is stored as `''` and warned
 * about, never thrown. Square's metadata is not worth losing an event over, and the fields
 * are diagnostics — nothing branches on them.
 */
function metadataOrEmpty(field: string, value: unknown, eventId: string): string {
  if (typeof value === 'string' && value.length > 0) return value;
  // eslint-disable-next-line no-console
  console.warn(`[WebhookClaim] ${field} missing on event ${eventId}; storing '' and proceeding`);
  return '';
}

function toMillisOrUndefined(value: unknown): number | undefined {
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isNaN(ms) ? undefined : ms;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? undefined : ms;
  }
  if (typeof value === 'object' && value !== null && typeof (value as Timestamp).toMillis === 'function') {
    return (value as Timestamp).toMillis();
  }
  return undefined;
}

/**
 * The 24 h age gate. Boundary is **inclusive** — exactly {@link MAX_EVENT_AGE_MS} old is
 * accepted, only strictly older is refused.
 *
 * A missing or unparseable `created_at` **warns and proceeds**: we cannot prove the event is
 * undeliverable, and `attemptCount` plus the sweeper already bound a poison message. Refusing
 * on an unparseable timestamp would let Square's formatting change into an outage.
 */
function assertEventNotTooOld(eventId: string, eventCreatedAt: unknown, now: Timestamp): void {
  const createdMs = toMillisOrUndefined(eventCreatedAt);
  if (createdMs === undefined) {
    // eslint-disable-next-line no-console
    console.warn(
      `[WebhookClaim] created_at missing or unparseable on event ${eventId}; skipping the age gate`,
    );
    return;
  }
  const ageMs = now.toMillis() - createdMs;
  if (ageMs > MAX_EVENT_AGE_MS) {
    const iso = eventCreatedAt instanceof Date
      ? eventCreatedAt.toISOString()
      : String(eventCreatedAt);
    throw new EventTooOldError(eventId, iso, ageMs);
  }
}

/** Read a stored claim into {@link WebhookClaim}, tolerating fields a future version added. */
function hydrateClaim(eventId: string, data: FirebaseFirestore.DocumentData): WebhookClaim {
  const claim: WebhookClaim = {
    eventId: typeof data.eventId === 'string' ? data.eventId : eventId,
    eventType: typeof data.eventType === 'string' ? data.eventType : '',
    merchantId: typeof data.merchantId === 'string' ? data.merchantId : '',
    status: data.status as ClaimStatus,
    phase: typeof data.phase === 'string' ? data.phase : INITIAL_PHASE,
    payload: (data.payload ?? {}) as Record<string, unknown>,
    leaseExpiresAt: data.leaseExpiresAt as Timestamp,
    leaseGeneration: typeof data.leaseGeneration === 'number' ? data.leaseGeneration : 0,
    attemptCount: typeof data.attemptCount === 'number' ? data.attemptCount : 0,
    createdAt: data.createdAt as Timestamp,
    expiresAt: data.expiresAt as Timestamp,
  };
  if (typeof data.businessId === 'string') claim.businessId = data.businessId;
  if (typeof data.result === 'number') claim.result = data.result;
  return claim;
}

/**
 * When the lease lapses, per the **stored** field (never per TTL).
 *
 * A `claimed` claim with no readable `leaseExpiresAt` is treated as **expired** rather than
 * live: a missing lease must not wedge the event forever, and stealing it is safe because
 * `leaseGeneration` still fences whoever wrote it.
 */
function leaseExpiryMillis(data: FirebaseFirestore.DocumentData, eventId: string): number {
  const ms = toMillisOrUndefined(data.leaseExpiresAt);
  if (ms === undefined) {
    // eslint-disable-next-line no-console
    console.warn(
      `[WebhookClaim] webhookClaims/${eventId} has no readable leaseExpiresAt; treating the lease as expired`,
    );
    return 0;
  }
  return ms;
}

/** The `done` branch: replay the cached status, falling back to 200 — never to a skip. */
function doneResult(data: FirebaseFirestore.DocumentData, eventId: string): AcquireResult {
  if (typeof data.result === 'number') return { outcome: 'done', result: data.result };
  // eslint-disable-next-line no-console
  console.warn(
    `[WebhookClaim] webhookClaims/${eventId} is done with no cached result; replaying 200`,
  );
  return { outcome: 'done', result: 200 };
}

/**
 * Writes the legacy `EventNotification` RTDB node for an `acquired` or `resumed` claim
 * (req 6). Idempotent: `EventNotification.init()`'s RTDB `transaction()` aborts and sets
 * `isNew = false` when the node already exists, which is why running it on `resumed` as well
 * is safe.
 *
 * Gated on {@link isDualWriteLegacyNotification} **only** — `acquireClaim` deliberately does
 * **not** read the `useClaimLease` feature flag. Being called *is* the flag decision, already
 * made by the consumer; re-reading the flag here would add a Firestore read to the hot path
 * and let the primitive behave differently for a reason invisible at the call site.
 *
 * Two behaviours worth stating:
 *
 * - **`businessId` absent ⇒ skip and warn.** The legacy key is `${businessId}_${Id}`, so
 *   writing it without a tenant would create an `undefined_<eventId>` node that a
 *   rolled-back handler never looks up (rollback resolves `businessId` first, then keys on
 *   it) — the mirror image of the `${businessId}_undefined` garbage class the contract calls
 *   out. **Consequence: a claim taken before tenant resolution is not rollback-protected**,
 *   so handler migrations that care about the rollback window should claim *after* resolving
 *   the tenant.
 * - **RTDB failures are caught, warned and swallowed.** The claim is the source of truth and
 *   the legacy node is only rollback insurance; failing the claim because the insurance
 *   failed would create losses in the name of preventing them.
 */
async function dualWriteLegacyNotification(claim: WebhookClaim): Promise<void> {
  if (!isDualWriteLegacyNotification) return;
  if (!claim.businessId) {
    // eslint-disable-next-line no-console
    console.warn(
      `[WebhookClaim] no businessId on event ${claim.eventId}; skipping the legacy RTDB `
      + 'dual-write (an "undefined_" key would never be read back). This claim is not '
      + 'rollback-protected.',
    );
    return;
  }
  try {
    const notification = new EventNotification(
      claim.businessId,
      Constants.Provider.square,
      claim.eventType,
      claim.eventId,
    );
    await notification.init();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[WebhookClaim] legacy RTDB dual-write failed for event ${claim.eventId}; `
      + 'the claim stands (the legacy node is rollback insurance, not the source of truth)',
      err,
    );
  }
}

/** `absent` is internal: the claim vanished mid-operation, so the create is retried. */
type ExistingClaimBranch = AcquireResult | { outcome: 'absent' };

/**
 * Steal an expired lease inside a transaction. The **transaction** — not `create()` — is what
 * makes reclaim mutually exclusive between two racing workers: both read the same generation,
 * only one commits, the loser retries and sees a live lease.
 *
 * Bumps `leaseGeneration` and `attemptCount` and refreshes `leaseExpiresAt`, and touches
 * nothing else: `phase` is the recovery point, `payload` is the durable record, and
 * `createdAt`/`expiresAt` must not slide or a repeatedly stolen claim would never expire.
 */
async function reclaimExpiredLease(
  ref: DocumentReference,
  eventId: string,
  now: Timestamp,
  leaseMs: number,
): Promise<ExistingClaimBranch> {
  return getFirestore().runTransaction(async (tx): Promise<ExistingClaimBranch> => {
    const snapshot = await tx.get(ref);
    const data = snapshot.data();
    if (!data) return { outcome: 'absent' };

    if (data.status === 'done') return doneResult(data, eventId);
    if (data.status === 'failed') return { outcome: 'failed' };
    if (data.status !== 'claimed') return { outcome: 'inFlight' };
    // Another worker refreshed or stole the lease between our read and this transaction.
    if (leaseExpiryMillis(data, eventId) > now.toMillis()) return { outcome: 'inFlight' };

    const leaseGeneration = (typeof data.leaseGeneration === 'number' ? data.leaseGeneration : 0) + 1;
    const attemptCount = (typeof data.attemptCount === 'number' ? data.attemptCount : 0) + 1;
    const leaseExpiresAt = Timestamp.fromMillis(now.toMillis() + leaseMs);

    tx.update(ref, { leaseGeneration, attemptCount, leaseExpiresAt });

    return {
      outcome: 'resumed',
      claim: {
        ...hydrateClaim(eventId, data),
        leaseGeneration,
        attemptCount,
        leaseExpiresAt,
      },
    };
  });
}

/** Read an existing claim and resolve it to a branch of the acquire table. */
async function resolveExistingClaim(
  ref: DocumentReference,
  eventId: string,
  now: Timestamp,
  leaseMs: number,
): Promise<ExistingClaimBranch> {
  const snapshot = await ref.get();
  const data = snapshot.data();
  if (!data) return { outcome: 'absent' };

  if (data.status === 'done') return doneResult(data, eventId);
  if (data.status === 'failed') return { outcome: 'failed' };
  // An unrecognised status is a *retryable* unknown, never a drop.
  if (data.status !== 'claimed') return { outcome: 'inFlight' };
  // A live lease: another worker owns this delivery. No write, and the caller returns 429.
  if (leaseExpiryMillis(data, eventId) > now.toMillis()) return { outcome: 'inFlight' };

  return reclaimExpiredLease(ref, eventId, now, leaseMs);
}

/**
 * Claim a Square webhook delivery, or report who already owns it.
 *
 * The happy path is **one** Firestore RPC — `create()` with a server-evaluated
 * `exists: false` precondition — and deliberately **no transaction and no read-then-write**:
 * a read-then-write would reopen the TOCTOU window in which two deliveries both decide the
 * claim is free. A transaction appears only on the reclaim path, where mutual exclusion has
 * to be established between two workers stealing the same expired lease.
 *
 * ## Timestamps
 *
 * One client instant per call — `Timestamp.now()` — derives `createdAt`, `leaseExpiresAt` and
 * `expiresAt`, so the three are mutually consistent by construction.
 *
 * `FieldValue.serverTimestamp()` is **unusable** here: it is a write-time sentinel that
 * cannot be read back inside the same write, so `createdAt + 60 s` and `createdAt + 72 h`
 * cannot be derived from it. (`SemaphoreV2` hits the same wall and mixes a sentinel `updated`
 * with a client-computed `expiresAt`.)
 *
 * The tradeoff, stated plainly: lease comparisons are then between one machine's clock and
 * another's. Cloud Run and Cloud Functions clocks are NTP-synced to milliseconds against a
 * 60 s lease, and — the load-bearing point — **clock skew degrades liveness, not safety.** A
 * mis-timed expiry only causes an *early steal*, and the worker stolen from is still rejected
 * by `leaseGeneration` fencing. The fence, not the clock, is the correctness mechanism.
 *
 * @throws {@link InvalidEventIdError} if `eventId` is missing, empty or not UUID-shaped.
 * @throws ValidationError if `payload` is not an object.
 * @throws {@link EventTooOldError} if the event is older than {@link MAX_EVENT_AGE_MS}.
 * @throws Error — any non-`ALREADY_EXISTS` Firestore error, rethrown unchanged.
 *
 * **Precondition:** Firestore must not be using REST transport — see the file header on
 * `preferRest` / `FIRESTORE_PREFER_REST`.
 */
export async function acquireClaim(input: AcquireClaimInput): Promise<AcquireResult> {
  assertValidEventId(input.eventId);
  requirePayloadObject(input.payload);

  const { eventId } = input;
  const eventType = metadataOrEmpty('eventType', input.eventType, eventId);
  const merchantId = metadataOrEmpty('merchantId', input.merchantId, eventId);

  const now = Timestamp.now();
  assertEventNotTooOld(eventId, input.eventCreatedAt, now);

  const leaseMs = input.leaseMs ?? DEFAULT_LEASE_MS;
  const claim: WebhookClaim = {
    eventId,
    eventType,
    merchantId,
    status: 'claimed',
    phase: INITIAL_PHASE,
    payload: input.payload,
    leaseExpiresAt: Timestamp.fromMillis(now.toMillis() + leaseMs),
    leaseGeneration: 1,
    attemptCount: 1,
    createdAt: now,
    expiresAt: Timestamp.fromMillis(now.toMillis() + CLAIM_TTL_MS),
  };
  // Omitted, never written as `undefined` — Firestore rejects undefined values outright.
  if (input.businessId !== undefined) claim.businessId = input.businessId;
  // `result` is absent until completeClaim caches the handler's HTTP status.
  const data: FirebaseFirestore.DocumentData = { ...claim };

  const ref = claimRef(eventId);

  // Two iterations at most: the claim can only vanish under us (TTL or the sweeper) once
  // before this is a bug rather than a race.
  const maxCreateAttempts = 2;
  for (let attempt = 1; attempt <= maxCreateAttempts; attempt += 1) {
    let isCreated = false;
    try {
      // eslint-disable-next-line no-await-in-loop
      await ref.create(data);
      isCreated = true;
    } catch (err) {
      if (!isAlreadyExistsError(err)) throw err;
    }

    if (isCreated) {
      // eslint-disable-next-line no-await-in-loop
      await dualWriteLegacyNotification(claim);
      return { outcome: 'acquired', claim };
    }

    // eslint-disable-next-line no-await-in-loop
    const branch = await resolveExistingClaim(ref, eventId, now, leaseMs);
    if (branch.outcome === 'resumed') {
      // eslint-disable-next-line no-await-in-loop
      await dualWriteLegacyNotification(branch.claim);
      return branch;
    }
    if (branch.outcome !== 'absent') return branch;
  }

  throw new Error(
    `webhookClaims/${eventId}: create() reported ALREADY_EXISTS but the claim was absent on `
    + `read, ${maxCreateAttempts} times running`,
  );
}

/**
 * Assert the fence, or throw. Returns the claim so callers need not re-read it.
 *
 * Missing document is a fence failure too (`actualGeneration: undefined`): if the claim is
 * gone, the caller's authority to write on its behalf is gone with it.
 */
function assertFence(
  eventId: string,
  expectedGeneration: number,
  snapshot: DocumentSnapshot,
): WebhookClaim {
  const data = snapshot.data();
  if (!data) throw new StaleLeaseError(eventId, expectedGeneration, undefined);
  const actual = typeof data.leaseGeneration === 'number' ? data.leaseGeneration : undefined;
  if (actual !== expectedGeneration) {
    throw new StaleLeaseError(eventId, expectedGeneration, actual);
  }
  return hydrateClaim(eventId, data);
}

/**
 * Run a fenced update: read the claim, assert `leaseGeneration`, and only then queue the
 * write. The throw happens **before** anything is queued on the transaction, so "a fenced-out
 * worker writes nothing" is structural rather than incidental.
 */
async function fencedUpdate(
  eventId: string,
  expectedGeneration: number,
  buildUpdate: (claim: WebhookClaim, now: Timestamp) => FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>,
): Promise<void> {
  const ref = claimRef(eventId);
  await getFirestore().runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const claim = assertFence(eventId, expectedGeneration, snapshot);
    tx.update(ref, buildUpdate(claim, Timestamp.now()));
  });
}

/**
 * Record progress: set `phase` **and renew the lease**.
 *
 * Progress *is* the heartbeat (mirroring `SemaphoreV2.updateHeartbeat`), so a handler that
 * keeps advancing keeps its lease and is never stolen from mid-flight, while one that stops
 * advancing lapses and is reclaimed from its last recovery point.
 *
 * It deliberately does **not** bump `leaseGeneration`: the generation is a fencing token, and
 * it advances only on a *steal*. Bumping it on progress would invalidate the holder's own
 * token and make every subsequent fenced write fail.
 *
 * @throws {@link StaleLeaseError} if the claim was stolen or is gone — nothing is written.
 */
export async function advancePhase(
  eventId: string,
  expectedGeneration: number,
  phase: string,
  leaseMs: number = DEFAULT_LEASE_MS,
): Promise<void> {
  await fencedUpdate(eventId, expectedGeneration, (_claim, now) => ({
    phase,
    leaseExpiresAt: Timestamp.fromMillis(now.toMillis() + leaseMs),
  }));
}

/**
 * Terminal success: `status: 'done'` plus the HTTP status to replay to duplicate deliveries.
 *
 * `phase` is left alone as the last recovery point, which is what makes a `done` claim
 * readable as a record of *what* happened rather than only *that* it happened.
 *
 * @throws {@link StaleLeaseError} if the claim was stolen or is gone — nothing is written.
 */
export async function completeClaim(
  eventId: string,
  expectedGeneration: number,
  result: number,
): Promise<void> {
  await fencedUpdate(eventId, expectedGeneration, () => ({ status: 'done', result }));
}

/**
 * Give the claim up without finishing it: **expire the lease in place** and change nothing
 * else. Use it when a handler bails out in a way that should be retried immediately (a
 * graceful shutdown, a dependency that is momentarily down).
 *
 * It does **not delete the document**, deliberately. Deleting would destroy `payload` — the
 * only durable replay source — and reset `phase` and `attemptCount`, losing both the recovery
 * point and the poison-message bound. Leaving `status: 'claimed'` with a lapsed lease means
 * the very next delivery sees an expired lease and gets `resumed` **immediately**: the retry
 * is instant, not lease-delayed.
 *
 * @throws {@link StaleLeaseError} if the claim was stolen or is gone — nothing is written.
 */
export async function releaseClaim(eventId: string, expectedGeneration: number): Promise<void> {
  await fencedUpdate(eventId, expectedGeneration, (_claim, now) => ({ leaseExpiresAt: now }));
}

/**
 * Assert the fence **inside the caller's own transaction**, so a handler can commit its
 * Firestore effects atomically with the claim check.
 *
 * Two things this buys that an out-of-band check cannot:
 *
 * 1. Reading the claim inside the caller's transaction **enrols it in the transaction's read
 *    set**, so if another worker bumps `leaseGeneration` concurrently, Firestore aborts the
 *    caller's whole commit. The fence is enforced by the database, not by a racing `if`.
 * 2. The effects and the claim state move together — the contract's "committed in the same
 *    transaction as the effects wherever the effects are Firestore-only".
 *
 * **Ordering requirement — `await withClaimFence(tx, …)` before any `tx.set`/`tx.update`/
 * `tx.delete` in that transaction.** Firestore requires all reads to precede all writes; a
 * fence attempted after a write throws a transport error instead of fencing.
 *
 * **Divergence from the issue's sketch: this is `Promise<void>`, not `void`.** A synchronous
 * fence is not implementable — Firestore offers no synchronous precondition on a *field
 * value* (only `lastUpdateTime`, which the caller does not hold), so the generation has to be
 * read.
 *
 * @throws {@link StaleLeaseError} if the claim was stolen or is gone — before the caller
 * writes anything.
 */
export async function withClaimFence(
  tx: Transaction,
  eventId: string,
  expectedGeneration: number,
): Promise<void> {
  const snapshot = await tx.get(claimRef(eventId));
  assertFence(eventId, expectedGeneration, snapshot);
}

/**
 * Queue the terminal `done` write on the **caller's** transaction, so the claim completes in
 * the same commit as the handler's Firestore effects.
 *
 * Write-only and synchronous: it **assumes {@link withClaimFence} has already run in this
 * same `tx`**, which is what makes the write safe (that call both verified the generation and
 * enrolled the claim in the read set, so a concurrent steal aborts this commit). Calling it
 * without the fence is a bug — the write would land unfenced.
 *
 * It exists so consumers never have to know the claim's collection path to commit atomically.
 * There is deliberately no `advancePhaseIn`/`releaseClaimIn` until a consumer needs one.
 *
 * @throws {@link StaleLeaseError} if `expectedGeneration` is not a plausible generation, which
 * can only mean {@link withClaimFence} was not the source of it.
 */
export function completeClaimIn(
  tx: Transaction,
  eventId: string,
  expectedGeneration: number,
  result: number,
): void {
  if (!Number.isInteger(expectedGeneration) || expectedGeneration < 0) {
    throw new StaleLeaseError(eventId, expectedGeneration, undefined);
  }
  tx.update(claimRef(eventId), { status: 'done', result });
}
