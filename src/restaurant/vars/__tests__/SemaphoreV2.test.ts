import { describe, it, expect, vi, beforeEach } from 'vitest';

const SERVER_TIMESTAMP = '$$SERVER_TIMESTAMP$$';

const mockTransaction = {
  get: vi.fn(),
  set: vi.fn(),
};

const mockDocRef = {
  path: 'businesses/biz-1/private/vars/semaphores/catalog',
};

const mockCollectionRef = {
  doc: vi.fn(() => mockDocRef),
};

const mockDb = {
  runTransaction: vi.fn(async (fn: (t: any) => Promise<void>) => fn(mockTransaction)),
};

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => mockDb,
  FieldValue: { serverTimestamp: () => SERVER_TIMESTAMP },
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
  });

  describe('ref()', () => {
    it('constructs correct Firestore path via PathResolver', () => {
      Semaphore.ref('biz-1', 'catalog');
      expect(PathResolver.semaphoresCollection).toHaveBeenCalledWith('biz-1');
      expect(mockCollectionRef.doc).toHaveBeenCalledWith('catalog');
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
        },
        { merge: true },
      );
    });

    it('propagates transaction errors', async () => {
      mockDb.runTransaction.mockRejectedValueOnce(new Error('release failed'));

      await expect(Semaphore.release('biz-1', 'catalog')).rejects.toThrow('release failed');
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
  });
});
