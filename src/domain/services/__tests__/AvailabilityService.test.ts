import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getAvailability,
  setProductAvailability,
  setOptionAvailability,
  setProductAvailabilityBatch,
  updateAvailability,
  getOptionTimestamp,
} from '../AvailabilityService';

const mockDocGet = vi.fn();
const mockDocSet = vi.fn();
const mockAvailabilityDoc = {
  get: mockDocGet,
  set: mockDocSet,
};

vi.mock('../../../persistence/firestore/PathResolver', () => ({
  PathResolver: {
    availabilityDoc: vi.fn(() => mockAvailabilityDoc),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockDocSet.mockResolvedValue(undefined);
});

describe('AvailabilityService', () => {
  describe('getAvailability', () => {
    it('returns null when doc does not exist', async () => {
      mockDocGet.mockResolvedValue({ exists: false });
      const result = await getAvailability('biz-1', 'loc-1');
      expect(result).toBeNull();
    });

    it('returns availability doc when exists', async () => {
      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({
          products: { 'prod-1': { isAvailable: true } },
          options: { 'opt-1': { isAvailable: true, count: 5, state: 'inStock', timestamp: '2024-01-01T00:00:00Z' } },
        }),
      });

      const result = await getAvailability('biz-1', 'loc-1');
      expect(result).not.toBeNull();
      expect(result!.products['prod-1'].isAvailable).toBe(true);
      expect(result!.options['opt-1'].count).toBe(5);
    });

    it('defaults empty products and options when missing from doc', async () => {
      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({}),
      });

      const result = await getAvailability('biz-1', 'loc-1');
      expect(result).not.toBeNull();
      expect(result!.products).toEqual({});
      expect(result!.options).toEqual({});
    });
  });

  // Regression guard (#70): writers must use a nested-object merge-set, NOT a
  // dotted-key update(). update() throws NOT_FOUND when the doc is absent, and
  // a dotted key in set() creates a flat "options.<id>" field instead of nesting.
  describe('writer semantics (#70 regression)', () => {
    it('merge-sets (upserts) so a missing doc is created', async () => {
      await setOptionAvailability('biz-1', 'loc-1', 'opt-1', {
        isAvailable: true, count: 1, state: 'inStock', timestamp: '2024-01-01T00:00:00Z',
      });
      expect(mockDocSet).toHaveBeenCalledTimes(1);
      expect(mockDocSet.mock.calls[0][1]).toEqual({ merge: true });
    });

    it('nests under options/products via real objects, not dotted keys', async () => {
      await setOptionAvailability('biz-1', 'loc-1', 'opt-1', {
        isAvailable: true, count: 1, state: 'inStock', timestamp: '2024-01-01T00:00:00Z',
      });
      const payload = mockDocSet.mock.calls[0][0];
      expect(payload).toHaveProperty('options');
      expect(payload.options).toHaveProperty('opt-1');
      expect(Object.keys(payload)).not.toContain('options.opt-1');
    });
  });

  describe('setProductAvailability', () => {
    it('merge-sets a nested product entry', async () => {
      await setProductAvailability('biz-1', 'loc-1', 'prod-1', { isAvailable: true });

      expect(mockDocSet).toHaveBeenCalledWith(
        { products: { 'prod-1': { isAvailable: true } } },
        { merge: true },
      );
    });

    it('writes state and timestamp fields when provided', async () => {
      await setProductAvailability('biz-1', 'loc-1', 'prod-1', {
        isAvailable: false,
        state: 'soldOut',
        timestamp: '2024-06-01T09:00:00Z',
      });

      expect(mockDocSet).toHaveBeenCalledWith(
        { products: { 'prod-1': { isAvailable: false, state: 'soldOut', timestamp: '2024-06-01T09:00:00Z' } } },
        { merge: true },
      );
    });
  });

  describe('setOptionAvailability', () => {
    it('merge-sets a nested option entry', async () => {
      await setOptionAvailability('biz-1', 'loc-1', 'opt-1', {
        isAvailable: true,
        count: 10,
        state: 'inStock',
        timestamp: '2024-01-01T00:00:00Z',
      });

      expect(mockDocSet).toHaveBeenCalledWith(
        { options: { 'opt-1': { isAvailable: true, count: 10, state: 'inStock', timestamp: '2024-01-01T00:00:00Z' } } },
        { merge: true },
      );
    });
  });

  describe('setProductAvailabilityBatch', () => {
    it('merge-sets multiple products under products', async () => {
      await setProductAvailabilityBatch('biz-1', 'loc-1', {
        'prod-1': { isAvailable: true },
        'prod-2': { isAvailable: false },
      });

      expect(mockDocSet).toHaveBeenCalledWith(
        { products: { 'prod-1': { isAvailable: true }, 'prod-2': { isAvailable: false } } },
        { merge: true },
      );
    });
  });

  describe('updateAvailability', () => {
    it('merge-sets products and options in a single write', async () => {
      await updateAvailability('biz-1', 'loc-1', {
        products: { 'prod-1': { isAvailable: true } },
        options: { 'opt-1': { isAvailable: true, count: 5, state: 'inStock', timestamp: '2024-01-01T00:00:00Z' } },
      });

      expect(mockDocSet).toHaveBeenCalledWith(
        {
          products: { 'prod-1': { isAvailable: true } },
          options: { 'opt-1': { isAvailable: true, count: 5, state: 'inStock', timestamp: '2024-01-01T00:00:00Z' } },
        },
        { merge: true },
      );
    });

    it('writes only products when options not provided', async () => {
      await updateAvailability('biz-1', 'loc-1', {
        products: { 'prod-1': { isAvailable: false } },
      });

      expect(mockDocSet).toHaveBeenCalledWith(
        { products: { 'prod-1': { isAvailable: false } } },
        { merge: true },
      );
    });

    it('does not write when updates are empty', async () => {
      await updateAvailability('biz-1', 'loc-1', {});

      expect(mockDocSet).not.toHaveBeenCalled();
    });
  });

  describe('getOptionTimestamp', () => {
    it('returns undefined when doc does not exist', async () => {
      mockDocGet.mockResolvedValue({ exists: false });
      const result = await getOptionTimestamp('biz-1', 'loc-1', 'opt-1');
      expect(result).toBeUndefined();
    });

    it('returns undefined when option is not in the doc', async () => {
      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({ options: {} }),
      });
      const result = await getOptionTimestamp('biz-1', 'loc-1', 'opt-missing');
      expect(result).toBeUndefined();
    });

    it('returns a Date when option exists with a timestamp', async () => {
      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({
          options: {
            'opt-1': { isAvailable: true, count: 3, state: 'inStock', timestamp: '2024-06-01T12:00:00Z' },
          },
        }),
      });
      const result = await getOptionTimestamp('biz-1', 'loc-1', 'opt-1');
      expect(result).toEqual(new Date('2024-06-01T12:00:00Z'));
    });

    it('returns undefined when option exists but has no timestamp', async () => {
      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({
          options: {
            'opt-1': { isAvailable: true, count: 3, state: 'inStock' },
          },
        }),
      });
      const result = await getOptionTimestamp('biz-1', 'loc-1', 'opt-1');
      expect(result).toBeUndefined();
    });
  });
});
