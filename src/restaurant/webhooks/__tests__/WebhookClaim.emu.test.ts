/**
 * Firestore-emulator tests for the P42 claim primitive (rcc#166, epic sgc#281).
 *
 * ## Why these exist alongside the mocked unit suite
 *
 * `WebhookClaim.test.ts` drives a hand-rolled Firestore double, which is the right tool for
 * branch coverage but is *structurally incapable* of proving the two properties the primitive
 * exists for:
 *
 * - A mock's `create()` returns canned success to **every** caller, so a real `ALREADY_EXISTS`
 *   precondition failure — the server-evaluated `exists: false` check that is the whole
 *   mutual-exclusion mechanism — never happens.
 * - A mock's `runTransaction()` just runs the callback, so a real **transaction abort under
 *   contention** never happens, and "only one worker can steal an expired lease" is asserted
 *   by construction rather than observed.
 *
 * Everything here therefore fires the racing calls with `Promise.all` — never serialized —
 * against a real Firestore, and asserts on the document Firestore actually holds afterwards.
 *
 * ## Lease expiry: real clock, never fake timers
 *
 * The expiry comparison in `resolveExistingClaim` is `stored Timestamp` vs `Timestamp.now()`,
 * and the stored value is produced by the *first* call and round-tripped through the emulator.
 * `vi.useFakeTimers()` would move only this process's clock while the stored Timestamp stays
 * where it was, and — worse — it would stub the timers the Firestore gRPC client itself uses.
 * So expiry here is produced the honest way: acquire with a **1 ms `leaseMs`** (the input
 * supports `leaseMs`) and then `await sleep(...)` on the real clock before racing the reclaim.
 *
 * ## Guard
 *
 * `describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)` — `firebase emulators:exec` injects
 * that variable. A run reporting these as *skipped* means it never reached the test process,
 * and proves nothing; see `vitest.emulator.config.ts`.
 *
 * Run: `firebase emulators:exec --only firestore --project demo-p42 "npm run test:emulator"`
 */

import { randomUUID } from 'crypto';
import {
  afterAll, afterEach, beforeAll, describe, expect, it,
} from 'vitest';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { PathResolver } from '../../../persistence/firestore/PathResolver';
import {
  acquireClaim,
  completeClaim,
  DEFAULT_LEASE_MS,
  INITIAL_PHASE,
  StaleLeaseError,
  type AcquireClaimInput,
  type AcquireResult,
} from '../WebhookClaim';

const isEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;

/**
 * The emulator project id. `demo-`-prefixed ids are the documented "never talks to a real
 * backend" convention, so a missing `FIRESTORE_EMULATOR_HOST` cannot silently write to GCP.
 */
const PROJECT_ID = 'demo-p42';

/** Real-clock sleep — see the header on why fake timers are unusable here. */
const sleep = (ms: number) => new Promise((resolve) => { setTimeout(resolve, ms); });

/**
 * Base input. `businessId` is deliberately **omitted**: without it `acquireClaim` skips the
 * legacy RTDB dual-write (with a warning), which keeps these tests to Firestore only — no
 * Realtime Database emulator, and no chance of a stray write to a real RTDB instance.
 */
function input(eventId: string, overrides: Partial<AcquireClaimInput> = {}): AcquireClaimInput {
  return {
    eventId,
    eventType: 'order.updated',
    merchantId: 'MLEMULATOR1',
    payload: { event_id: eventId, type: 'order.updated' },
    eventCreatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/** Sort outcomes so an assertion is order-independent — the race decides who wins. */
function outcomesOf(results: AcquireResult[]): string[] {
  return results.map((r) => r.outcome).sort();
}

/** Deep-sort object keys so two structures can be compared as canonical JSON strings. */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = canonicalize((value as Record<string, unknown>)[key]);
      return acc;
    }, {});
  }
  return value;
}

const canonicalJson = (value: unknown) => JSON.stringify(canonicalize(value));

/** Read the stored claim document, failing loudly (rather than with `!`) if it is absent. */
async function readClaimData(eventId: string): Promise<FirebaseFirestore.DocumentData> {
  const data = (await PathResolver.webhookClaimsCollection().doc(eventId).get()).data();
  if (!data) throw new Error(`expected webhookClaims/${eventId} to exist`);
  return data;
}

describe.skipIf(!isEmulator)('WebhookClaim against the Firestore emulator', () => {
  beforeAll(() => {
    // No `setupFiles` in this repo, so app init lives in the test file.
    if (getApps().length === 0) initializeApp({ projectId: PROJECT_ID });
  });

  afterEach(async () => {
    // Claim ids are fresh per test, but leaving documents behind would let a future test's
    // assumptions leak across scenarios (and the sweeper tests in cf#82 will share this
    // collection).
    const refs = await PathResolver.webhookClaimsCollection().listDocuments();
    await Promise.all(refs.map((ref) => ref.delete()));
  });

  afterAll(async () => {
    await getFirestore().terminate();
  });

  it('two concurrent acquireClaim calls for the same eventId yield exactly one "acquired" and one "inFlight"', async () => {
    const eventId = randomUUID();

    // Fired together on purpose: serializing them would test nothing a mock cannot fake.
    const results = await Promise.all([
      acquireClaim(input(eventId)),
      acquireClaim(input(eventId)),
    ]);

    expect(outcomesOf(results)).toEqual(['acquired', 'inFlight']);

    // Exactly one document, written by the winner, with generation 1 and a single attempt —
    // the loser's ALREADY_EXISTS path must not have written anything.
    const data = await readClaimData(eventId);
    expect(data.status).toBe('claimed');
    expect(data.leaseGeneration).toBe(1);
    expect(data.attemptCount).toBe(1);
    expect(data.phase).toBe(INITIAL_PHASE);
  });

  it('an expired lease reclaimed by a second worker makes the first worker\'s completeClaim throw StaleLeaseError, and the doc keeps the second worker\'s generation', async () => {
    const eventId = randomUUID();

    // Worker 1 takes a 1 ms lease, then stalls (the zombie).
    const first = await acquireClaim(input(eventId, { leaseMs: 1 }));
    expect(first.outcome).toBe('acquired');
    const firstGeneration = first.outcome === 'acquired' ? first.claim.leaseGeneration : -1;
    expect(firstGeneration).toBe(1);

    // Real-clock wait so the *stored* leaseExpiresAt is genuinely in the past.
    await sleep(50);

    // Worker 2 steals it.
    const second = await acquireClaim(input(eventId));
    expect(second.outcome).toBe('resumed');
    const secondGeneration = second.outcome === 'resumed' ? second.claim.leaseGeneration : -1;
    expect(secondGeneration).toBe(2);

    // Worker 1 wakes up and tries to finish. The fence — not the lease — is what stops it.
    await expect(completeClaim(eventId, firstGeneration, 200)).rejects.toBeInstanceOf(StaleLeaseError);

    // And it wrote nothing: still claimed, still generation 2, no cached result.
    const data = await readClaimData(eventId);
    expect(data.leaseGeneration).toBe(2);
    expect(data.status).toBe('claimed');
    expect(data.result).toBeUndefined();

    // Worker 2, holding the current generation, can complete.
    await completeClaim(eventId, secondGeneration, 200);
    const completed = await readClaimData(eventId);
    expect(completed.status).toBe('done');
    expect(completed.result).toBe(200);
    expect(completed.leaseGeneration).toBe(2);
  });

  it('two concurrent reclaims of one expired lease yield exactly one "resumed" and leaseGeneration advances by exactly 1', async () => {
    const eventId = randomUUID();

    const first = await acquireClaim(input(eventId, { leaseMs: 1 }));
    expect(first.outcome).toBe('acquired');
    await sleep(50);

    // Both workers see the same expired lease and both open a reclaim transaction. Only one
    // commit can win; the loser retries, re-reads the refreshed lease and degrades to
    // inFlight (→ 429). This is the transaction abort a mock cannot produce.
    const results = await Promise.all([
      acquireClaim(input(eventId)),
      acquireClaim(input(eventId)),
    ]);

    expect(outcomesOf(results)).toEqual(['inFlight', 'resumed']);

    const data = await readClaimData(eventId);
    // Exactly one steal happened: +1, not +2. A lost-update would show 2 here as well, so
    // attemptCount is asserted too — it moves in lockstep and only on a steal.
    expect(data.leaseGeneration).toBe(2);
    expect(data.attemptCount).toBe(2);
    // The steal preserves the recovery point and never slides the TTL.
    expect(data.phase).toBe(INITIAL_PHASE);
    expect(data.createdAt.toMillis()).toBe(first.outcome === 'acquired' ? first.claim.createdAt.toMillis() : -1);
    expect(data.expiresAt.toMillis()).toBe(first.outcome === 'acquired' ? first.claim.expiresAt.toMillis() : -1);
    // The winner's lease is live again.
    expect(data.leaseExpiresAt.toMillis()).toBeGreaterThan(Date.now());
    expect(data.leaseExpiresAt.toMillis()).toBeLessThanOrEqual(Date.now() + DEFAULT_LEASE_MS);
  });

  it('payload round-trips through Firestore: read-back deep-equals the original', async () => {
    const eventId = randomUUID();

    // Wide fixture: nested objects, arrays of objects, arrays nested inside those objects,
    // null, empty map, empty array, unicode, booleans, negative and fractional numbers, and a
    // long string. Keys are written in deliberately non-alphabetical order because Firestore
    // stores map keys sorted — which is exactly why byte equality is not asserted below.
    const payload: Record<string, unknown> = {
      zeta: 'written first, sorts last',
      merchant_id: 'MLEMULATOR1',
      type: 'order.updated',
      event_id: eventId,
      created_at: '2026-08-16T12:34:56.789Z',
      data: {
        type: 'order',
        id: 'order-abc',
        object: {
          order_updated: {
            order_id: 'order-abc',
            version: 3,
            state: 'OPEN',
            location_id: 'LOC1',
            line_item_ids: ['li-1', 'li-2'],
          },
        },
      },
      alpha: 'written late, sorts early',
      nullValue: null,
      emptyObject: {},
      emptyArray: [],
      unicode: 'café ☕ 日本語 🍜 — em-dash, “curly quotes”, ñ',
      isTrue: true,
      isFalse: false,
      negativeInt: -42,
      fractional: -0.5,
      zero: 0,
      longString: 'x'.repeat(2_000),
      arrayOfObjects: [
        { position: 1, name: 'first' },
        { position: 2, nested: { tags: ['a', 'b'], flag: false } },
      ],
      mixedScalarArray: [1, 'two', true, null],
    };

    const result = await acquireClaim(input(eventId, { payload }));
    expect(result.outcome).toBe('acquired');

    const stored = await readClaimData(eventId);
    const readBack = stored.payload as Record<string, unknown>;

    // 1. Structural fidelity.
    expect(readBack).toEqual(payload);

    // 2. Canonical-JSON fidelity — deep-sort keys on both sides, then compare strings. This
    //    catches type drift that `toEqual` would tolerate loosely, without asserting the false
    //    claim that raw `JSON.stringify` output survives (Firestore sorts map keys, so
    //    byte/insertion-order equality is *not* a property of this system and is deliberately
    //    not asserted).
    expect(canonicalJson(readBack)).toBe(canonicalJson(payload));

    // 3. The practical acceptance criterion: re-serialized as a Cloud Task body (cf#83), the
    //    read-back payload still presents the same Square notification fields.
    const replayBody = JSON.parse(JSON.stringify(readBack)) as Record<string, unknown>;
    expect(replayBody.event_id).toBe(payload.event_id);
    expect(replayBody.type).toBe(payload.type);
    expect(replayBody.merchant_id).toBe(payload.merchant_id);
    expect(replayBody.data).toEqual(payload.data);
  });

  it('a payload containing a nested array is rejected by Firestore — documented limitation, surfaced not swallowed', async () => {
    const eventId = randomUUID();

    // Firestore has no representation for an array whose element is itself an array. The
    // primitive does not sanitize it: a claim whose payload is not the payload would be worse
    // than a loud failure, since the payload is the only durable replay source.
    //
    // Where the rejection comes from, measured rather than assumed: the admin SDK does **not**
    // reject this client-side. `create()` sends the write and the *server* refuses it with
    // gRPC `INVALID_ARGUMENT` (3) — observed message:
    //   "3 INVALID_ARGUMENT: Property payload contains an invalid nested entity."
    // Both alternatives are matched because the SDK has historically raised its own
    // "Nested arrays are not supported" for the same input, and either wording is correct
    // behaviour for this test's purpose.
    const error = await acquireClaim(input(eventId, { payload: { nested: [[1, 2]] } }))
      .then(() => undefined, (err: unknown) => err);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message)
      .toMatch(/invalid nested entity|nested arrays are not supported/i);
    // Rethrown unchanged, never misclassified as ALREADY_EXISTS (6) — that would degrade a hard
    // write failure into an inFlight/done outcome and answer Square as if the delivery had been
    // handled. INVALID_ARGUMENT is 3, and the message must not trip the `/already exists/i`
    // fallback in `isAlreadyExistsError`.
    expect((error as { code?: unknown }).code).not.toBe(6);
    expect((error as Error).message).not.toMatch(/already exists/i);

    // And nothing was persisted.
    const snapshot = await PathResolver.webhookClaimsCollection().doc(eventId).get();
    expect(snapshot.exists).toBe(false);
  });
});
