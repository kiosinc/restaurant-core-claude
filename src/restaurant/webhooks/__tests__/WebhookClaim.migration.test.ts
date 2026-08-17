/**
 * Field Migration Table (rcc#165) — one **named** test per table row.
 *
 * Every test name is prefixed with the table's tag, so the row-to-test mapping can be audited
 * mechanically:
 *
 * ```
 * grep -o '\[[a-z-]*\]' src/restaurant/webhooks/__tests__/WebhookClaim.migration.test.ts
 * ```
 *
 * The migration is from the legacy RTDB gate
 * (`/private/notifications/{businessId}_{eventId}`, written by
 * `restaurant/connected-accounts/EventNotification`) to the Firestore claim
 * (`webhookClaims/{eventId}`).
 */
import {
  describe, it, expect, vi, beforeEach, afterEach,
} from 'vitest';

const fx = vi.hoisted(() => {
  const transaction = { get: vi.fn(), set: vi.fn(), update: vi.fn() };
  const docRef = {
    id: '', path: '', create: vi.fn(), get: vi.fn(),
  };
  const collectionRef = {
    doc: vi.fn((id: string) => {
      docRef.id = id;
      docRef.path = `webhookClaims/${id}`;
      return docRef;
    }),
  };
  const db = { runTransaction: vi.fn() };
  return {
    transaction, docRef, collectionRef, db,
  };
});

const legacy = vi.hoisted(() => ({ ctor: vi.fn(), init: vi.fn() }));

vi.mock('firebase-admin/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase-admin/firestore')>();
  return { ...actual, getFirestore: () => fx.db };
});

vi.mock('../../../persistence/firestore/PathResolver', () => ({
  PathResolver: { webhookClaimsCollection: vi.fn(() => fx.collectionRef) },
}));

vi.mock('../../connected-accounts/EventNotification', () => ({
  default: class {
    constructor(...args: unknown[]) {
      legacy.ctor(...args);
    }

    init(...args: unknown[]) {
      return legacy.init(...args);
    }
  },
}));

import { Timestamp } from 'firebase-admin/firestore';
import { acquireClaim, CLAIM_TTL_MS, DEFAULT_LEASE_MS } from '../WebhookClaim';
import type { AcquireClaimInput } from '../WebhookClaim';
import { PathResolver } from '../../../persistence/firestore/PathResolver';
import { CollectionNames } from '../../../firestore-core/Paths';

const EVENT_ID = '0d1c1b2a-3f4e-5d6c-7b8a-9e0f1a2b3c4d';
const BUSINESS_ID = 'biz-1';
const NOW_ISO = '2026-08-16T12:00:10.000Z';
const NOW_MS = Date.parse(NOW_ISO);

/** The complete field set the contract specifies for a claim taken with a known tenant. */
const CONTRACT_FIELDS = [
  'attemptCount',
  'businessId',
  'createdAt',
  'eventId',
  'eventType',
  'expiresAt',
  'leaseExpiresAt',
  'leaseGeneration',
  'merchantId',
  'payload',
  'phase',
  'status',
];

function baseInput(overrides: Partial<AcquireClaimInput> = {}): AcquireClaimInput {
  return {
    eventId: EVENT_ID,
    eventType: 'order.updated',
    merchantId: 'MLKC3F9RCXNPP',
    payload: { event_id: EVENT_ID, type: 'order.updated' },
    eventCreatedAt: '2026-08-16T12:00:00.000Z',
    businessId: BUSINESS_ID,
    ...overrides,
  };
}

function snapshot(data: Record<string, unknown> | undefined) {
  return { exists: data !== undefined, data: () => data };
}

async function acquireAndCaptureDocument(): Promise<Record<string, unknown>> {
  const result = await acquireClaim(baseInput());
  expect(result.outcome).toBe('acquired');
  return fx.docRef.create.mock.calls[0][0] as Record<string, unknown>;
}

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW_ISO));
  warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

  fx.docRef.create.mockReset();
  fx.docRef.get.mockReset();
  fx.transaction.get.mockReset();
  fx.db.runTransaction.mockReset();
  fx.collectionRef.doc.mockImplementation((id: string) => {
    fx.docRef.id = id;
    fx.docRef.path = `webhookClaims/${id}`;
    return fx.docRef;
  });
  fx.docRef.create.mockResolvedValue({});
  fx.docRef.get.mockResolvedValue(snapshot(undefined));
  fx.db.runTransaction.mockImplementation(
    async (fn: (t: unknown) => Promise<unknown>) => fn(fx.transaction),
  );
  legacy.init.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  warn.mockRestore();
});

describe('Field Migration Table (rcc#165)', () => {
  it('[endpoint-level] /private/notifications/{bid}_{eventId} → webhookClaims/{eventId}: top-level collection, doc id is the verbatim event_id', async () => {
    await acquireAndCaptureDocument();

    // Top-level collection: no businesses/{businessId} ancestry, no tenant prefix in the id.
    expect(CollectionNames.webhookClaims).toBe('webhookClaims');
    expect(PathResolver.webhookClaimsCollection).toHaveBeenCalledWith();
    expect(fx.collectionRef.doc).toHaveBeenCalledWith(EVENT_ID);
    expect(fx.docRef.path).toBe(`webhookClaims/${EVENT_ID}`);
    expect(fx.docRef.id).toBe(EVENT_ID);
    // The legacy key composed the tenant into the id; the claim id does not.
    expect(fx.docRef.id).not.toContain(`${BUSINESS_ID}_`);
    expect(fx.docRef.path).not.toContain('/private/notifications/');
    expect(fx.docRef.path).not.toContain('businesses/');
  });

  it('[removed] provider: the claim document has no provider field', async () => {
    const document = await acquireAndCaptureDocument();

    // The claim is Square-only by construction, so a discriminator buys nothing.
    expect(document).not.toHaveProperty('provider');
    expect(Object.keys(document)).not.toContain('provider');
  });

  it('[renamed] type → eventType: the claim stores eventType and no type field', async () => {
    const document = await acquireAndCaptureDocument();

    expect(document.eventType).toBe('order.updated');
    expect(document).not.toHaveProperty('type');
  });

  it('[type-changed] created (ISO string) → createdAt (Timestamp): createdAt is a Firestore Timestamp', async () => {
    const document = await acquireAndCaptureDocument();

    // A real Timestamp, not the repo's ISO-string convention: Firestore TTL policies only
    // accept a "Date and time" field, so `expiresAt` (derived from `createdAt`) must be one.
    expect(document.createdAt).toBeInstanceOf(Timestamp);
    expect(typeof document.createdAt).not.toBe('string');
    expect((document.createdAt as Timestamp).toMillis()).toBe(NOW_MS);
    expect(document).not.toHaveProperty('created');
    expect(document.expiresAt).toBeInstanceOf(Timestamp);
    expect(document.leaseExpiresAt).toBeInstanceOf(Timestamp);
  });

  it('[removed] meta: the claim document has no meta field', async () => {
    const document = await acquireAndCaptureDocument();

    // `payload` supersedes it: the whole verbatim body is stored, not a curated subset.
    expect(document).not.toHaveProperty('meta');
    expect(document.payload).toEqual({ event_id: EVENT_ID, type: 'order.updated' });
  });

  it('[added] status: replaces node-presence-as-boolean, "claimed" on acquire', async () => {
    const document = await acquireAndCaptureDocument();

    // The legacy gate could only say "seen before"; status distinguishes in-progress from
    // finished from human-owned.
    expect(document.status).toBe('claimed');
  });

  it('[added] phase, leaseExpiresAt, leaseGeneration, attemptCount, result, expiresAt: lease-machine initial values (result absent until completion)', async () => {
    const document = await acquireAndCaptureDocument();

    expect(document.phase).toBe('started');
    expect(document.leaseGeneration).toBe(1);
    expect(document.attemptCount).toBe(1);
    expect((document.leaseExpiresAt as Timestamp).toMillis()).toBe(NOW_MS + DEFAULT_LEASE_MS);
    expect((document.expiresAt as Timestamp).toMillis()).toBe(NOW_MS + CLAIM_TTL_MS);
    // `result` is written only by completeClaim, so a fresh claim must not carry it.
    expect(document).not.toHaveProperty('result');
  });

  it('[semantics-changed] isNew === false: a done claim replays its result and an in-flight claim returns inFlight (→429) — the old code skipped both', async () => {
    const alreadyExists = () => Object.assign(new Error('conflict'), { code: 6 });
    const stored = (overrides: Record<string, unknown>) => ({
      eventId: EVENT_ID,
      eventType: 'order.updated',
      merchantId: 'MLKC3F9RCXNPP',
      businessId: BUSINESS_ID,
      status: 'claimed',
      phase: 'started',
      payload: { event_id: EVENT_ID },
      leaseExpiresAt: Timestamp.fromMillis(NOW_MS + 30_000),
      leaseGeneration: 1,
      attemptCount: 1,
      createdAt: Timestamp.fromMillis(NOW_MS - 1_000),
      expiresAt: Timestamp.fromMillis(NOW_MS - 1_000 + CLAIM_TTL_MS),
      ...overrides,
    });

    // Legacy behaviour for both of these was `isNew === false` ⇒ silent skip + 200.
    fx.docRef.create.mockRejectedValue(alreadyExists());
    fx.docRef.get.mockResolvedValue(snapshot(stored({ status: 'done', result: 201 })));
    await expect(acquireClaim(baseInput())).resolves.toEqual({ outcome: 'done', result: 201 });

    vi.clearAllMocks();
    fx.collectionRef.doc.mockImplementation(() => fx.docRef);
    fx.docRef.create.mockRejectedValue(alreadyExists());
    fx.docRef.get.mockResolvedValue(snapshot(stored({})));
    await expect(acquireClaim(baseInput())).resolves.toEqual({ outcome: 'inFlight' });
  });

  it('[contract] the claim document field set is exactly the contract\'s', async () => {
    const document = await acquireAndCaptureDocument();

    // Key-set equality, so a silently added or removed field fails here.
    expect(Object.keys(document).sort()).toEqual(CONTRACT_FIELDS);

    // And with no resolved tenant, exactly the same set minus `businessId` — never a written
    // `undefined`, which Firestore rejects outright.
    vi.clearAllMocks();
    fx.collectionRef.doc.mockImplementation(() => fx.docRef);
    fx.docRef.create.mockResolvedValue({});
    const anonymous = baseInput();
    delete anonymous.businessId;
    await acquireClaim(anonymous);
    const withoutTenant = fx.docRef.create.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(withoutTenant).sort()).toEqual(
      CONTRACT_FIELDS.filter((field) => field !== 'businessId'),
    );
  });
});
