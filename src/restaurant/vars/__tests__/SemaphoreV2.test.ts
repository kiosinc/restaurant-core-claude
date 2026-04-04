import { describe, it, expect, vi, beforeEach } from 'vitest';

const SERVER_TIMESTAMP = '$$SERVER_TIMESTAMP$$';
const FIELD_DELETE = '$$FIELD_DELETE$$';

const mockTransaction = {
  get: vi.fn(),
  set: vi.fn(),
};

const mockDocSnapshot = {
  exists: false,
  data: () => undefined as any,
};

const mockDocRef = {
  path: 'semaphores/biz-1_catalog',
  get: vi.fn(async () => mockDocSnapshot),
};

const mockCollectionRef = {
  doc: vi.fn(() => mockDocRef),
};

const mockDb = {
  runTransaction: vi.fn(async (fn: (t: any) => Promise<any>) => fn(mockTransaction)),
};

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => mockDb,
  FieldValue: {
    serverTimestamp: () => SERVER_TIMESTAMP,
    delete: () => FIELD_DELETE,
  },
}));

vi.mock('../../../persistence/firestore/PathResolver', () => ({
  PathResolver: {
    semaphoresCollection: vi.fn(() => mockCollectionRef),
  },
}));

import Semaphore from '../SemaphoreV2';
import { PathResolver } from '../../../persistence/firestore/PathResolver';

describe('SemaphoreV2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDocSnapshot.exists = false;
    mockDocSnapshot.data = () => undefined;
  });

  describe('ref()', () => {
    it('constructs correct Firestore path via PathResolver', () => {
      Semaphore.ref('biz-1', 'catalog');
      expect(PathResolver.semaphoresCollection).toHaveBeenCalledWith();
      expect(mockCollectionRef.doc).toHaveBeenCalledWith('biz-1_catalog');
    });
  });

  describe('lock()', () => {
    it('creates doc with isAvailable: false when doc does not exist', async () => {
      mockTransaction.get.mockResolvedValue({ exists: false, data: () => undefined });

      const result = await Semaphore.lock('biz-1', 'catalog');

      expect(result).toBe(true);
      expect(mockTransaction.set).toHaveBeenCalledWith(
        mockDocRef,
        {
          isAvailable: false,
          updated: SERVER_TIMESTAMP,
          isDeleted: false,
          created: SERVER_TIMESTAMP,
        },
        { merge: true },
      );
    });

    it('acquires lock when isAvailable is true', async () => {
      mockTransaction.get.mockResolvedValue({
        exists: true,
        data: () => ({ isAvailable: true, created: '2024-01-01T00:00:00.000Z' }),
      });

      const result = await Semaphore.lock('biz-1', 'catalog');

      expect(result).toBe(true);
      expect(mockTransaction.set).toHaveBeenCalledWith(
        mockDocRef,
        {
          isAvailable: false,
          updated: SERVER_TIMESTAMP,
          isDeleted: false,
        },
        { merge: true },
      );
      // Should not include created since doc already exists
      const setData = mockTransaction.set.mock.calls[0][1];
      expect(setData).not.toHaveProperty('created');
    });

    it('returns false when lock is already held (isAvailable: false)', async () => {
      mockTransaction.get.mockResolvedValue({
        exists: true,
        data: () => ({ isAvailable: false }),
      });

      const result = await Semaphore.lock('biz-1', 'catalog');

      expect(result).toBe(false);
      expect(mockTransaction.set).not.toHaveBeenCalled();
    });

    it('propagates transaction errors', async () => {
      mockDb.runTransaction.mockRejectedValueOnce(new Error('transaction failed'));

      await expect(Semaphore.lock('biz-1', 'catalog')).rejects.toThrow('transaction failed');
    });

    it('writes heartbeat fields when options.heartbeatTtlMs is provided', async () => {
      mockTransaction.get.mockResolvedValue({ exists: false, data: () => undefined });
      const before = Date.now();

      const result = await Semaphore.lock('biz-1', 'catalog', {
        heartbeatTtlMs: 30000,
        syncTraceId: 'biz-1-123456',
      });

      expect(result).toBe(true);
      const setData = mockTransaction.set.mock.calls[0][1];
      expect(setData.lastHeartbeat).toBe(SERVER_TIMESTAMP);
      expect(setData.heartbeatTtlMs).toBe(30000);
      expect(setData.syncTraceId).toBe('biz-1-123456');
      // expiresAt should be approximately now + 30s
      const expiresAt = setData.expiresAt as Date;
      expect(expiresAt).toBeInstanceOf(Date);
      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + 30000);
      expect(expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 30000);
    });

    it('omits heartbeat fields when no options provided', async () => {
      mockTransaction.get.mockResolvedValue({ exists: false, data: () => undefined });

      await Semaphore.lock('biz-1', 'catalog');

      const setData = mockTransaction.set.mock.calls[0][1];
      expect(setData).not.toHaveProperty('lastHeartbeat');
      expect(setData).not.toHaveProperty('expiresAt');
      expect(setData).not.toHaveProperty('heartbeatTtlMs');
      expect(setData).not.toHaveProperty('syncTraceId');
    });

    it('writes syncTraceId even without heartbeatTtlMs', async () => {
      mockTransaction.get.mockResolvedValue({ exists: false, data: () => undefined });

      await Semaphore.lock('biz-1', 'catalog', { syncTraceId: 'trace-only' });

      const setData = mockTransaction.set.mock.calls[0][1];
      expect(setData.syncTraceId).toBe('trace-only');
      expect(setData).not.toHaveProperty('lastHeartbeat');
      expect(setData).not.toHaveProperty('expiresAt');
      expect(setData).not.toHaveProperty('heartbeatTtlMs');
    });
  });

  describe('release()', () => {
    it('sets isAvailable to true when doc is locked', async () => {
      mockTransaction.get.mockResolvedValue({
        exists: true,
        data: () => ({ isAvailable: false }),
      });

      const result = await Semaphore.release('biz-1', 'catalog');

      expect(result).toBe(true);
      expect(mockTransaction.set).toHaveBeenCalledWith(
        mockDocRef,
        {
          isAvailable: true,
          updated: SERVER_TIMESTAMP,
          isDeleted: false,
          lastHeartbeat: FIELD_DELETE,
          expiresAt: FIELD_DELETE,
          heartbeatTtlMs: FIELD_DELETE,
          syncTraceId: FIELD_DELETE,
        },
        { merge: true },
      );
    });

    it('creates doc with isAvailable: true when doc does not exist', async () => {
      mockTransaction.get.mockResolvedValue({ exists: false, data: () => undefined });

      const result = await Semaphore.release('biz-1', 'catalog');

      expect(result).toBe(true);
      expect(mockTransaction.set).toHaveBeenCalledWith(
        mockDocRef,
        {
          isAvailable: true,
          updated: SERVER_TIMESTAMP,
          isDeleted: false,
          created: SERVER_TIMESTAMP,
          lastHeartbeat: FIELD_DELETE,
          expiresAt: FIELD_DELETE,
          heartbeatTtlMs: FIELD_DELETE,
          syncTraceId: FIELD_DELETE,
        },
        { merge: true },
      );
    });

    it('propagates transaction errors', async () => {
      mockDb.runTransaction.mockRejectedValueOnce(new Error('release failed'));

      await expect(Semaphore.release('biz-1', 'catalog')).rejects.toThrow('release failed');
    });

    it('clears heartbeat fields when releasing a lock', async () => {
      mockTransaction.get.mockResolvedValue({
        exists: true,
        data: () => ({
          isAvailable: false,
          heartbeatTtlMs: 30000,
          syncTraceId: 'trace-1',
          lastHeartbeat: new Date(),
          expiresAt: new Date(),
        }),
      });

      await Semaphore.release('biz-1', 'catalog');

      const setData = mockTransaction.set.mock.calls[0][1];
      expect(setData.lastHeartbeat).toBe(FIELD_DELETE);
      expect(setData.expiresAt).toBe(FIELD_DELETE);
      expect(setData.heartbeatTtlMs).toBe(FIELD_DELETE);
      expect(setData.syncTraceId).toBe(FIELD_DELETE);
    });
  });

  describe('updateHeartbeat()', () => {
    it('extends expiresAt on active lock with matching traceId', async () => {
      mockTransaction.get.mockResolvedValue({
        exists: true,
        data: () => ({
          isAvailable: false,
          heartbeatTtlMs: 30000,
          syncTraceId: 'trace-1',
        }),
      });
      const before = Date.now();

      const result = await Semaphore.updateHeartbeat('biz-1', 'catalog', 'trace-1');

      expect(result).toBe(true);
      const setData = mockTransaction.set.mock.calls[0][1];
      expect(setData.lastHeartbeat).toBe(SERVER_TIMESTAMP);
      expect(setData.updated).toBe(SERVER_TIMESTAMP);
      expect(setData.syncTraceId).toBe('trace-1');
      const expiresAt = setData.expiresAt as Date;
      expect(expiresAt).toBeInstanceOf(Date);
      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + 30000);
    });

    it('returns false when doc does not exist', async () => {
      mockTransaction.get.mockResolvedValue({ exists: false, data: () => undefined });

      const result = await Semaphore.updateHeartbeat('biz-1', 'catalog', 'trace-1');

      expect(result).toBe(false);
      expect(mockTransaction.set).not.toHaveBeenCalled();
    });

    it('returns false when lock is available', async () => {
      mockTransaction.get.mockResolvedValue({
        exists: true,
        data: () => ({ isAvailable: true, heartbeatTtlMs: 30000, syncTraceId: 'trace-1' }),
      });

      const result = await Semaphore.updateHeartbeat('biz-1', 'catalog', 'trace-1');

      expect(result).toBe(false);
      expect(mockTransaction.set).not.toHaveBeenCalled();
    });

    it('returns false when no heartbeatTtlMs on doc', async () => {
      mockTransaction.get.mockResolvedValue({
        exists: true,
        data: () => ({ isAvailable: false, syncTraceId: 'trace-1' }),
      });

      const result = await Semaphore.updateHeartbeat('biz-1', 'catalog', 'trace-1');

      expect(result).toBe(false);
      expect(mockTransaction.set).not.toHaveBeenCalled();
    });

    it('returns false when syncTraceId does not match', async () => {
      mockTransaction.get.mockResolvedValue({
        exists: true,
        data: () => ({ isAvailable: false, heartbeatTtlMs: 30000, syncTraceId: 'trace-other' }),
      });

      const result = await Semaphore.updateHeartbeat('biz-1', 'catalog', 'trace-1');

      expect(result).toBe(false);
      expect(mockTransaction.set).not.toHaveBeenCalled();
    });
  });

  describe('isExpired()', () => {
    it('returns true when expiresAt is in the past', async () => {
      mockDocSnapshot.exists = true;
      mockDocSnapshot.data = () => ({
        isAvailable: false,
        expiresAt: { toDate: () => new Date(Date.now() - 10000) },
      });
      mockDocRef.get.mockResolvedValue(mockDocSnapshot);

      const result = await Semaphore.isExpired('biz-1', 'catalog');

      expect(result).toBe(true);
    });

    it('returns false when expiresAt is in the future', async () => {
      mockDocSnapshot.exists = true;
      mockDocSnapshot.data = () => ({
        isAvailable: false,
        expiresAt: { toDate: () => new Date(Date.now() + 60000) },
      });
      mockDocRef.get.mockResolvedValue(mockDocSnapshot);

      const result = await Semaphore.isExpired('biz-1', 'catalog');

      expect(result).toBe(false);
    });

    it('returns false when doc does not exist', async () => {
      mockDocSnapshot.exists = false;
      mockDocSnapshot.data = () => undefined;
      mockDocRef.get.mockResolvedValue(mockDocSnapshot);

      const result = await Semaphore.isExpired('biz-1', 'catalog');

      expect(result).toBe(false);
    });

    it('returns false when lock is available', async () => {
      mockDocSnapshot.exists = true;
      mockDocSnapshot.data = () => ({
        isAvailable: true,
        expiresAt: { toDate: () => new Date(Date.now() - 10000) },
      });
      mockDocRef.get.mockResolvedValue(mockDocSnapshot);

      const result = await Semaphore.isExpired('biz-1', 'catalog');

      expect(result).toBe(false);
    });

    it('returns false when expiresAt is not set', async () => {
      mockDocSnapshot.exists = true;
      mockDocSnapshot.data = () => ({ isAvailable: false });
      mockDocRef.get.mockResolvedValue(mockDocSnapshot);

      const result = await Semaphore.isExpired('biz-1', 'catalog');

      expect(result).toBe(false);
    });
  });

  describe('forceRelease()', () => {
    it('clears all heartbeat fields and sets isAvailable to true', async () => {
      mockTransaction.get.mockResolvedValue({
        exists: true,
        data: () => ({
          isAvailable: false,
          heartbeatTtlMs: 30000,
          syncTraceId: 'trace-1',
          lastHeartbeat: new Date(),
          expiresAt: new Date(),
        }),
      });

      const result = await Semaphore.forceRelease('biz-1', 'catalog');

      expect(result).toBe(true);
      expect(mockTransaction.set).toHaveBeenCalledWith(
        mockDocRef,
        {
          isAvailable: true,
          updated: SERVER_TIMESTAMP,
          lastHeartbeat: FIELD_DELETE,
          expiresAt: FIELD_DELETE,
          heartbeatTtlMs: FIELD_DELETE,
          syncTraceId: FIELD_DELETE,
        },
        { merge: true },
      );
    });

    it('releases even when lock is already available', async () => {
      mockTransaction.get.mockResolvedValue({
        exists: true,
        data: () => ({ isAvailable: true }),
      });

      const result = await Semaphore.forceRelease('biz-1', 'catalog');

      expect(result).toBe(true);
      expect(mockTransaction.set).toHaveBeenCalled();
    });

    it('returns false when doc does not exist', async () => {
      mockTransaction.get.mockResolvedValue({ exists: false, data: () => undefined });

      const result = await Semaphore.forceRelease('biz-1', 'catalog');

      expect(result).toBe(false);
      expect(mockTransaction.set).not.toHaveBeenCalled();
    });
  });

  describe('releaseIfExpired()', () => {
    it('releases lock when expiresAt is in the past', async () => {
      mockTransaction.get.mockResolvedValue({
        exists: true,
        data: () => ({
          isAvailable: false,
          expiresAt: new Date(Date.now() - 10000),
          heartbeatTtlMs: 30000,
          syncTraceId: 'trace-1',
        }),
      });

      const result = await Semaphore.releaseIfExpired('biz-1', 'catalog');

      expect(result).toBe(true);
      expect(mockTransaction.set).toHaveBeenCalledWith(
        mockDocRef,
        {
          isAvailable: true,
          updated: SERVER_TIMESTAMP,
          lastHeartbeat: FIELD_DELETE,
          expiresAt: FIELD_DELETE,
          heartbeatTtlMs: FIELD_DELETE,
          syncTraceId: FIELD_DELETE,
        },
        { merge: true },
      );
    });

    it('returns false when expiresAt is in the future', async () => {
      mockTransaction.get.mockResolvedValue({
        exists: true,
        data: () => ({
          isAvailable: false,
          expiresAt: new Date(Date.now() + 60000),
        }),
      });

      const result = await Semaphore.releaseIfExpired('biz-1', 'catalog');

      expect(result).toBe(false);
      expect(mockTransaction.set).not.toHaveBeenCalled();
    });

    it('returns false when doc does not exist', async () => {
      mockTransaction.get.mockResolvedValue({ exists: false, data: () => undefined });

      const result = await Semaphore.releaseIfExpired('biz-1', 'catalog');

      expect(result).toBe(false);
      expect(mockTransaction.set).not.toHaveBeenCalled();
    });

    it('returns false when lock is available', async () => {
      mockTransaction.get.mockResolvedValue({
        exists: true,
        data: () => ({ isAvailable: true, expiresAt: new Date(Date.now() - 10000) }),
      });

      const result = await Semaphore.releaseIfExpired('biz-1', 'catalog');

      expect(result).toBe(false);
      expect(mockTransaction.set).not.toHaveBeenCalled();
    });

    it('returns false when expiresAt is not set', async () => {
      mockTransaction.get.mockResolvedValue({
        exists: true,
        data: () => ({ isAvailable: false }),
      });

      const result = await Semaphore.releaseIfExpired('biz-1', 'catalog');

      expect(result).toBe(false);
      expect(mockTransaction.set).not.toHaveBeenCalled();
    });
  });

  describe('firestoreConverter', () => {
    it('round-trips toFirestore → fromFirestore preserving data', () => {
      const original = new Semaphore(
        'catalog',
        false,
        new Date('2024-01-01T00:00:00.000Z'),
        new Date('2024-06-15T12:00:00.000Z'),
        false,
      );

      const firestoreData = Semaphore.firestoreConverter.toFirestore(original);

      expect(firestoreData).toEqual({
        isAvailable: false,
        created: '2024-01-01T00:00:00.000Z',
        updated: '2024-06-15T12:00:00.000Z',
        isDeleted: false,
      });

      const restored = Semaphore.firestoreConverter.fromFirestore(firestoreData, 'catalog');

      expect(restored.isAvailable).toBe(original.isAvailable);
      expect(restored.created.toISOString()).toBe(original.created.toISOString());
      expect(restored.updated.toISOString()).toBe(original.updated.toISOString());
      expect(restored.Id).toBe('catalog');
    });

    it('round-trips heartbeat fields', () => {
      const original = new Semaphore(
        'catalog',
        false,
        new Date('2024-01-01T00:00:00.000Z'),
        new Date('2024-06-15T12:00:00.000Z'),
        false,
        undefined,
        new Date('2024-06-15T12:05:00.000Z'),
        new Date('2024-06-15T12:05:30.000Z'),
        30000,
        'biz-1-123456',
      );

      const firestoreData = Semaphore.firestoreConverter.toFirestore(original);

      expect(firestoreData.lastHeartbeat).toBe('2024-06-15T12:05:00.000Z');
      expect(firestoreData.expiresAt).toBe('2024-06-15T12:05:30.000Z');
      expect(firestoreData.heartbeatTtlMs).toBe(30000);
      expect(firestoreData.syncTraceId).toBe('biz-1-123456');

      const restored = Semaphore.firestoreConverter.fromFirestore(firestoreData, 'catalog');

      expect(restored.lastHeartbeat!.toISOString()).toBe('2024-06-15T12:05:00.000Z');
      expect(restored.expiresAt!.toISOString()).toBe('2024-06-15T12:05:30.000Z');
      expect(restored.heartbeatTtlMs).toBe(30000);
      expect(restored.syncTraceId).toBe('biz-1-123456');
    });

    it('handles missing heartbeat fields gracefully', () => {
      const firestoreData = {
        isAvailable: true,
        created: '2024-01-01T00:00:00.000Z',
        updated: '2024-06-15T12:00:00.000Z',
        isDeleted: false,
      };

      const restored = Semaphore.firestoreConverter.fromFirestore(firestoreData, 'catalog');

      expect(restored.lastHeartbeat).toBeUndefined();
      expect(restored.expiresAt).toBeUndefined();
      expect(restored.heartbeatTtlMs).toBeUndefined();
      expect(restored.syncTraceId).toBeUndefined();
    });
  });
});
