/**
 * Unit tests for the P42 `WebhookClaim` primitive (rcc#166, contract rcc#165).
 *
 * Mocking strategy (plan §3.1): hand-rolled local mocks, mirroring
 * `src/restaurant/vars/__tests__/SemaphoreV2.test.ts`. The shared
 * `domain/services/__tests__/helpers/mockFirestore.ts` is unusable here — it has no `create()`,
 * no `FieldValue` sentinel interpretation and shallow-merge-only semantics.
 *
 * The **real** `Timestamp` is kept (only `getFirestore` is replaced) because every lease and
 * TTL assertion in this file is arithmetic on it. Lease and 24 h boundaries are driven with
 * fake timers rather than by widening the API with a `nowMs` parameter.
 *
 * The plain fixtures (`baseInput`, `snapshot`, `storedClaim`, …) live in
 * `./helpers/claimFixtures`, shared with `WebhookClaim.migration.test.ts`. The `vi.hoisted`
 * double and the `vi.mock` blocks stay local on purpose: they run above imports.
 */
import {
  describe, it, expect, vi, beforeEach, afterEach,
} from 'vitest';

// --- mocks -------------------------------------------------------------------------------

const fx = vi.hoisted(() => {
  const transaction = {
    get: vi.fn(),
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const docRef = {
    id: '',
    path: '',
    create: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const collectionRef = {
    doc: vi.fn((id: string) => {
      docRef.id = id;
      docRef.path = `webhookClaims/${id}`;
      return docRef;
    }),
  };
  const db = {
    runTransaction: vi.fn(),
  };
  return {
    transaction, docRef, collectionRef, db,
  };
});

const legacy = vi.hoisted(() => ({
  ctor: vi.fn(),
  init: vi.fn(),
}));

/**
 * `writeLegacyEventNotification` is a real `WriteModelFlags` entry now, not a module constant,
 * so the dual-write-**off** branch is reached by controlling `getFlags` rather than by mocking a
 * one-symbol module. The service is mocked wholesale so the flag read never touches the
 * Firestore double — which has no `collection()` — and so the read-failure path can be driven.
 */
const flags = vi.hoisted(() => ({ getFlags: vi.fn() }));

vi.mock('firebase-admin/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase-admin/firestore')>();
  return { ...actual, getFirestore: () => fx.db };
});

vi.mock('../../../persistence/firestore/PathResolver', () => ({
  PathResolver: {
    webhookClaimsCollection: vi.fn(() => fx.collectionRef),
  },
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

vi.mock('../../../domain/services/FeatureFlagService', () => ({
  getFlags: flags.getFlags,
}));

import { Timestamp } from 'firebase-admin/firestore';
import type { Transaction } from 'firebase-admin/firestore';
import {
  acquireClaim,
  advancePhase,
  completeClaim,
  releaseClaim,
  failClaim,
  withClaimFence,
  completeClaimIn,
  matchAcquireResult,
  claimIdempotencyKey,
  InvalidEventIdError,
  StaleLeaseError,
  EventTooOldError,
  DEFAULT_LEASE_MS,
  CLAIM_TTL_MS,
  MAX_EVENT_AGE_MS,
  INITIAL_PHASE,
} from '../WebhookClaim';
import type { AcquireHandlers, AcquireResult, ClaimFence } from '../WebhookClaim';
import { ValidationError } from '../../../domain/validation';
import { PathResolver } from '../../../persistence/firestore/PathResolver';
import {
  EVENT_ID,
  BUSINESS_ID,
  MERCHANT_ID,
  NOW_ISO,
  NOW_MS,
  CREATED_ISO,
  baseInput,
  snapshot,
  storedClaim,
  alreadyExistsError,
  readWebhookClaimSource,
} from './helpers/claimFixtures';

// --- fixtures ----------------------------------------------------------------------------

function createArg(): Record<string, unknown> {
  return fx.docRef.create.mock.calls[0][0] as Record<string, unknown>;
}

function updateArg(): Record<string, unknown> {
  return fx.transaction.update.mock.calls[0][1] as Record<string, unknown>;
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
  fx.transaction.get.mockResolvedValue(snapshot(undefined));
  fx.db.runTransaction.mockImplementation(
    async (fn: (t: unknown) => Promise<unknown>) => fn(fx.transaction),
  );
  legacy.init.mockResolvedValue(undefined);
  // Default posture for the migration window: the gate is ON.
  flags.getFlags.mockResolvedValue({ writeLegacyEventNotification: true });
});

afterEach(() => {
  vi.useRealTimers();
  warn.mockRestore();
});

// --- acquireClaim: acquired --------------------------------------------------------------

describe('acquireClaim — acquired', () => {
  it('acquired: create() resolves → outcome "acquired", status "claimed", phase "started", leaseGeneration 1, attemptCount 1', async () => {
    const result = await acquireClaim(baseInput());

    expect(result.outcome).toBe('acquired');
    if (result.outcome !== 'acquired') throw new Error('unreachable');
    expect(result.claim.status).toBe('claimed');
    expect(result.claim.phase).toBe(INITIAL_PHASE);
    expect(result.claim.phase).toBe('started');
    expect(result.claim.leaseGeneration).toBe(1);
    expect(result.claim.attemptCount).toBe(1);
    expect(createArg().status).toBe('claimed');
    expect(createArg().phase).toBe('started');
    expect(createArg().leaseGeneration).toBe(1);
    expect(createArg().attemptCount).toBe(1);
  });

  it('acquired: createdAt, leaseExpiresAt (+60s) and expiresAt (+72h) all derive from one instant', async () => {
    await acquireClaim(baseInput());

    const data = createArg();
    const createdAt = data.createdAt as Timestamp;
    const leaseExpiresAt = data.leaseExpiresAt as Timestamp;
    const expiresAt = data.expiresAt as Timestamp;

    expect(createdAt.toMillis()).toBe(NOW_MS);
    expect(leaseExpiresAt.toMillis()).toBe(NOW_MS + DEFAULT_LEASE_MS);
    expect(leaseExpiresAt.toMillis() - createdAt.toMillis()).toBe(60_000);
    expect(expiresAt.toMillis()).toBe(NOW_MS + CLAIM_TTL_MS);
    expect(expiresAt.toMillis() - createdAt.toMillis()).toBe(72 * 60 * 60 * 1_000);
  });

  it('acquired: honours a custom leaseMs', async () => {
    await acquireClaim(baseInput({ leaseMs: 5_000 }));

    const data = createArg();
    expect((data.leaseExpiresAt as Timestamp).toMillis()).toBe(NOW_MS + 5_000);
    // The 72 h TTL is unaffected by the lease length.
    expect((data.expiresAt as Timestamp).toMillis()).toBe(NOW_MS + CLAIM_TTL_MS);
  });

  it('acquired: writes to webhookClaims/{event_id} via PathResolver.webhookClaimsCollection', async () => {
    await acquireClaim(baseInput());

    expect(PathResolver.webhookClaimsCollection).toHaveBeenCalledWith();
    expect(fx.collectionRef.doc).toHaveBeenCalledWith(EVENT_ID);
    expect(fx.docRef.path).toBe(`webhookClaims/${EVENT_ID}`);
  });

  it('acquired: omits businessId entirely when absent rather than writing undefined', async () => {
    const input = baseInput();
    delete input.businessId;

    const result = await acquireClaim(input);

    expect(result.outcome).toBe('acquired');
    expect(createArg()).not.toHaveProperty('businessId');
    expect(Object.keys(createArg())).not.toContain('businessId');
  });

  it('acquired: does not write a result field', async () => {
    await acquireClaim(baseInput());

    expect(createArg()).not.toHaveProperty('result');
  });

  it('acquired: uses create(), never set() and never a transaction', async () => {
    await acquireClaim(baseInput());

    expect(fx.docRef.create).toHaveBeenCalledTimes(1);
    expect(fx.docRef.set).not.toHaveBeenCalled();
    expect(fx.docRef.update).not.toHaveBeenCalled();
    expect(fx.docRef.get).not.toHaveBeenCalled();
    expect(fx.db.runTransaction).not.toHaveBeenCalled();
    expect(fx.transaction.set).not.toHaveBeenCalled();
  });
});

// --- acquireClaim: done / failed / inFlight ----------------------------------------------

describe('acquireClaim — done / failed / inFlight', () => {
  beforeEach(() => {
    fx.docRef.create.mockRejectedValue(alreadyExistsError());
  });

  it('done: existing status "done" replays the cached result', async () => {
    fx.docRef.get.mockResolvedValue(snapshot(storedClaim({ status: 'done', result: 201 })));

    const result = await acquireClaim(baseInput());

    expect(result).toEqual({ outcome: 'done', result: 201 });
    expect(fx.db.runTransaction).not.toHaveBeenCalled();
  });

  it('done: existing status "done" with a missing result falls back to 200 and warns — never skips', async () => {
    const stored = storedClaim({ status: 'done' });
    delete stored.result;
    fx.docRef.get.mockResolvedValue(snapshot(stored));

    const result = await acquireClaim(baseInput());

    expect(result).toEqual({ outcome: 'done', result: 200 });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('done with no cached result'),
      expect.objectContaining({ eventId: EVENT_ID, businessId: BUSINESS_ID }),
    );
    // "done" is still an outcome the caller must act on — never a silent skip.
    expect(result.outcome).not.toBe('skip');
  });

  it('failed: existing status "failed" → outcome "failed" and no write', async () => {
    fx.docRef.get.mockResolvedValue(snapshot(storedClaim({ status: 'failed' })));

    const result = await acquireClaim(baseInput());

    expect(result).toEqual({ outcome: 'failed' });
    expect(fx.db.runTransaction).not.toHaveBeenCalled();
    expect(fx.transaction.update).not.toHaveBeenCalled();
    expect(fx.docRef.update).not.toHaveBeenCalled();
  });

  it('inFlight: status "claimed" with a live lease → outcome "inFlight" and no write', async () => {
    fx.docRef.get.mockResolvedValue(snapshot(storedClaim({
      leaseExpiresAt: Timestamp.fromMillis(NOW_MS + 1),
    })));

    const result = await acquireClaim(baseInput());

    expect(result).toEqual({ outcome: 'inFlight' });
    expect(fx.db.runTransaction).not.toHaveBeenCalled();
    expect(fx.transaction.update).not.toHaveBeenCalled();
    expect(fx.docRef.update).not.toHaveBeenCalled();
  });

  it('inFlight: an unrecognised status degrades to "inFlight" (retryable), never a skip', async () => {
    fx.docRef.get.mockResolvedValue(snapshot(storedClaim({ status: 'quarantined' })));

    const result = await acquireClaim(baseInput());

    expect(result).toEqual({ outcome: 'inFlight' });
    expect(fx.db.runTransaction).not.toHaveBeenCalled();
    expect(fx.transaction.update).not.toHaveBeenCalled();
  });
});

// --- acquireClaim: resumed ---------------------------------------------------------------

describe('acquireClaim — resumed', () => {
  beforeEach(() => {
    fx.docRef.create.mockRejectedValue(alreadyExistsError());
  });

  it('resumed: expired lease increments leaseGeneration and attemptCount and refreshes leaseExpiresAt', async () => {
    const stored = storedClaim({ leaseGeneration: 3, attemptCount: 4 });
    fx.docRef.get.mockResolvedValue(snapshot(stored));
    fx.transaction.get.mockResolvedValue(snapshot(stored));

    const result = await acquireClaim(baseInput());

    expect(result.outcome).toBe('resumed');
    if (result.outcome !== 'resumed') throw new Error('unreachable');
    expect(result.claim.leaseGeneration).toBe(4);
    expect(result.claim.attemptCount).toBe(5);
    expect(result.claim.leaseExpiresAt.toMillis()).toBe(NOW_MS + DEFAULT_LEASE_MS);

    expect(fx.transaction.update).toHaveBeenCalledTimes(1);
    expect(updateArg().leaseGeneration).toBe(4);
    expect(updateArg().attemptCount).toBe(5);
    expect((updateArg().leaseExpiresAt as Timestamp).toMillis()).toBe(NOW_MS + DEFAULT_LEASE_MS);
  });

  it('resumed: preserves phase, payload, createdAt and expiresAt', async () => {
    const stored = storedClaim();
    fx.docRef.get.mockResolvedValue(snapshot(stored));
    fx.transaction.get.mockResolvedValue(snapshot(stored));

    const result = await acquireClaim(baseInput());

    if (result.outcome !== 'resumed') throw new Error('expected resumed');
    // The recovery point is never rewound and the 72 h TTL never slides.
    expect(result.claim.phase).toBe('payment.captured');
    expect(result.claim.payload).toEqual({ event_id: EVENT_ID });
    expect(result.claim.createdAt.toMillis()).toBe(NOW_MS - 120_000);
    expect(result.claim.expiresAt.toMillis()).toBe(NOW_MS - 120_000 + CLAIM_TTL_MS);

    expect(Object.keys(updateArg()).sort()).toEqual(
      ['attemptCount', 'leaseExpiresAt', 'leaseGeneration'],
    );
    expect(updateArg()).not.toHaveProperty('phase');
    expect(updateArg()).not.toHaveProperty('payload');
    expect(updateArg()).not.toHaveProperty('createdAt');
    expect(updateArg()).not.toHaveProperty('expiresAt');
    expect(updateArg()).not.toHaveProperty('status');
  });

  it('resumed: leaseExpiresAt exactly equal to now counts as expired', async () => {
    const stored = storedClaim({ leaseExpiresAt: Timestamp.fromMillis(NOW_MS) });
    fx.docRef.get.mockResolvedValue(snapshot(stored));
    fx.transaction.get.mockResolvedValue(snapshot(stored));

    const result = await acquireClaim(baseInput());

    expect(result.outcome).toBe('resumed');
  });

  it('resumed: status flipped to "done" inside the reclaim transaction → outcome "done"', async () => {
    fx.docRef.get.mockResolvedValue(snapshot(storedClaim()));
    fx.transaction.get.mockResolvedValue(snapshot(storedClaim({ status: 'done', result: 204 })));

    const result = await acquireClaim(baseInput());

    expect(result).toEqual({ outcome: 'done', result: 204 });
    expect(fx.transaction.update).not.toHaveBeenCalled();
  });

  it('resumed: lease refreshed by another worker inside the reclaim transaction → outcome "inFlight"', async () => {
    fx.docRef.get.mockResolvedValue(snapshot(storedClaim()));
    fx.transaction.get.mockResolvedValue(snapshot(storedClaim({
      leaseGeneration: 2,
      leaseExpiresAt: Timestamp.fromMillis(NOW_MS + 30_000),
    })));

    const result = await acquireClaim(baseInput());

    expect(result).toEqual({ outcome: 'inFlight' });
    expect(fx.transaction.update).not.toHaveBeenCalled();
  });

  it('resumed: a "claimed" claim with an unreadable leaseExpiresAt is treated as expired, warned about, and reclaimed', async () => {
    const stored = storedClaim({ leaseExpiresAt: 'not-a-timestamp' });
    fx.docRef.get.mockResolvedValue(snapshot(stored));
    fx.transaction.get.mockResolvedValue(snapshot(stored));

    const result = await acquireClaim(baseInput());

    // Deliberate: a malformed lease must not wedge an event forever.
    expect(result.outcome).toBe('resumed');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('no readable leaseExpiresAt; treating the lease as expired'),
      expect.objectContaining({ eventId: EVENT_ID, businessId: BUSINESS_ID }),
    );
  });
});

// --- acquireClaim: ALREADY_EXISTS handling ------------------------------------------------

describe('acquireClaim — ALREADY_EXISTS handling', () => {
  it('detects ALREADY_EXISTS from numeric code 6', async () => {
    fx.docRef.create.mockRejectedValue(alreadyExistsError());
    fx.docRef.get.mockResolvedValue(snapshot(storedClaim({ status: 'failed' })));

    await expect(acquireClaim(baseInput())).resolves.toEqual({ outcome: 'failed' });
  });

  it('detects ALREADY_EXISTS from string code "ALREADY_EXISTS"', async () => {
    fx.docRef.create.mockRejectedValue(alreadyExistsError('stringCode'));
    fx.docRef.get.mockResolvedValue(snapshot(storedClaim({ status: 'failed' })));

    await expect(acquireClaim(baseInput())).resolves.toEqual({ outcome: 'failed' });
  });

  it('detects ALREADY_EXISTS from the error message when code is absent', async () => {
    fx.docRef.create.mockRejectedValue(alreadyExistsError('messageOnly'));
    fx.docRef.get.mockResolvedValue(snapshot(storedClaim({ status: 'failed' })));

    await expect(acquireClaim(baseInput())).resolves.toEqual({ outcome: 'failed' });
  });

  it('rethrows a non-ALREADY_EXISTS create() error unchanged', async () => {
    const err = Object.assign(new Error('7 PERMISSION_DENIED: nope'), { code: 7 });
    fx.docRef.create.mockRejectedValue(err);

    await expect(acquireClaim(baseInput())).rejects.toBe(err);
    expect(fx.docRef.get).not.toHaveBeenCalled();
  });

  it('ALREADY_EXISTS but the doc is absent on read → retries create once and returns "acquired"', async () => {
    fx.docRef.create
      .mockRejectedValueOnce(alreadyExistsError())
      .mockResolvedValueOnce({});
    fx.docRef.get.mockResolvedValue(snapshot(undefined));

    const result = await acquireClaim(baseInput());

    expect(result.outcome).toBe('acquired');
    expect(fx.docRef.create).toHaveBeenCalledTimes(2);
  });

  it('ALREADY_EXISTS with the doc absent on both reads throws rather than looping', async () => {
    fx.docRef.create.mockRejectedValue(alreadyExistsError());
    fx.docRef.get.mockResolvedValue(snapshot(undefined));

    await expect(acquireClaim(baseInput())).rejects.toThrow(
      /create\(\) reported ALREADY_EXISTS but the claim was absent on read, 2 times running/,
    );
    expect(fx.docRef.create).toHaveBeenCalledTimes(2);
  });

  it('warns on the first acquireClaim when FIRESTORE_PREFER_REST is set, at most once per instance', async () => {
    const preferRestWarnings = () => warn.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('FIRESTORE_PREFER_REST is set'),
    ).length;

    const previous = process.env.FIRESTORE_PREFER_REST;
    process.env.FIRESTORE_PREFER_REST = 'true';
    try {
      vi.resetModules();
      const mod = await import('../WebhookClaim');

      // Importing must NOT warn: src/index.ts re-exports this module, so a module-load check
      // would fire on every consumer of the library — cloud-functions cold starts included.
      expect(preferRestWarnings()).toBe(0);

      await mod.acquireClaim(baseInput());
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('FIRESTORE_PREFER_REST is set'),
      );
      expect(preferRestWarnings()).toBe(1);

      // Latched: an actual user is warned once, not once per delivery.
      await mod.acquireClaim(baseInput());
      expect(preferRestWarnings()).toBe(1);
    } finally {
      if (previous === undefined) delete process.env.FIRESTORE_PREFER_REST;
      else process.env.FIRESTORE_PREFER_REST = previous;
      vi.resetModules();
    }
  });
});

// --- event_id validation ------------------------------------------------------------------

describe('acquireClaim — event_id validation', () => {
  it('throws InvalidEventIdError when event_id is undefined', async () => {
    const input = baseInput({ eventId: undefined as unknown as string });

    await expect(acquireClaim(input)).rejects.toThrow(InvalidEventIdError);
    expect(fx.docRef.create).not.toHaveBeenCalled();
  });

  it('throws InvalidEventIdError when event_id is an empty string', async () => {
    await expect(acquireClaim(baseInput({ eventId: '' }))).rejects.toThrow(InvalidEventIdError);
    expect(fx.docRef.create).not.toHaveBeenCalled();
  });

  it('throws InvalidEventIdError for a non-UUID id such as "evt_cat_1"', async () => {
    await expect(acquireClaim(baseInput({ eventId: 'evt_cat_1' })))
      .rejects.toThrow(InvalidEventIdError);
    expect(fx.docRef.create).not.toHaveBeenCalled();
  });

  it('throws InvalidEventIdError for a legacy "{businessId}_undefined" style key', async () => {
    await expect(acquireClaim(baseInput({ eventId: 'biz-1_undefined' })))
      .rejects.toThrow(InvalidEventIdError);
    expect(fx.docRef.create).not.toHaveBeenCalled();
  });

  it('accepts an uppercase UUID', async () => {
    const upper = EVENT_ID.toUpperCase();

    const result = await acquireClaim(baseInput({ eventId: upper }));

    expect(result.outcome).toBe('acquired');
    expect(fx.collectionRef.doc).toHaveBeenCalledWith(upper);
  });

  it('accepts any version nibble (shape-only check, not strict v4)', async () => {
    // Version nibble 9 and variant nibble c — not a valid v4 UUID, but correctly shaped.
    const oddVersion = '0d1c1b2a-3f4e-9d6c-cb8a-9e0f1a2b3c4d';

    const result = await acquireClaim(baseInput({ eventId: oddVersion }));

    expect(result.outcome).toBe('acquired');
  });

  it('never synthesizes a fallback key — create() is not attempted', async () => {
    await expect(acquireClaim(baseInput({ eventId: undefined as unknown as string })))
      .rejects.toThrow(InvalidEventIdError);

    expect(fx.collectionRef.doc).not.toHaveBeenCalled();
    expect(fx.docRef.create).not.toHaveBeenCalled();
    expect(PathResolver.webhookClaimsCollection).not.toHaveBeenCalled();
  });
});

// --- age gate -----------------------------------------------------------------------------

describe('acquireClaim — age gate', () => {
  it('rejects created_at older than 24h with EventTooOldError and no create()', async () => {
    const tooOld = new Date(NOW_MS - MAX_EVENT_AGE_MS - 1).toISOString();

    await expect(acquireClaim(baseInput({ eventCreatedAt: tooOld })))
      .rejects.toThrow(EventTooOldError);
    expect(fx.docRef.create).not.toHaveBeenCalled();
  });

  it('accepts created_at exactly 24h old (inclusive boundary)', async () => {
    const exactly = new Date(NOW_MS - MAX_EVENT_AGE_MS).toISOString();

    const result = await acquireClaim(baseInput({ eventCreatedAt: exactly }));

    expect(result.outcome).toBe('acquired');
  });

  it('accepts created_at 24h minus 1ms old', async () => {
    const justInside = new Date(NOW_MS - MAX_EVENT_AGE_MS + 1).toISOString();

    const result = await acquireClaim(baseInput({ eventCreatedAt: justInside }));

    expect(result.outcome).toBe('acquired');
  });

  it('proceeds with a warning when created_at is missing', async () => {
    const result = await acquireClaim(
      baseInput({ eventCreatedAt: undefined as unknown as string }),
    );

    expect(result.outcome).toBe('acquired');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('created_at missing or unparseable'),
      expect.objectContaining({ eventId: EVENT_ID }),
    );
  });

  it('proceeds with a warning when created_at is unparseable', async () => {
    const result = await acquireClaim(baseInput({ eventCreatedAt: 'yesterday-ish' }));

    expect(result.outcome).toBe('acquired');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('created_at missing or unparseable'),
      expect.objectContaining({ eventId: EVENT_ID }),
    );
  });
});

// --- payload -------------------------------------------------------------------------------

describe('acquireClaim — payload', () => {
  it('throws ValidationError when payload is null', async () => {
    const input = baseInput({ payload: null as unknown as Record<string, unknown> });

    await expect(acquireClaim(input)).rejects.toThrow(ValidationError);
    expect(fx.docRef.create).not.toHaveBeenCalled();
  });

  it('throws ValidationError when payload is undefined', async () => {
    const input = baseInput({ payload: undefined as unknown as Record<string, unknown> });

    await expect(acquireClaim(input)).rejects.toThrow(ValidationError);
    expect(fx.docRef.create).not.toHaveBeenCalled();
  });

  it('accepts an empty object payload', async () => {
    const result = await acquireClaim(baseInput({ payload: {} }));

    expect(result.outcome).toBe('acquired');
    expect(createArg().payload).toEqual({});
  });

  it('stores the payload verbatim — no transformation, no field selection', async () => {
    const payload = {
      merchant_id: 'MLKC3F9RCXNPP',
      type: 'order.updated',
      event_id: EVENT_ID,
      created_at: CREATED_ISO,
      data: {
        type: 'order',
        id: 'ORDER_1',
        object: {
          order_updated: {
            order_id: 'ORDER_1',
            version: 3,
            state: 'OPEN',
            location_id: 'L1',
            created_at: CREATED_ISO,
            updated_at: CREATED_ISO,
          },
          nested: { deep: { deeper: ['a', 'b', { c: 1 }] } },
          nullish: null,
          emptyObject: {},
          emptyArray: [],
          unicode: 'crème brûlée — 🍮',
          truthy: true,
          negative: -12,
          fractional: 1.5,
        },
      },
    };

    const result = await acquireClaim(baseInput({ payload }));

    if (result.outcome !== 'acquired') throw new Error('expected acquired');
    // Identity, not just deep equality: nothing is copied, filtered or normalized.
    expect(createArg().payload).toBe(payload);
    expect(result.claim.payload).toBe(payload);
    expect(createArg().payload).toEqual(payload);
  });
});

// --- metadata leniency ---------------------------------------------------------------------

describe('acquireClaim — metadata leniency', () => {
  it('stores "" and warns when eventType is absent', async () => {
    const result = await acquireClaim(
      baseInput({ eventType: undefined as unknown as string }),
    );

    expect(result.outcome).toBe('acquired');
    expect(createArg().eventType).toBe('');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('metadata field missing on the event'),
      expect.objectContaining({ field: 'eventType', eventId: EVENT_ID }),
    );
  });

  it('stores "" and warns when merchantId is absent', async () => {
    const result = await acquireClaim(
      baseInput({ merchantId: undefined as unknown as string }),
    );

    expect(result.outcome).toBe('acquired');
    expect(createArg().merchantId).toBe('');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('metadata field missing on the event'),
      expect.objectContaining({ field: 'merchantId', eventId: EVENT_ID }),
    );
  });
});

// --- fencing ------------------------------------------------------------------------------

describe('fencing helpers', () => {
  it('advancePhase writes phase and renews the lease when the generation matches', async () => {
    fx.transaction.get.mockResolvedValue(snapshot(storedClaim({ leaseGeneration: 3 })));

    await advancePhase(EVENT_ID, 3, 'square.payment.created');

    expect(fx.transaction.update).toHaveBeenCalledTimes(1);
    expect(updateArg().phase).toBe('square.payment.created');
    expect((updateArg().leaseExpiresAt as Timestamp).toMillis())
      .toBe(NOW_MS + DEFAULT_LEASE_MS);
  });

  it('advancePhase honours a custom leaseMs when renewing', async () => {
    fx.transaction.get.mockResolvedValue(snapshot(storedClaim({ leaseGeneration: 3 })));

    await advancePhase(EVENT_ID, 3, 'phase-2', 15_000);

    expect((updateArg().leaseExpiresAt as Timestamp).toMillis()).toBe(NOW_MS + 15_000);
  });

  it('advancePhase with a stale generation throws StaleLeaseError and writes nothing', async () => {
    fx.transaction.get.mockResolvedValue(snapshot(storedClaim({ leaseGeneration: 7 })));

    await expect(advancePhase(EVENT_ID, 3, 'phase-2')).rejects.toThrow(StaleLeaseError);
    expect(fx.transaction.update).not.toHaveBeenCalled();
    expect(fx.transaction.set).not.toHaveBeenCalled();
  });

  it('advancePhase does not bump leaseGeneration', async () => {
    fx.transaction.get.mockResolvedValue(snapshot(storedClaim({ leaseGeneration: 3 })));

    await advancePhase(EVENT_ID, 3, 'phase-2');

    // The generation is a fencing token: it advances only on a steal, never on progress.
    expect(updateArg()).not.toHaveProperty('leaseGeneration');
    expect(Object.keys(updateArg()).sort()).toEqual(['leaseExpiresAt', 'phase']);
  });

  it('completeClaim sets status "done" and caches result when the generation matches', async () => {
    fx.transaction.get.mockResolvedValue(snapshot(storedClaim({ leaseGeneration: 2 })));

    await completeClaim(EVENT_ID, 2, 201);

    expect(fx.transaction.update).toHaveBeenCalledTimes(1);
    expect(updateArg()).toEqual({ status: 'done', result: 201 });
    // `phase` is left alone as the last recovery point.
    expect(updateArg()).not.toHaveProperty('phase');
  });

  it('completeClaim with a stale generation throws StaleLeaseError and writes nothing', async () => {
    fx.transaction.get.mockResolvedValue(snapshot(storedClaim({ leaseGeneration: 5 })));

    await expect(completeClaim(EVENT_ID, 2, 200)).rejects.toThrow(StaleLeaseError);
    expect(fx.transaction.update).not.toHaveBeenCalled();
    expect(fx.transaction.set).not.toHaveBeenCalled();
  });

  it('completeClaim on an absent claim throws StaleLeaseError', async () => {
    fx.transaction.get.mockResolvedValue(snapshot(undefined));

    await expect(completeClaim(EVENT_ID, 2, 200)).rejects.toMatchObject({
      name: 'StaleLeaseError',
      expectedGeneration: 2,
      actualGeneration: undefined,
    });
    expect(fx.transaction.update).not.toHaveBeenCalled();
  });

  it('releaseClaim expires the lease in place, leaving status "claimed", phase and attemptCount intact', async () => {
    fx.transaction.get.mockResolvedValue(snapshot(storedClaim({ leaseGeneration: 1 })));

    await releaseClaim(EVENT_ID, 1);

    expect(fx.transaction.update).toHaveBeenCalledTimes(1);
    expect(Object.keys(updateArg())).toEqual(['leaseExpiresAt']);
    expect((updateArg().leaseExpiresAt as Timestamp).toMillis()).toBe(NOW_MS);
    expect(updateArg()).not.toHaveProperty('status');
    expect(updateArg()).not.toHaveProperty('phase');
    expect(updateArg()).not.toHaveProperty('attemptCount');
    // Never a delete: the payload is the only durable replay source.
    expect(fx.transaction.delete).not.toHaveBeenCalled();
    expect(fx.docRef.delete).not.toHaveBeenCalled();
  });

  it('releaseClaim with a stale generation throws StaleLeaseError and writes nothing', async () => {
    fx.transaction.get.mockResolvedValue(snapshot(storedClaim({ leaseGeneration: 4 })));

    await expect(releaseClaim(EVENT_ID, 1)).rejects.toThrow(StaleLeaseError);
    expect(fx.transaction.update).not.toHaveBeenCalled();
    expect(fx.transaction.delete).not.toHaveBeenCalled();
  });

  it('failClaim sets status "failed" and nothing else — no result, no lease change', async () => {
    fx.transaction.get.mockResolvedValue(snapshot(storedClaim({ leaseGeneration: 3 })));

    await failClaim(EVENT_ID, 3);

    expect(fx.transaction.update).toHaveBeenCalledTimes(1);
    // Exactly one field: `failed` is a status change, not a completion.
    expect(updateArg()).toEqual({ status: 'failed' });
    // `result` is completeClaim's cached success status; its absence is how a reader tells a
    // `failed` claim from a `done` one that returned an error status.
    expect(updateArg()).not.toHaveProperty('result');
    // The evidence a human and cf#83 work from is untouched.
    expect(updateArg()).not.toHaveProperty('phase');
    expect(updateArg()).not.toHaveProperty('attemptCount');
    expect(updateArg()).not.toHaveProperty('payload');
    expect(updateArg()).not.toHaveProperty('leaseExpiresAt');
  });

  it('failClaim never deletes the claim — the payload is the only durable replay source', async () => {
    fx.transaction.get.mockResolvedValue(snapshot(storedClaim({ leaseGeneration: 1 })));

    await failClaim(EVENT_ID, 1);

    expect(fx.transaction.delete).not.toHaveBeenCalled();
    expect(fx.docRef.delete).not.toHaveBeenCalled();
  });

  it('failClaim with a stale generation throws StaleLeaseError and writes nothing', async () => {
    // cf#82's sweeper reads, then fails: a claim stolen in between is making progress again
    // and must be left alone. The fence is what makes that read-then-fail a compare-and-set.
    fx.transaction.get.mockResolvedValue(snapshot(storedClaim({ leaseGeneration: 7 })));

    await expect(failClaim(EVENT_ID, 6)).rejects.toThrow(StaleLeaseError);
    expect(fx.transaction.update).not.toHaveBeenCalled();
    expect(fx.transaction.delete).not.toHaveBeenCalled();
  });

  it('failClaim on an absent claim throws StaleLeaseError', async () => {
    fx.transaction.get.mockResolvedValue(snapshot(undefined));

    await expect(failClaim(EVENT_ID, 2)).rejects.toMatchObject({
      name: 'StaleLeaseError',
      expectedGeneration: 2,
      actualGeneration: undefined,
    });
    expect(fx.transaction.update).not.toHaveBeenCalled();
  });

  it('failClaim writes the status acquireClaim reads back as the "failed" outcome', async () => {
    // The round trip that was unbuildable before this export: nothing could produce the state
    // the `failed` branch of the acquire table has always been able to read.
    fx.transaction.get.mockResolvedValue(snapshot(storedClaim({ leaseGeneration: 1 })));
    await failClaim(EVENT_ID, 1);
    const written = updateArg();

    fx.docRef.create.mockRejectedValue(alreadyExistsError());
    fx.docRef.get.mockResolvedValue(snapshot(storedClaim({ ...written })));

    const result = await acquireClaim(baseInput());
    expect(result.outcome).toBe('failed');
  });

  it("withClaimFence resolves on a matching generation and reads the claim inside the caller's transaction", async () => {
    const callerTx = {
      get: vi.fn(async () => snapshot(storedClaim({ leaseGeneration: 6 }))),
      update: vi.fn(),
      set: vi.fn(),
    };

    // It now resolves to the opaque ClaimFence handle — the only key completeClaimIn accepts —
    // carrying the transaction it was asserted in alongside the eventId and generation.
    const fence = await withClaimFence(callerTx as unknown as Transaction, EVENT_ID, 6);

    expect(fence).toMatchObject({ eventId: EVENT_ID, leaseGeneration: 6, tx: callerTx });
    expect(callerTx.get).toHaveBeenCalledTimes(1);
    expect(callerTx.get).toHaveBeenCalledWith(fx.docRef);
    // The fence runs on the caller's transaction, not a new one of its own.
    expect(fx.db.runTransaction).not.toHaveBeenCalled();
  });

  it('withClaimFence with a stale generation throws StaleLeaseError before the caller writes', async () => {
    const callerTx = {
      get: vi.fn(async () => snapshot(storedClaim({ leaseGeneration: 9 }))),
      update: vi.fn(),
      set: vi.fn(),
    };

    await expect(withClaimFence(callerTx as unknown as Transaction, EVENT_ID, 6))
      .rejects.toThrow(StaleLeaseError);
    expect(callerTx.update).not.toHaveBeenCalled();
    expect(callerTx.set).not.toHaveBeenCalled();
  });

  it('withClaimFence on an absent claim throws StaleLeaseError', async () => {
    const callerTx = {
      get: vi.fn(async () => snapshot(undefined)),
      update: vi.fn(),
      set: vi.fn(),
    };

    await expect(withClaimFence(callerTx as unknown as Transaction, EVENT_ID, 6))
      .rejects.toMatchObject({ name: 'StaleLeaseError', actualGeneration: undefined });
    expect(callerTx.update).not.toHaveBeenCalled();
  });

  it("completeClaimIn queues the terminal write on the caller's transaction", async () => {
    const callerTx = {
      get: vi.fn(async () => snapshot(storedClaim({ leaseGeneration: 4 }))),
      update: vi.fn(),
      set: vi.fn(),
    };
    const fence = await withClaimFence(callerTx as unknown as Transaction, EVENT_ID, 4);
    // Forget the fence's own read, so the assertion below is about completeClaimIn alone.
    callerTx.get.mockClear();

    completeClaimIn(fence, 200);

    expect(callerTx.update).toHaveBeenCalledTimes(1);
    expect(callerTx.update).toHaveBeenCalledWith(fx.docRef, { status: 'done', result: 200 });
    // Write-only: the fence already read the claim in this same tx, so it reads nothing itself.
    expect(callerTx.get).not.toHaveBeenCalled();
    expect(fx.db.runTransaction).not.toHaveBeenCalled();
  });

  it('completeClaimIn cannot be called without a fence — the precondition is a compile error', () => {
    const callerTx = { get: vi.fn(), update: vi.fn(), set: vi.fn() };

    // Replaces the old runtime `Number.isInteger(expectedGeneration)` guard, which existed only
    // because the generation used to arrive as a loose caller-supplied number. `ClaimFence` is
    // branded with a module-private `unique symbol`, so the loose call no longer typechecks —
    // "completed without fencing" is now unrepresentable rather than merely discouraged.
    //
    // Deliberately never invoked: the assertion is that this does not compile, not what it
    // would do at runtime.
    const unfenced = () => {
      // @ts-expect-error — completeClaimIn takes (fence: ClaimFence, result: number); the loose
      // (tx, eventId, expectedGeneration, result) call is exactly the unfenced write this
      // design exists to prevent.
      completeClaimIn(callerTx as unknown as Transaction, EVENT_ID, 4, 200);
    };

    // @ts-expect-error — a hand-written object cannot satisfy ClaimFence: the brand symbol is
    // declared but never exported, so no consumer can name the key.
    const forged: ClaimFence = {
      tx: callerTx as unknown as Transaction,
      eventId: EVENT_ID,
      leaseGeneration: 4,
    };

    expect(typeof unfenced).toBe('function');
    expect(forged.eventId).toBe(EVENT_ID);
    expect(callerTx.update).not.toHaveBeenCalled();
  });

  it('completeClaimIn writes through the fence\'s own transaction, never a second one', async () => {
    const fencedTx = {
      get: vi.fn(async () => snapshot(storedClaim({ leaseGeneration: 2 }))),
      update: vi.fn(),
      set: vi.fn(),
    };
    const otherTx = { get: vi.fn(), update: vi.fn(), set: vi.fn() };

    const fence = await withClaimFence(fencedTx as unknown as Transaction, EVENT_ID, 2);
    completeClaimIn(fence, 204);

    // The handle carries the Transaction precisely so "fence in one tx, write in another" — a
    // fence enforced against a read set the write never joins — cannot be expressed.
    expect(fencedTx.update).toHaveBeenCalledTimes(1);
    expect(fencedTx.update).toHaveBeenCalledWith(fx.docRef, { status: 'done', result: 204 });
    expect(otherTx.update).not.toHaveBeenCalled();
  });

  it('completeClaimIn is unreachable when withClaimFence throws — no fence, no terminal write', async () => {
    const callerTx = {
      get: vi.fn(async () => snapshot(storedClaim({ leaseGeneration: 9 }))),
      update: vi.fn(),
      set: vi.fn(),
    };

    await expect(withClaimFence(callerTx as unknown as Transaction, EVENT_ID, 2))
      .rejects.toThrow(StaleLeaseError);
    // No fence was produced, so there is nothing to hand completeClaimIn.
    expect(callerTx.update).not.toHaveBeenCalled();
  });
});

// --- union / helpers -----------------------------------------------------------------------

describe('union and helpers', () => {
  it('claimIdempotencyKey formats kios-${eventId}-${phase}', () => {
    expect(claimIdempotencyKey(EVENT_ID, 'started')).toBe(`kios-${EVENT_ID}-started`);
    expect(claimIdempotencyKey(EVENT_ID, 'payment.captured'))
      .toBe(`kios-${EVENT_ID}-payment.captured`);
  });

  it('matchAcquireResult dispatches each of the five outcomes to its handler', () => {
    const claim = { eventId: EVENT_ID, phase: 'started' } as never;
    const handlers: AcquireHandlers<string> = {
      acquired: () => 'acquired',
      resumed: () => 'resumed',
      inFlight: () => 'inFlight',
      done: (result) => `done:${result}`,
      failed: () => 'failed',
    };

    expect(matchAcquireResult({ outcome: 'acquired', claim }, handlers)).toBe('acquired');
    expect(matchAcquireResult({ outcome: 'resumed', claim }, handlers)).toBe('resumed');
    expect(matchAcquireResult({ outcome: 'inFlight' }, handlers)).toBe('inFlight');
    expect(matchAcquireResult({ outcome: 'done', result: 429 }, handlers)).toBe('done:429');
    expect(matchAcquireResult({ outcome: 'failed' }, handlers)).toBe('failed');
  });

  it('a handler map missing inFlight does not typecheck', () => {
    // @ts-expect-error — AcquireHandlers requires all five keys; omitting `inFlight` must be
    // a compile error, which is the whole enforcement mechanism (§1.3).
    const incomplete: AcquireHandlers<number> = {
      acquired: () => 1,
      resumed: () => 2,
      done: () => 3,
      failed: () => 4,
    };

    expect(Object.keys(incomplete)).not.toContain('inFlight');
  });

  it('AcquireResult has no member carrying a skip semantic', () => {
    const outcomes: Array<AcquireResult['outcome']> = [
      'acquired', 'resumed', 'inFlight', 'done', 'failed',
    ];
    expect(new Set(outcomes).size).toBe(5);

    // @ts-expect-error — 'skip' is not a member of AcquireResult['outcome'].
    const notAnOutcome: AcquireResult['outcome'] = 'skip';
    expect(outcomes).not.toContain(notAnOutcome);

    const handlers: AcquireHandlers<void> = {
      acquired: () => undefined,
      resumed: () => undefined,
      inFlight: () => undefined,
      done: () => undefined,
      failed: () => undefined,
    };
    expect(Object.keys(handlers).sort()).toEqual([...outcomes].sort());
  });
});

// --- dual-write (req 6) --------------------------------------------------------------------

describe('legacy RTDB dual-write (req 6)', () => {
  it('dual-write ON: writes the legacy RTDB node on "acquired"', async () => {
    const result = await acquireClaim(baseInput());

    expect(result.outcome).toBe('acquired');
    expect(legacy.ctor).toHaveBeenCalledTimes(1);
    expect(legacy.init).toHaveBeenCalledTimes(1);
  });

  it('dual-write ON: writes the legacy RTDB node on "resumed" (idempotent)', async () => {
    fx.docRef.create.mockRejectedValue(alreadyExistsError());
    const stored = storedClaim();
    fx.docRef.get.mockResolvedValue(snapshot(stored));
    fx.transaction.get.mockResolvedValue(snapshot(stored));

    const result = await acquireClaim(baseInput());

    expect(result.outcome).toBe('resumed');
    expect(legacy.ctor).toHaveBeenCalledTimes(1);
    expect(legacy.init).toHaveBeenCalledTimes(1);
  });

  it('dual-write ON: legacy node uses Provider.square, the eventType and the verbatim event_id', async () => {
    await acquireClaim(baseInput());

    expect(legacy.ctor).toHaveBeenCalledWith('biz-1', 'square', 'order.updated', EVENT_ID);
  });

  it('dual-write OFF: no legacy RTDB node is written', async () => {
    // The gate is the `writeLegacyEventNotification` WriteModelFlags entry (default true), so
    // this branch is reached by the flag read returning false — which is exactly the rcc#167
    // retirement step, one boolean per GCP project.
    flags.getFlags.mockResolvedValue({ writeLegacyEventNotification: false });

    const result = await acquireClaim(baseInput());

    expect(result.outcome).toBe('acquired');
    expect(legacy.ctor).not.toHaveBeenCalled();
    expect(legacy.init).not.toHaveBeenCalled();
  });

  it('dual-write OFF on "resumed" too: the flag gates both acquire branches', async () => {
    flags.getFlags.mockResolvedValue({ writeLegacyEventNotification: false });
    fx.docRef.create.mockRejectedValue(alreadyExistsError());
    const stored = storedClaim();
    fx.docRef.get.mockResolvedValue(snapshot(stored));
    fx.transaction.get.mockResolvedValue(snapshot(stored));

    const result = await acquireClaim(baseInput());

    expect(result.outcome).toBe('resumed');
    expect(legacy.init).not.toHaveBeenCalled();
  });

  it('a failing flag read defaults the dual-write ON and warns — never fails the committed claim', async () => {
    // getFlags does not catch Firestore errors; a rejected .get() propagates. The claim is
    // already committed by then, and ON preserves rollback protection while OFF silently loses
    // it, so the fallback is ON.
    flags.getFlags.mockRejectedValue(new Error('Firestore unavailable'));

    const result = await acquireClaim(baseInput());

    expect(result.outcome).toBe('acquired');
    expect(legacy.init).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('could not read writeLegacyEventNotification'),
      expect.objectContaining({
        eventId: EVENT_ID,
        businessId: BUSINESS_ID,
        error: expect.stringContaining('Firestore unavailable'),
      }),
    );
  });

  it('dual-write ON with businessId absent: skips the legacy node and warns (no "undefined_" key)', async () => {
    const input = baseInput();
    delete input.businessId;

    const result = await acquireClaim(input);

    expect(result.outcome).toBe('acquired');
    expect(legacy.ctor).not.toHaveBeenCalled();
    expect(legacy.init).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('skipping the legacy RTDB'),
      // No `businessId` to log — that absence is the reason for the warning — so the tenant
      // filter falls back to `merchantId` (LOGGING.md rule 6).
      expect.objectContaining({ eventId: EVENT_ID, merchantId: MERCHANT_ID }),
    );
  });

  it('dual-write ON: a failing RTDB write is swallowed and the outcome is unchanged', async () => {
    legacy.init.mockRejectedValue(new Error('RTDB unavailable'));

    const result = await acquireClaim(baseInput());

    expect(result.outcome).toBe('acquired');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('legacy RTDB dual-write failed'),
      expect.objectContaining({
        eventId: EVENT_ID,
        businessId: BUSINESS_ID,
        error: expect.stringContaining('RTDB unavailable'),
      }),
    );
  });

  it('dual-write ON: a stalled RTDB write is abandoned after 5s, warned about, and the outcome is unchanged', async () => {
    // A stall, not a rejection: firebase-admin's RTDB transaction() queues indefinitely while
    // the client is disconnected, so there is nothing for the catch to catch.
    legacy.init.mockReturnValue(new Promise(() => undefined));

    const pending = acquireClaim(baseInput());
    // Let create() resolve and the timeout timer be scheduled before advancing the clock.
    await vi.advanceTimersByTimeAsync(0);
    // LEGACY_DUAL_WRITE_TIMEOUT_MS — module-private, so the value is spelled out here.
    await vi.advanceTimersByTimeAsync(5_000);

    const result = await pending;

    expect(result.outcome).toBe('acquired');
    expect(legacy.init).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('did not settle in time'),
      expect.objectContaining({
        eventId: EVENT_ID,
        businessId: BUSINESS_ID,
        timeoutMs: 5_000,
      }),
    );
  });

  it('dual-write ON: a write that settles in time does not wait out the timeout', async () => {
    // The bound is a ceiling, not a delay: a healthy write returns on its own microtask.
    const result = await acquireClaim(baseInput());

    expect(result.outcome).toBe('acquired');
    expect(vi.getTimerCount()).toBe(0);
    expect(warn).not.toHaveBeenCalledWith(
      expect.stringContaining('did not settle in time'),
      expect.anything(),
    );
  });

  it('dual-write is not gated on useClaimLease — acquireClaim never reads the flag', async () => {
    // The module now imports FeatureFlagService for `writeLegacyEventNotification`, so the old
    // "no dependency at all" assertion no longer holds. What must stay true is narrower and is
    // the part that matters: `useClaimLease` is never *read*. Being called is the flag decision,
    // already made by the consumer; re-reading it here would add a read to every delivery.
    const source = readWebhookClaimSource();
    // Every mention of useClaimLease is prose: no statement reads it off an object, and it is
    // never destructured out of the flags object either.
    expect(source).not.toMatch(/\.\s*useClaimLease/);
    expect(source).not.toMatch(/\buseClaimLease\s*[,}:]/);
    // The one flag this module does read, read in exactly one place: a single getFlags() call
    // site and a single property access off its result.
    expect(source.match(/getFlags\s*\(/g)).toHaveLength(1);
    expect(source.match(/\.writeLegacyEventNotification\b/g)).toHaveLength(1);

    // Behavioural: the dual-write happens with no extra Firestore round-trip beyond the create.
    const result = await acquireClaim(baseInput());

    expect(result.outcome).toBe('acquired');
    expect(legacy.init).toHaveBeenCalledTimes(1);
    expect(fx.docRef.get).not.toHaveBeenCalled();
    expect(fx.db.runTransaction).not.toHaveBeenCalled();
  });

  it('the ~50% duplicate path makes zero flag reads', async () => {
    // inFlight / done / failed must stay exactly as cheap as before the flag existed: the read
    // lives inside the dual-write path, which those branches never enter.
    fx.docRef.create.mockRejectedValue(alreadyExistsError());

    fx.docRef.get.mockResolvedValue(snapshot(storedClaim({ status: 'done', result: 201 })));
    await expect(acquireClaim(baseInput())).resolves.toEqual({ outcome: 'done', result: 201 });

    fx.docRef.get.mockResolvedValue(snapshot(storedClaim({ status: 'failed' })));
    await expect(acquireClaim(baseInput())).resolves.toEqual({ outcome: 'failed' });

    fx.docRef.get.mockResolvedValue(snapshot(storedClaim({
      leaseExpiresAt: Timestamp.fromMillis(NOW_MS + 30_000),
    })));
    await expect(acquireClaim(baseInput())).resolves.toEqual({ outcome: 'inFlight' });

    expect(flags.getFlags).not.toHaveBeenCalled();
    expect(legacy.init).not.toHaveBeenCalled();
  });

  it('the flag is read on the dual-write path only, and getFlags memoises it off the hot path', async () => {
    await acquireClaim(baseInput());
    await acquireClaim(baseInput());

    // One read per acquire at this layer; getFlags itself caches for 60 s per instance, so the
    // steady-state Firestore cost is a read per minute per instance, not one per delivery.
    expect(flags.getFlags).toHaveBeenCalledTimes(2);
    expect(legacy.init).toHaveBeenCalledTimes(2);
  });
});
