/**
 * Plain fixtures shared by the **mocked** `WebhookClaim` suites (rcc#166).
 *
 * Scope, deliberately: only the values and factories that carry **no hoisting constraint**.
 * The `vi.hoisted` Firestore double and the `vi.mock` blocks stay per-file — they run above
 * imports and sharing them would need async-factory dynamic-import tricks for no real gain.
 * What did drift between the copies was this layer, so this is the layer that is shared.
 *
 * `WebhookClaim.emu.test.ts` deliberately does NOT use any of this: it talks to a real
 * Firestore emulator and shares none of the mock harness.
 *
 * The real `Timestamp` is used here, matching the suites: they replace only `getFirestore`,
 * and every lease/TTL assertion is arithmetic on a genuine `Timestamp`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Timestamp } from 'firebase-admin/firestore';
import { CLAIM_TTL_MS } from '../../WebhookClaim';
import type { AcquireClaimInput } from '../../WebhookClaim';

/** A correctly shaped Square `event_id`. */
export const EVENT_ID = '0d1c1b2a-3f4e-5d6c-7b8a-9e0f1a2b3c4d';

/** The resolved tenant for a claim taken with a known business. */
export const BUSINESS_ID = 'biz-1';

/** The Square merchant behind `BUSINESS_ID`. */
export const MERCHANT_ID = 'MLKC3F9RCXNPP';

/** The instant the suites pin the fake clock to. */
export const NOW_ISO = '2026-08-16T12:00:10.000Z';

/** `NOW_ISO` in epoch millis — the base every lease/TTL assertion is written against. */
export const NOW_MS = Date.parse(NOW_ISO);

/** The webhook's `created_at`: ten seconds before `NOW_ISO`, comfortably inside the age gate. */
export const CREATED_ISO = '2026-08-16T12:00:00.000Z';

/** A well-formed `acquireClaim` input. Override one field to exercise one rule. */
export function baseInput(overrides: Partial<AcquireClaimInput> = {}): AcquireClaimInput {
  return {
    eventId: EVENT_ID,
    eventType: 'order.updated',
    merchantId: MERCHANT_ID,
    payload: { event_id: EVENT_ID, type: 'order.updated' },
    eventCreatedAt: CREATED_ISO,
    businessId: BUSINESS_ID,
    ...overrides,
  };
}

/** The minimal `DocumentSnapshot` surface `WebhookClaim` reads. */
export interface FakeSnapshot {
  exists: boolean;
  data: () => Record<string, unknown> | undefined;
}

export function snapshot(data: Record<string, unknown> | undefined): FakeSnapshot {
  return { exists: data !== undefined, data: () => data };
}

/**
 * A stored `claimed` claim — **the single source of truth for the claim field set.**
 *
 * `leaseExpiresAt` defaults to a lapsed lease (the reclaim case); pass an override for the
 * live-lease case. Its key set is exported as `CLAIM_CONTRACT_FIELDS`, so the contract's
 * field list is written down exactly once, here.
 */
export function storedClaim(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    eventId: EVENT_ID,
    eventType: 'order.updated',
    merchantId: MERCHANT_ID,
    businessId: BUSINESS_ID,
    status: 'claimed',
    phase: 'payment.captured',
    payload: { event_id: EVENT_ID },
    leaseExpiresAt: Timestamp.fromMillis(NOW_MS - 1_000),
    leaseGeneration: 1,
    attemptCount: 1,
    createdAt: Timestamp.fromMillis(NOW_MS - 120_000),
    expiresAt: Timestamp.fromMillis(NOW_MS - 120_000 + CLAIM_TTL_MS),
    ...overrides,
  };
}

/**
 * The complete field set the contract (rcc#165) specifies for a claim taken with a known
 * tenant, derived from `storedClaim()` so the list cannot drift away from the fixture.
 *
 * `result` is absent on purpose: only `completeClaim` writes it.
 */
export const CLAIM_CONTRACT_FIELDS: readonly string[] = Object.keys(storedClaim()).sort();

/**
 * The shapes a Firestore `create()` conflict arrives in. All three must be recognised as
 * ALREADY_EXISTS:
 *  - `numericCode` — gRPC status 6, the normal transport;
 *  - `stringCode` — the string alias some client versions attach;
 *  - `messageOnly` — no `code` at all, only the server's message.
 */
export type AlreadyExistsVariant = 'numericCode' | 'stringCode' | 'messageOnly';

export function alreadyExistsError(variant: AlreadyExistsVariant = 'numericCode'): Error {
  if (variant === 'stringCode') {
    return Object.assign(new Error('conflict'), { code: 'ALREADY_EXISTS' });
  }
  if (variant === 'messageOnly') {
    return new Error(
      'Document already exists: projects/p/databases/(default)/documents/webhookClaims/x',
    );
  }
  return Object.assign(new Error('conflict'), { code: 6 });
}

/** `WebhookClaim.ts` on disk — read as text by the structural and contract-TSDoc guards. */
export const SOURCE_PATH = join(process.cwd(), 'src/restaurant/webhooks/WebhookClaim.ts');

export function readWebhookClaimSource(): string {
  return readFileSync(SOURCE_PATH, 'utf8');
}
