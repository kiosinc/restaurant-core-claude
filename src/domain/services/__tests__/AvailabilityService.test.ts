import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getAvailability,
  setProductAvailability,
  setOptionAvailability,
  setProductAvailabilityBatch,
  updateAvailability,
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
          options: { 'opt-1': { isAvailable: true, count: 5, state: 'IN_STOCK', timestamp: '2024-01-01T00:00:00Z' } },
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

  describe('setProductAvailability', () => {
    it('writes with merge and dot-notation path', async () => {
      await setProductAvailability('biz-1', 'loc-1', 'prod-1', { isAvailable: true });

      expect(mockDocSet).toHaveBeenCalledWith(
        { 'products.prod-1': { isAvailable: true } },
        { merge: true },
      );
    });
  });

  describe('setOptionAvailability', () => {
    it('writes with merge and dot-notation path', async () => {
      await setOptionAvailability('biz-1', 'loc-1', 'opt-1', {
        isAvailable: true,
        count: 10,
        state: 'IN_STOCK',
        timestamp: '2024-01-01T00:00:00Z',
      });

      expect(mockDocSet).toHaveBeenCalledWith(
        {
          'options.opt-1': {
            isAvailable: true,
            count: 10,
            state: 'IN_STOCK',
            timestamp: '2024-01-01T00:00:00Z',
          },
        },
        { merge: true },
      );
    });
  });

  describe('setProductAvailabilityBatch', () => {
    it('writes multiple products with merge', async () => {
      await setProductAvailabilityBatch('biz-1', 'loc-1', {
        'prod-1': { isAvailable: true },
        'prod-2': { isAvailable: false },
      });

      expect(mockDocSet).toHaveBeenCalledWith(
        {
          'products.prod-1': { isAvailable: true },
          'products.prod-2': { isAvailable: false },
        },
        { merge: true },
      );
    });
  });

  describe('updateAvailability', () => {
    it('writes products and options in a single merge', async () => {
      await updateAvailability('biz-1', 'loc-1', {
        products: { 'prod-1': { isAvailable: true } },
        options: { 'opt-1': { isAvailable: true, count: 5, state: 'IN_STOCK', timestamp: '2024-01-01T00:00:00Z' } },
      });

      expect(mockDocSet).toHaveBeenCalledWith(
        {
          'products.prod-1': { isAvailable: true },
          'options.opt-1': { isAvailable: true, count: 5, state: 'IN_STOCK', timestamp: '2024-01-01T00:00:00Z' },
        },
        { merge: true },
      );
    });

    it('writes only products when options not provided', async () => {
      await updateAvailability('biz-1', 'loc-1', {
        products: { 'prod-1': { isAvailable: false } },
      });

      expect(mockDocSet).toHaveBeenCalledWith(
        { 'products.prod-1': { isAvailable: false } },
        { merge: true },
      );
    });

    it('does not call set when updates are empty', async () => {
      await updateAvailability('biz-1', 'loc-1', {});

      expect(mockDocSet).not.toHaveBeenCalled();
    });
  });
});
