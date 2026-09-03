/**
 * Unit tests for the P41 entries repository (rcc#163, contract rcc#162 §1).
 *
 * Mocking strategy mirrors `WebhookClaim.test.ts`: a `vi.hoisted` in-memory double replaces only
 * `getFirestore`, so the REAL `FieldValue` / `Timestamp` are in play — every "updatedAt is the
 * server-timestamp sentinel" assertion is `FieldValue.serverTimestamp().isEqual(...)` on a genuine
 * sentinel. `PathResolver` is mocked wholesale so `entryRef` resolves to the double's refs.
 *
 * The double memoises one ref per path (unlike the shared `mockFirestore.ts`, which mints a fresh
 * ref per call), so per-ref `set` spies ARE meaningful here. Merge is shallow, which is exact for
 * this all-scalar document. `runTransaction` returns the callback's value, like the SDK.
 *
 * What this file proves about the transaction is only that nothing is QUEUED on a skip. Real
 * transactional semantics — contention retry, an abort with zero committed writes, server
 * timestamp materialisation — belong to the emulator lifecycle suite (rcc#164).
 */
import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';
import type { Mock } from 'vitest';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import {
  entryRef,
  isDefaultEntry,
  setEntry,
  setEntryCountGuarded,
  getEntries,
  deleteEntries,
  GET_ENTRIES_CHUNK,
  DELETE_ENTRIES_CHUNK,
  UNTRACKED_COUNT,
} from '../AvailabilityEntryService';
import type {
  AvailabilityEntry,
  AvailabilityEntryWrite,
  AvailabilityCountWrite,
} from '../AvailabilityEntryService';
import { PathResolver } from '../../../persistence/firestore/PathResolver';
import { ValidationError } from '../../validation';
import { undefinedPaths } from '../../__tests__/helpers/undefinedPaths';

// --- double -----------------------------------------------------------------------------

type Payload = Record<string, unknown>;
type MergeOptions = { merge?: boolean } | undefined;

interface FakeRef {
  path: string;
  id: string;
  set: Mock<(data: Payload, options?: MergeOptions) => Promise<void>>;
  update: Mock<(data: Payload) => Promise<void>>;
  delete: Mock<() => Promise<void>>;
}

interface FakeSnapshot {
  id: string;
  exists: boolean;
  data: () => Payload | undefined;
  ref: FakeRef;
}

interface FakeBatch {
  delete: Mock<(ref: FakeRef) => void>;
  commit: Mock<() => Promise<void>>;
}

const fx = vi.hoisted(() => {
  const store = new Map<string, Payload>();
  const refs = new Map<string, FakeRef>();
  const batches: FakeBatch[] = [];

  const pathOf = (businessId: string, locationId: string, entityId: string): string =>
    `businesses/${businessId}/public/catalog/inventory/${locationId}/entries/${entityId}`;

  const applySet = (path: string, data: Payload, options: MergeOptions): void => {
    const existing = options?.merge ? store.get(path) : undefined;
    store.set(path, { ...existing, ...data });
  };

  const snapshotOf = (ref: FakeRef): FakeSnapshot => {
    const data = store.get(ref.path);
    return {
      id: ref.id,
      exists: data !== undefined,
      data: () => (data ? { ...data } : undefined),
      ref,
    };
  };

  const ref = (businessId: string, locationId: string, entityId: string): FakeRef => {
    const path = pathOf(businessId, locationId, entityId);
    const existing = refs.get(path);
    if (existing) return existing;
    const created: FakeRef = {
      path,
      id: entityId,
      set: vi.fn(async (data: Payload, options?: MergeOptions) => applySet(path, data, options)),
      update: vi.fn(async () => undefined),
      delete: vi.fn(async () => undefined),
    };
    refs.set(path, created);
    return created;
  };

  const tx = {
    get: vi.fn(async (r: FakeRef): Promise<FakeSnapshot> => snapshotOf(r)),
    set: vi.fn((r: FakeRef, data: Payload, options?: MergeOptions): void => applySet(r.path, data, options)),
    update: vi.fn(),
    delete: vi.fn(),
  };

  const collectionPathOf = (businessId: string, locationId: string): string =>
    `businesses/${businessId}/public/catalog/inventory/${locationId}/entries`;

  const db = {
    runTransaction: vi.fn(async <T>(fn: (t: typeof tx) => Promise<T>): Promise<T> => fn(tx)),
    getAll: vi.fn(async (...targets: FakeRef[]): Promise<FakeSnapshot[]> => targets.map(snapshotOf)),
    batch: vi.fn((): FakeBatch => {
      const deleted: string[] = [];
      const batch: FakeBatch = {
        delete: vi.fn((r: FakeRef) => { deleted.push(r.path); }),
        commit: vi.fn(async () => { deleted.forEach((path) => store.delete(path)); }),
      };
      batches.push(batch);
      return batch;
    }),
  };

  return {
    store, refs, batches, pathOf, collectionPathOf, ref, tx, db,
  };
});

vi.mock('firebase-admin/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase-admin/firestore')>();
  return { ...actual, getFirestore: () => fx.db };
});

vi.mock('../../../persistence/firestore/PathResolver', () => ({
  PathResolver: {
    inventoryEntryDoc: vi.fn((businessId: string, locationId: string, entityId: string) =>
      fx.ref(businessId, locationId, entityId)),
    inventoryEntriesCollection: vi.fn((businessId: string, locationId: string) =>
      ({ path: fx.collectionPathOf(businessId, locationId) })),
  },
}));

// --- fixtures ---------------------------------------------------------------------------

const B = 'biz-1';
const L = 'loc-1';
const E = 'ent-1';
const PATH = fx.pathOf(B, L, E);

/** Two instants an hour apart; `T_OLD` < `T_NEW`. */
const T_OLD = '2026-09-01T10:00:00.000Z';
const T_NEW = '2026-09-01T11:00:00.000Z';

const countWrite = (overrides: Partial<AvailabilityCountWrite> = {}): AvailabilityCountWrite => ({
  state: 'inStock', count: 3, timestamp: T_NEW, ...overrides,
});

const isServerTimestamp = (value: unknown): boolean =>
  FieldValue.serverTimestamp().isEqual(value as FieldValue);

const setPayload = (ref: FakeRef): { payload: Payload; options: MergeOptions } => {
  expect(ref.set).toHaveBeenCalledTimes(1);
  const [payload, options] = ref.set.mock.calls[0];
  return { payload, options };
};

const txSetPayload = (): { payload: Payload; options: MergeOptions } => {
  expect(fx.tx.set).toHaveBeenCalledTimes(1);
  const [, payload, options] = fx.tx.set.mock.calls[0];
  return { payload, options };
};

const expectNothingQueued = (): void => {
  expect(fx.tx.set).not.toHaveBeenCalled();
  expect(fx.tx.update).not.toHaveBeenCalled();
  expect(fx.tx.delete).not.toHaveBeenCalled();
};

beforeEach(() => {
  vi.clearAllMocks();
  fx.store.clear();
  fx.refs.clear();
  fx.batches.length = 0;
});

// --- tests ------------------------------------------------------------------------------

describe('AvailabilityEntryService (#163)', () => {
  describe('entryRef', () => {
    it('entryRef delegates to PathResolver.inventoryEntryDoc with (businessId, locationId, entityId)', () => {
      const ref = entryRef(B, L, E);
      expect(vi.mocked(PathResolver.inventoryEntryDoc)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(PathResolver.inventoryEntryDoc)).toHaveBeenCalledWith(B, L, E);
      expect(ref).toBe(fx.ref(B, L, E));
    });
  });

  describe('isDefaultEntry', () => {
    it.each<[string, Partial<AvailabilityEntry>, boolean]>([
      // Every optional field absent → default, for both kinds.
      ['bare {kind: option} is default', { kind: 'option' }, true],
      ['bare {kind: product} is default', { kind: 'product' }, true],
      ['isPresent true → default', { kind: 'product', isPresent: true }, true],
      ['isPresent false → not default', { kind: 'product', isPresent: false }, false],
      ['state inStock → default', { kind: 'option', state: 'inStock' }, true],
      ['state soldOut → not default', { kind: 'option', state: 'soldOut' }, false],
      ['isHidden false → default', { kind: 'product', isHidden: false }, true],
      ['isHidden true → not default', { kind: 'product', isHidden: true }, false],
      ['count UNTRACKED_COUNT (-1) → default', { kind: 'option', count: UNTRACKED_COUNT }, true],
      ['count 0 → not default', { kind: 'option', count: 0 }, false],
      ['count 3 → not default', { kind: 'option', count: 3 }, false],
      ['isInventoryTracked true → default', { kind: 'option', isInventoryTracked: true }, true],
      ['isInventoryTracked false → not default', { kind: 'option', isInventoryTracked: false }, false],
    ])('%s', (_label, entry, expected) => {
      expect(isDefaultEntry(entry)).toBe(expected);
    });

    it('UNTRACKED_COUNT is the contract sentinel -1', () => {
      expect(UNTRACKED_COUNT).toBe(-1);
    });

    it('kind, timestamp and updatedAt never affect defaultness', () => {
      expect(isDefaultEntry({ kind: 'option', timestamp: T_NEW })).toBe(true);
      expect(isDefaultEntry({ kind: 'option', updatedAt: Timestamp.now() })).toBe(true);
      expect(isDefaultEntry({ kind: 'option', timestamp: T_NEW, updatedAt: Timestamp.now(), count: -1, state: 'inStock' })).toBe(true);
      // The non-default signal is what flips it, not the bookkeeping fields around it.
      expect(isDefaultEntry({ kind: 'option', timestamp: T_NEW, updatedAt: Timestamp.now(), count: 0 })).toBe(false);
    });

    it('strict comparisons — null count and 0 are not "absent"', () => {
      expect(isDefaultEntry({ kind: 'option', count: null as unknown as number })).toBe(false);
      expect(isDefaultEntry({ kind: 'option', count: 0 })).toBe(false);
      // Likewise a null flag is a stored value, not the absent default.
      expect(isDefaultEntry({ kind: 'option', isPresent: null as unknown as boolean })).toBe(true);
      expect(isDefaultEntry({ kind: 'option', isInventoryTracked: null as unknown as boolean })).toBe(true);
    });
  });

  describe('setEntry', () => {
    it('issues a single set() with { merge: true } and never update()', async () => {
      await setEntry(B, L, E, { kind: 'product', isPresent: false });
      const ref = fx.ref(B, L, E);
      const { options } = setPayload(ref);
      expect(options).toEqual({ merge: true });
      expect(ref.update).not.toHaveBeenCalled();
      expect(ref.delete).not.toHaveBeenCalled();
    });

    it('adds updatedAt as the FieldValue.serverTimestamp() sentinel', async () => {
      await setEntry(B, L, E, { kind: 'product', isPresent: false });
      const { payload } = setPayload(fx.ref(B, L, E));
      expect(isServerTimestamp(payload.updatedAt)).toBe(true);
    });

    it("payload contains only the caller's owned fields plus updatedAt — no isAvailable even when a JS caller passes one", async () => {
      const untyped = { kind: 'product', isPresent: false, isAvailable: false } as unknown as AvailabilityEntryWrite;
      await setEntry(B, L, E, untyped);
      const { payload } = setPayload(fx.ref(B, L, E));
      expect(Object.keys(payload).sort()).toEqual(['isPresent', 'kind', 'updatedAt']);
      expect(payload).not.toHaveProperty('isAvailable');
    });

    it('ignores a caller-supplied updatedAt', async () => {
      const stale = Timestamp.fromMillis(0);
      const untyped = { kind: 'option', count: -1, updatedAt: stale } as unknown as AvailabilityEntryWrite;
      await setEntry(B, L, E, untyped);
      const { payload } = setPayload(fx.ref(B, L, E));
      expect(payload.updatedAt).not.toBe(stale);
      expect(isServerTimestamp(payload.updatedAt)).toBe(true);
    });

    it('strips undefined keys', async () => {
      await setEntry(B, L, E, { kind: 'option', state: undefined, count: 3, isHidden: undefined });
      const { payload } = setPayload(fx.ref(B, L, E));
      expect(undefinedPaths(payload)).toEqual([]);
      expect(Object.keys(payload).sort()).toEqual(['count', 'kind', 'updatedAt']);
    });

    it('creates the document when it does not exist', async () => {
      expect(fx.store.has(PATH)).toBe(false);
      await setEntry(B, L, E, { kind: 'option', isInventoryTracked: false });
      expect(fx.store.get(PATH)).toMatchObject({ kind: 'option', isInventoryTracked: false });
    });

    it('merges onto an existing document without touching unrelated owned fields', async () => {
      fx.store.set(PATH, { kind: 'option', isPresent: false, count: 5, state: 'inStock' });
      await setEntry(B, L, E, { kind: 'option', isHidden: true });
      const { payload } = setPayload(fx.ref(B, L, E));
      expect(Object.keys(payload).sort()).toEqual(['isHidden', 'kind', 'updatedAt']);
      expect(fx.store.get(PATH)).toMatchObject({
        kind: 'option', isPresent: false, count: 5, state: 'inStock', isHidden: true,
      });
    });

    it('persists isInventoryTracked: false and count: -1 as real values', async () => {
      await setEntry(B, L, E, { kind: 'option', isInventoryTracked: false, count: -1 });
      const { payload } = setPayload(fx.ref(B, L, E));
      expect(payload.isInventoryTracked).toBe(false);
      expect(payload.count).toBe(-1);
      expect(fx.store.get(PATH)).toMatchObject({ isInventoryTracked: false, count: -1 });
    });

    // Domain validation runs before any ref is minted. The count domain itself is proven in
    // validation.test.ts; these rows prove delegation plus the cases specific to this writer.
    it.each<[string, Record<string, unknown>, string]>([
      ['count 1.5', { kind: 'option', count: 1.5 }, 'count'],
      ['count null', { kind: 'option', count: null }, 'count'],
      ['kind missing', { isPresent: false }, 'kind'],
      ['kind undefined', { kind: undefined, isPresent: false }, 'kind'],
      ["kind 'ITEM_VARIATION'", { kind: 'ITEM_VARIATION' }, 'kind'],
      ["state 'SOLD_OUT'", { kind: 'option', state: 'SOLD_OUT' }, 'state'],
      ['state null', { kind: 'option', state: null }, 'state'],
      ['isPresent null', { kind: 'product', isPresent: null }, 'isPresent'],
      ['isInventoryTracked null', { kind: 'option', isInventoryTracked: null }, 'isInventoryTracked'],
      ["isHidden 'true'", { kind: 'product', isHidden: 'true' }, 'isHidden'],
      ['timestamp as a Date', { kind: 'option', timestamp: new Date(T_NEW) }, 'timestamp'],
      ['timestamp unparseable', { kind: 'option', timestamp: 'yesterday-ish' }, 'timestamp'],
    ])('rejects %s with a ValidationError before any RPC', async (_label, write, field) => {
      const failure = await setEntry(B, L, E, write as unknown as AvailabilityEntryWrite).catch((e: unknown) => e);
      expect(failure).toBeInstanceOf(ValidationError);
      expect((failure as ValidationError).field).toBe(field);
      expect(fx.refs.size).toBe(0);
    });

    it('accepts every valid value, including a timestamp string', async () => {
      await setEntry(B, L, E, {
        kind: 'option', isPresent: true, state: 'soldOut', count: 0, isInventoryTracked: true, isHidden: false, timestamp: T_NEW,
      });
      expect(fx.store.get(PATH)).toMatchObject({
        kind: 'option', isPresent: true, state: 'soldOut', count: 0, isInventoryTracked: true, isHidden: false, timestamp: T_NEW,
      });
    });
  });

  describe('setEntryCountGuarded', () => {
    it('reads the entry inside the transaction before writing (tx.get precedes tx.set)', async () => {
      await setEntryCountGuarded(B, L, E, countWrite());
      expect(fx.db.runTransaction).toHaveBeenCalledTimes(1);
      expect(fx.tx.get).toHaveBeenCalledTimes(1);
      expect(fx.tx.get.mock.calls[0][0]).toBe(fx.ref(B, L, E));
      expect(fx.tx.set).toHaveBeenCalledTimes(1);
      expect(fx.tx.get.mock.invocationCallOrder[0]).toBeLessThan(fx.tx.set.mock.invocationCallOrder[0]);
    });

    it("writes nothing when the stored entry has isInventoryTracked: false and returns 'skippedUntracked'", async () => {
      fx.store.set(PATH, { kind: 'option', isInventoryTracked: false, count: -1 });
      await expect(setEntryCountGuarded(B, L, E, countWrite())).resolves.toBe('skippedUntracked');
      expectNothingQueued();
      expect(fx.store.get(PATH)).toEqual({ kind: 'option', isInventoryTracked: false, count: -1 });
    });

    it('treats an absent isInventoryTracked as tracked and writes', async () => {
      fx.store.set(PATH, { kind: 'option', count: -1 });
      await expect(setEntryCountGuarded(B, L, E, countWrite())).resolves.toBe('written');
      expect(fx.tx.set).toHaveBeenCalledTimes(1);
      expect(fx.store.get(PATH)).toMatchObject({ state: 'inStock', count: 3, timestamp: T_NEW });
    });

    it('treats isInventoryTracked: true as tracked and writes', async () => {
      fx.store.set(PATH, { kind: 'option', isInventoryTracked: true });
      await expect(setEntryCountGuarded(B, L, E, countWrite())).resolves.toBe('written');
      expect(fx.tx.set).toHaveBeenCalledTimes(1);
      expect(fx.store.get(PATH)).toMatchObject({ isInventoryTracked: true, count: 3 });
    });

    it("aborts silently when the stored timestamp is newer → 'skippedStale', zero writes", async () => {
      fx.store.set(PATH, { kind: 'option', count: 9, timestamp: T_NEW });
      await expect(setEntryCountGuarded(B, L, E, countWrite({ timestamp: T_OLD }))).resolves.toBe('skippedStale');
      expectNothingQueued();
      expect(fx.store.get(PATH)).toEqual({ kind: 'option', count: 9, timestamp: T_NEW });
    });

    it('aborts when the stored timestamp equals the incoming one (>=)', async () => {
      fx.store.set(PATH, { kind: 'option', count: 9, timestamp: T_NEW });
      await expect(setEntryCountGuarded(B, L, E, countWrite({ timestamp: T_NEW }))).resolves.toBe('skippedStale');
      expectNothingQueued();
    });

    it('compares instants, not strings (+00:00 vs .000Z)', async () => {
      // Same instant, two spellings: string order says "+00:00" > ".000Z"-less form; instants say equal → stale.
      fx.store.set(PATH, { kind: 'option', timestamp: '2026-09-01T11:00:00+00:00' });
      await expect(setEntryCountGuarded(B, L, E, countWrite({ timestamp: '2026-09-01T11:00:00.000Z' }))).resolves.toBe('skippedStale');
      expectNothingQueued();

      // Stored 12:00 at +02:00 is 10:00Z. As STRINGS "12:00" > "11:00" would call the incoming 11:00Z
      // stale; as instants 10:00Z < 11:00Z, so the write must proceed.
      fx.store.set(PATH, { kind: 'option', timestamp: '2026-09-01T12:00:00+02:00' });
      await expect(setEntryCountGuarded(B, L, E, countWrite({ timestamp: '2026-09-01T11:00:00.000Z' }))).resolves.toBe('written');
      expect(fx.tx.set).toHaveBeenCalledTimes(1);
    });

    it('proceeds when the stored timestamp is absent', async () => {
      fx.store.set(PATH, { kind: 'option', count: -1 });
      await expect(setEntryCountGuarded(B, L, E, countWrite())).resolves.toBe('written');
      expect(fx.tx.set).toHaveBeenCalledTimes(1);
    });

    it('proceeds when the stored timestamp is unparseable', async () => {
      fx.store.set(PATH, { kind: 'option', timestamp: 'not-a-date' });
      await expect(setEntryCountGuarded(B, L, E, countWrite())).resolves.toBe('written');
      expect(fx.tx.set).toHaveBeenCalledTimes(1);
      expect(fx.store.get(PATH)).toMatchObject({ timestamp: T_NEW });
    });

    it("creates the document when missing, stamping kind: 'option' by default", async () => {
      expect(fx.store.has(PATH)).toBe(false);
      await expect(setEntryCountGuarded(B, L, E, countWrite())).resolves.toBe('written');
      const { payload, options } = txSetPayload();
      expect(payload.kind).toBe('option');
      expect(options).toEqual({ merge: true });
      expect(fx.store.get(PATH)).toMatchObject({ kind: 'option', state: 'inStock', count: 3, timestamp: T_NEW });
    });

    it('honours an explicit kind on create', async () => {
      await expect(setEntryCountGuarded(B, L, E, countWrite({ kind: 'product' }))).resolves.toBe('written');
      const { payload } = txSetPayload();
      expect(payload.kind).toBe('product');
    });

    it('does not overwrite the kind of an existing document', async () => {
      fx.store.set(PATH, { kind: 'product', isPresent: true });
      await expect(setEntryCountGuarded(B, L, E, countWrite({ kind: 'option' }))).resolves.toBe('written');
      const { payload } = txSetPayload();
      expect(payload).not.toHaveProperty('kind');
      expect(fx.store.get(PATH)).toMatchObject({ kind: 'product', isPresent: true, count: 3 });
    });

    it('stamps kind onto an existing document that has none (a Remy toggle creates entries without kind)', async () => {
      fx.store.set(PATH, { state: 'soldOut', timestamp: T_OLD, isHidden: false });
      await expect(setEntryCountGuarded(B, L, E, countWrite())).resolves.toBe('written');
      const { payload } = txSetPayload();
      expect(payload.kind).toBe('option');
      expect(fx.store.get(PATH)).toMatchObject({ kind: 'option', state: 'inStock', count: 3, timestamp: T_NEW, isHidden: false });
    });

    it('merges exactly {state, count, timestamp, updatedAt} via tx.set(..., { merge: true }), never tx.update()', async () => {
      fx.store.set(PATH, { kind: 'option', isPresent: false, isHidden: true });
      await expect(setEntryCountGuarded(B, L, E, countWrite({ state: 'soldOut', count: 0 }))).resolves.toBe('written');
      const { payload, options } = txSetPayload();
      expect(Object.keys(payload).sort()).toEqual(['count', 'state', 'timestamp', 'updatedAt']);
      expect(payload).toMatchObject({ state: 'soldOut', count: 0, timestamp: T_NEW });
      expect(isServerTimestamp(payload.updatedAt)).toBe(true);
      expect(undefinedPaths(payload)).toEqual([]);
      expect(options).toEqual({ merge: true });
      expect(fx.tx.set.mock.calls[0][0]).toBe(fx.ref(B, L, E));
      expect(fx.tx.update).not.toHaveBeenCalled();
      expect(fx.tx.delete).not.toHaveBeenCalled();
      // The other writers' fields survive the merge.
      expect(fx.store.get(PATH)).toMatchObject({ kind: 'option', isPresent: false, isHidden: true });
    });

    it.each<[string, unknown]>([
      ['missing', undefined],
      ['empty', ''],
      ['unparseable', 'yesterday-ish'],
      ['a number', 1756724400000],
    ])('throws a ValidationError before any RPC when timestamp is %s (runTransaction not called)', async (_label, timestamp) => {
      const write = { ...countWrite(), timestamp } as unknown as AvailabilityCountWrite;
      // The same error class as the count/state checks: the gateway maps ValidationError to
      // "terminal caller bug, do not retry", and a bare Error would be retried as transient.
      const failure = await setEntryCountGuarded(B, L, E, write).catch((e: unknown) => e);
      expect(failure).toBeInstanceOf(ValidationError);
      expect((failure as ValidationError).field).toBe('timestamp');
      expect((failure as Error).message).toMatch(/must be an ISO-8601 string/);
      expect(fx.db.runTransaction).not.toHaveBeenCalled();
      expect(fx.refs.size).toBe(0);
    });

    it.each<[string, Partial<Record<keyof AvailabilityCountWrite, unknown>>, string]>([
      ['count 2.5', { count: 2.5 }, 'count'],
      ["state 'SOLD_OUT'", { state: 'SOLD_OUT' }, 'state'],
      ['state undefined', { state: undefined }, 'state'],
      ["kind 'ITEM_VARIATION'", { kind: 'ITEM_VARIATION' }, 'kind'],
    ])('rejects %s with a ValidationError before any RPC', async (_label, overrides, field) => {
      const write = { ...countWrite(), ...overrides } as unknown as AvailabilityCountWrite;
      const failure = await setEntryCountGuarded(B, L, E, write).catch((e: unknown) => e);
      expect(failure).toBeInstanceOf(ValidationError);
      expect((failure as ValidationError).field).toBe(field);
      expect(fx.db.runTransaction).not.toHaveBeenCalled();
    });

    it('propagates a transaction rejection', async () => {
      const failure = new Error('ABORTED: contention');
      fx.db.runTransaction.mockRejectedValueOnce(failure);
      await expect(setEntryCountGuarded(B, L, E, countWrite())).rejects.toBe(failure);
    });

    it('checks trackedness before staleness', async () => {
      // Both guards would fire; the untracked one must win, so the outcome names it.
      fx.store.set(PATH, { kind: 'option', isInventoryTracked: false, timestamp: T_NEW });
      await expect(setEntryCountGuarded(B, L, E, countWrite({ timestamp: T_OLD }))).resolves.toBe('skippedUntracked');
      expectNothingQueued();
    });
  });

  describe('getEntries', () => {
    it('empty id list → empty Map, no RPC', async () => {
      const result = await getEntries(B, L, []);
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
      expect(fx.db.getAll).not.toHaveBeenCalled();
      expect(fx.refs.size).toBe(0);
    });

    it('drops falsy ids and dedupes', async () => {
      const ids = ['a', '', 'a', 'b', undefined as unknown as string, 'b'];
      await getEntries(B, L, ids);
      expect(fx.db.getAll).toHaveBeenCalledTimes(1);
      const requested = fx.db.getAll.mock.calls[0].map((ref) => ref.path);
      expect(requested).toEqual([fx.pathOf(B, L, 'a'), fx.pathOf(B, L, 'b')]);
    });

    it('returns only existing documents keyed by entity id', async () => {
      fx.store.set(fx.pathOf(B, L, 'a'), { kind: 'option', count: 2, timestamp: T_OLD });
      fx.store.set(fx.pathOf(B, L, 'c'), { kind: 'product', isPresent: false });
      const result = await getEntries(B, L, ['a', 'b', 'c']);
      expect([...result.keys()].sort()).toEqual(['a', 'c']);
      expect(result.get('a')).toEqual({ kind: 'option', count: 2, timestamp: T_OLD });
      expect(result.get('c')).toEqual({ kind: 'product', isPresent: false });
      expect(result.has('b')).toBe(false);
    });

    it('GET_ENTRIES_CHUNK + 1 ids → two getAll calls (100 + 1)', async () => {
      expect(GET_ENTRIES_CHUNK).toBe(100);
      const ids = Array.from({ length: GET_ENTRIES_CHUNK + 1 }, (_, i) => `e${i}`);
      ids.forEach((id) => fx.store.set(fx.pathOf(B, L, id), { kind: 'option' }));
      const result = await getEntries(B, L, ids);
      expect(fx.db.getAll).toHaveBeenCalledTimes(2);
      expect(fx.db.getAll.mock.calls[0]).toHaveLength(GET_ENTRIES_CHUNK);
      expect(fx.db.getAll.mock.calls[1]).toHaveLength(1);
      expect(result.size).toBe(GET_ENTRIES_CHUNK + 1);
    });

    it('propagates a getAll rejection', async () => {
      const failure = new Error('UNAVAILABLE');
      fx.db.getAll.mockRejectedValueOnce(failure);
      await expect(getEntries(B, L, ['a'])).rejects.toBe(failure);
    });
  });

  describe('deleteEntries', () => {
    it('empty id list → no RPC', async () => {
      await deleteEntries(B, L, []);
      expect(fx.db.batch).not.toHaveBeenCalled();
      expect(fx.refs.size).toBe(0);
    });

    it('deletes through a WriteBatch, commits once for ≤ 500 ids', async () => {
      ['a', 'b', 'c'].forEach((id) => fx.store.set(fx.pathOf(B, L, id), { kind: 'option' }));
      await deleteEntries(B, L, ['a', 'b', 'c']);
      expect(fx.db.batch).toHaveBeenCalledTimes(1);
      const [batch] = fx.batches;
      expect(batch.delete).toHaveBeenCalledTimes(3);
      expect(batch.delete.mock.calls.map(([ref]) => ref.path)).toEqual(['a', 'b', 'c'].map((id) => fx.pathOf(B, L, id)));
      expect(batch.commit).toHaveBeenCalledTimes(1);
      expect(fx.store.size).toBe(0);
      // Per-ref delete() is never used — a batch is the only delete path.
      fx.refs.forEach((ref) => expect(ref.delete).not.toHaveBeenCalled());
    });

    it('DELETE_ENTRIES_CHUNK + 1 ids → two batches (500 + 1), each committed', async () => {
      expect(DELETE_ENTRIES_CHUNK).toBe(500);
      const ids = Array.from({ length: DELETE_ENTRIES_CHUNK + 1 }, (_, i) => `e${i}`);
      await deleteEntries(B, L, ids);
      expect(fx.db.batch).toHaveBeenCalledTimes(2);
      const [first, second] = fx.batches;
      expect(first.delete).toHaveBeenCalledTimes(DELETE_ENTRIES_CHUNK);
      expect(first.commit).toHaveBeenCalledTimes(1);
      expect(second.delete).toHaveBeenCalledTimes(1);
      expect(second.commit).toHaveBeenCalledTimes(1);
      // Sequential: the first chunk is committed before the second batch is even opened.
      expect(first.commit.mock.invocationCallOrder[0]).toBeLessThan(fx.db.batch.mock.invocationCallOrder[1]);
    });

    it('dedupes ids and tolerates missing documents', async () => {
      fx.store.set(fx.pathOf(B, L, 'a'), { kind: 'option' });
      await expect(deleteEntries(B, L, ['a', 'a', 'missing', 'missing'])).resolves.toBeUndefined();
      const [batch] = fx.batches;
      expect(batch.delete).toHaveBeenCalledTimes(2);
      expect(batch.delete.mock.calls.map(([ref]) => ref.id)).toEqual(['a', 'missing']);
      expect(batch.commit).toHaveBeenCalledTimes(1);
      expect(fx.store.has(fx.pathOf(B, L, 'a'))).toBe(false);
    });

    it('propagates a commit rejection', async () => {
      const failure = new Error('PERMISSION_DENIED');
      fx.db.batch.mockImplementationOnce((): FakeBatch => ({
        delete: vi.fn(),
        commit: vi.fn(async () => { throw failure; }),
      }));
      await expect(deleteEntries(B, L, ['a'])).rejects.toBe(failure);
    });
  });
});
