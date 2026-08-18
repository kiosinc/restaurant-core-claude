/**
 * Coexistence pin for the legacy RTDB gate (P42 / rcc#166).
 *
 * `EventNotification` is **untouched** by P42 — zero diff is an acceptance criterion — and it
 * keeps running alongside the new `webhookClaims` primitive for the whole migration window:
 * `WebhookClaim.acquireClaim` dual-writes this node so that flipping `useClaimLease` back off
 * is a pure flag flip, and rcc#167 retires the node afterwards.
 *
 * These tests exist so that the legacy shape the dual-write and the rollback both depend on —
 * the `/private/notifications/{businessId}_{Id}` path, the four-field `val()`, and the
 * `isNew` semantics — cannot drift silently. There is no test file for this module on the base
 * commit, so this is the first pin of that behaviour.
 */
import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';

type TransactionUpdate = (value: unknown) => unknown;
type TransactionCallback = (
  error: Error | null,
  committed: boolean,
  snapshot: { val: () => unknown } | null,
) => void;

const rtdb = vi.hoisted(() => {
  const ref = { transaction: vi.fn() };
  const database = { ref: vi.fn(() => ref) };
  return { ref, database };
});

vi.mock('firebase-admin/database', () => ({
  getDatabase: () => rtdb.database,
}));

import EventNotification from '../EventNotification';
import * as Constants from '../../../firestore-core/Constants';

const BUSINESS_ID = 'biz-1';
const EVENT_ID = '0d1c1b2a-3f4e-5d6c-7b8a-9e0f1a2b3c4d';

beforeEach(() => {
  vi.clearAllMocks();
  rtdb.database.ref.mockImplementation(() => rtdb.ref);
});

describe('EventNotification (legacy RTDB gate — coexistence pin)', () => {
  it('EventNotification still writes /private/notifications/{businessId}_{Id}', async () => {
    const notification = new EventNotification(
      BUSINESS_ID,
      Constants.Provider.square,
      'order.updated',
      EVENT_ID,
    );

    notification.refPath();
    expect(rtdb.database.ref).toHaveBeenCalledWith(
      `/private/notifications/${BUSINESS_ID}_${EVENT_ID}`,
    );

    // The same key is used by init(), which is what the dual-write and the rollback share.
    rtdb.ref.transaction.mockImplementation(
      (_update: TransactionUpdate, callback: TransactionCallback) => callback(null, true, null),
    );
    await notification.init();
    expect(rtdb.database.ref).toHaveBeenLastCalledWith(
      `/private/notifications/${BUSINESS_ID}_${EVENT_ID}`,
    );
  });

  it('val() returns exactly { provider, type, meta, created }', () => {
    const created = new Date('2026-08-16T12:00:00.000Z');
    const meta = { orderId: 'ORDER_1' };
    const notification = new EventNotification(
      BUSINESS_ID,
      Constants.Provider.square,
      'order.updated',
      EVENT_ID,
      meta,
      created,
    );

    const value = notification.val();

    expect(Object.keys(value).sort()).toEqual(['created', 'meta', 'provider', 'type']);
    expect(value).toEqual({
      provider: Constants.Provider.square,
      type: 'order.updated',
      meta,
      created,
    });
    // Neither the tenant nor the event id is in the value — both live in the key.
    expect(value).not.toHaveProperty('businessId');
    expect(value).not.toHaveProperty('Id');

    // `meta` defaults to null (not undefined — RTDB would drop the field).
    const withoutMeta = new EventNotification(
      BUSINESS_ID,
      Constants.Provider.square,
      'order.updated',
      EVENT_ID,
    );
    expect(withoutMeta.val().meta).toBeNull();
  });

  it('isNew is true when the RTDB transaction commits, false when it aborts', async () => {
    // Commit: the node did not exist, so the update function returns the value to write.
    let written: unknown;
    rtdb.ref.transaction.mockImplementation(
      (update: TransactionUpdate, callback: TransactionCallback) => {
        written = update(null);
        callback(null, true, null);
      },
    );

    const fresh = new EventNotification(
      BUSINESS_ID,
      Constants.Provider.square,
      'order.updated',
      EVENT_ID,
      null,
      new Date('2026-08-16T12:00:00.000Z'),
    );
    await fresh.init();

    expect(fresh.isNew).toBe(true);
    expect(written).toEqual({
      provider: 'square',
      type: 'order.updated',
      meta: null,
      created: '2026-08-16T12:00:00.000Z',
    });

    // Abort: the node already exists, so the update function returns undefined and the
    // existing value is read back. This is the "already seen" gate the claim primitive
    // replaces, and the reason the dual-write is idempotent on `resumed`.
    const existing = {
      provider: 'square',
      type: 'order.created',
      meta: { fromNode: true },
      created: '2026-08-15T00:00:00.000Z',
    };
    let aborted: unknown = 'not-called';
    rtdb.ref.transaction.mockImplementation(
      (update: TransactionUpdate, callback: TransactionCallback) => {
        aborted = update(existing);
        callback(null, false, { val: () => existing });
      },
    );

    const duplicate = new EventNotification(
      BUSINESS_ID,
      Constants.Provider.square,
      'order.updated',
      EVENT_ID,
    );
    await duplicate.init();

    expect(duplicate.isNew).toBe(false);
    expect(aborted).toBeUndefined();
    // On abort the instance is hydrated from the stored node, not from its own arguments.
    expect(duplicate.type).toBe('order.created');
    expect(duplicate.meta).toEqual({ fromNode: true });
    expect(duplicate.created).toBe('2026-08-15T00:00:00.000Z');
  });

  it('init() rejects when the RTDB transaction reports an error', async () => {
    const failure = new Error('RTDB unavailable');
    rtdb.ref.transaction.mockImplementation(
      (_update: TransactionUpdate, callback: TransactionCallback) => callback(failure, false, null),
    );

    const notification = new EventNotification(
      BUSINESS_ID,
      Constants.Provider.square,
      'order.updated',
      EVENT_ID,
    );

    // This is exactly the failure `WebhookClaim`'s dual-write catches and swallows.
    await expect(notification.init()).rejects.toBe(failure);
    expect(notification.isNew).toBeNull();
  });
});
