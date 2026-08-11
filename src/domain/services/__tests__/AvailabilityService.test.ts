import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getAvailability,
  setProductAvailability,
  setOptionAvailability,
  setProductAvailabilityBatch,
  updateAvailability,
  getOptionTimestamp,
  removeOptionAvailability,
  removeProductAvailability,
  deleteAvailabilityDoc,
} from '../AvailabilityService';
import { PathResolver } from '../../../persistence/firestore/PathResolver';

const mockDocGet = vi.fn();
const mockDocSet = vi.fn();
const mockDocUpdate = vi.fn();
const mockDocDelete = vi.fn();
const mockAvailabilityDoc = {
  get: mockDocGet,
  set: mockDocSet,
  update: mockDocUpdate,
  delete: mockDocDelete,
};

vi.mock('../../../persistence/firestore/PathResolver', () => ({
  PathResolver: {
    availabilityDoc: vi.fn(() => mockAvailabilityDoc),
  },
}));

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { delete: () => '$$FIELD_DELETE$$' },
  GrpcStatus: { NOT_FOUND: 5 },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockDocSet.mockResolvedValue(undefined);
  mockDocUpdate.mockResolvedValue(undefined);
  mockDocDelete.mockResolvedValue(undefined);
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

  // #141: count/state/timestamp are optional — catalog sync writes partial
  // entries ({isAvailable} for tracked, {isAvailable, state} for untracked);
  // only the inventory webhook writes all four fields.
  describe('partial OptionAvailability writes (#141)', () => {
    it('accepts and writes an isAvailable-only option entry', async () => {
      await setOptionAvailability('biz-1', 'loc-1', 'opt-1', { isAvailable: true });

      expect(mockDocSet).toHaveBeenCalledWith(
        { options: { 'opt-1': { isAvailable: true } } },
        { merge: true },
      );
    });

    it('accepts and writes an {isAvailable, state} option entry (untracked location)', async () => {
      await setOptionAvailability('biz-1', 'loc-1', 'opt-1', { isAvailable: false, state: 'soldOut' });

      expect(mockDocSet).toHaveBeenCalledWith(
        { options: { 'opt-1': { isAvailable: false, state: 'soldOut' } } },
        { merge: true },
      );
    });

    it('accepts partial option entries through updateAvailability', async () => {
      await updateAvailability('biz-1', 'loc-1', {
        options: { 'opt-1': { isAvailable: true } },
      });

      expect(mockDocSet).toHaveBeenCalledWith(
        { options: { 'opt-1': { isAvailable: true } } },
        { merge: true },
      );
    });

    it('reads back a partial option entry without the optional fields', async () => {
      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({
          options: { 'opt-1': { isAvailable: true } },
        }),
      });

      const result = await getAvailability('biz-1', 'loc-1');
      expect(result!.options['opt-1'].isAvailable).toBe(true);
      expect(result!.options['opt-1'].count).toBeUndefined();
      expect(result!.options['opt-1'].state).toBeUndefined();
      expect(result!.options['opt-1'].timestamp).toBeUndefined();
    });

    it('getOptionTimestamp returns undefined for a partial entry without timestamp', async () => {
      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({
          options: { 'opt-1': { isAvailable: true } },
        }),
      });
      const result = await getOptionTimestamp('biz-1', 'loc-1', 'opt-1');
      expect(result).toBeUndefined();
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

// Removal is the deliberate inversion of the #70 merge-set convention: dotted
// root-level keys + update(), so that pruning a location with no availability
// doc is a no-op instead of materialising an empty document.
describe('entry removal (#133)', () => {
  describe('removeOptionAvailability', () => {
    it('deletes a single option via a root-level dotted field path', async () => {
      await removeOptionAvailability('biz-1', 'loc-1', ['opt-1']);

      expect(mockDocUpdate).toHaveBeenCalledWith({ 'options.opt-1': '$$FIELD_DELETE$$' });
      const payload = mockDocUpdate.mock.calls[0][0];
      expect(Object.keys(payload)).not.toContain('options');
    });

    it('coalesces multiple option ids into exactly one update() call', async () => {
      await removeOptionAvailability('biz-1', 'loc-1', ['opt-1', 'opt-2', 'opt-3']);

      expect(mockDocUpdate).toHaveBeenCalledTimes(1);
      const payload = mockDocUpdate.mock.calls[0][0];
      expect(Object.keys(payload)).toHaveLength(3);
      expect(payload).toEqual({
        'options.opt-1': '$$FIELD_DELETE$$',
        'options.opt-2': '$$FIELD_DELETE$$',
        'options.opt-3': '$$FIELD_DELETE$$',
      });
    });

    it('issues no write when the id list is empty', async () => {
      await expect(removeOptionAvailability('biz-1', 'loc-1', [])).resolves.toBeUndefined();

      expect(mockDocUpdate).not.toHaveBeenCalled();
      expect(mockDocSet).not.toHaveBeenCalled();
    });

    it('resolves silently when the location doc does not exist (NOT_FOUND)', async () => {
      mockDocUpdate.mockRejectedValue(
        Object.assign(new Error('5 NOT_FOUND: no entity to update'), { code: 5 }),
      );

      await expect(removeOptionAvailability('biz-1', 'loc-1', ['opt-1'])).resolves.toBeUndefined();
    });

    it('propagates PERMISSION_DENIED instead of swallowing it', async () => {
      mockDocUpdate.mockRejectedValue(
        Object.assign(new Error('7 PERMISSION_DENIED: missing permissions'), { code: 7 }),
      );

      await expect(removeOptionAvailability('biz-1', 'loc-1', ['opt-1'])).rejects.toThrow('PERMISSION_DENIED');
    });

    it('propagates RESOURCE_EXHAUSTED instead of swallowing it', async () => {
      mockDocUpdate.mockRejectedValue(
        Object.assign(new Error('8 RESOURCE_EXHAUSTED: quota exceeded'), { code: 8 }),
      );

      await expect(removeOptionAvailability('biz-1', 'loc-1', ['opt-1'])).rejects.toThrow('RESOURCE_EXHAUSTED');
    });

    it('propagates an error that carries no code', async () => {
      mockDocUpdate.mockRejectedValue(new Error('boom'));

      await expect(removeOptionAvailability('biz-1', 'loc-1', ['opt-1'])).rejects.toThrow('boom');
    });

    it('never upserts via set() (a merge-set would materialise an empty doc)', async () => {
      await removeOptionAvailability('biz-1', 'loc-1', ['opt-1']);

      expect(mockDocSet).not.toHaveBeenCalled();
    });

    it('targets the per-location availability doc', async () => {
      await removeOptionAvailability('biz-1', 'loc-1', ['opt-1']);

      expect(vi.mocked(PathResolver.availabilityDoc)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(PathResolver.availabilityDoc)).toHaveBeenCalledWith('biz-1', 'loc-1');
    });
  });

  describe('removeProductAvailability', () => {
    it('deletes a single product via a root-level dotted field path', async () => {
      await removeProductAvailability('biz-1', 'loc-1', ['prod-1']);

      expect(mockDocUpdate).toHaveBeenCalledWith({ 'products.prod-1': '$$FIELD_DELETE$$' });
      const payload = mockDocUpdate.mock.calls[0][0];
      expect(Object.keys(payload)).not.toContain('products');
    });

    it('coalesces multiple product ids into exactly one update() call', async () => {
      await removeProductAvailability('biz-1', 'loc-1', ['prod-1', 'prod-2', 'prod-3']);

      expect(mockDocUpdate).toHaveBeenCalledTimes(1);
      const payload = mockDocUpdate.mock.calls[0][0];
      expect(Object.keys(payload)).toHaveLength(3);
      expect(payload).toEqual({
        'products.prod-1': '$$FIELD_DELETE$$',
        'products.prod-2': '$$FIELD_DELETE$$',
        'products.prod-3': '$$FIELD_DELETE$$',
      });
    });

    it('issues no write when the id list is empty', async () => {
      await expect(removeProductAvailability('biz-1', 'loc-1', [])).resolves.toBeUndefined();

      expect(mockDocUpdate).not.toHaveBeenCalled();
      expect(mockDocSet).not.toHaveBeenCalled();
    });

    it('resolves silently when the location doc does not exist (NOT_FOUND)', async () => {
      mockDocUpdate.mockRejectedValue(
        Object.assign(new Error('5 NOT_FOUND: no entity to update'), { code: 5 }),
      );

      await expect(removeProductAvailability('biz-1', 'loc-1', ['prod-1'])).resolves.toBeUndefined();
    });

    it('propagates non-NOT_FOUND errors', async () => {
      mockDocUpdate.mockRejectedValue(
        Object.assign(new Error('7 PERMISSION_DENIED: missing permissions'), { code: 7 }),
      );

      await expect(removeProductAvailability('biz-1', 'loc-1', ['prod-1'])).rejects.toThrow('PERMISSION_DENIED');
    });

    it('writes only under products, never options', async () => {
      await removeProductAvailability('biz-1', 'loc-1', ['prod-1', 'prod-2']);

      const payload = mockDocUpdate.mock.calls[0][0];
      expect(Object.keys(payload).some((key) => key.startsWith('options.'))).toBe(false);
    });
  });

  describe('deleteAvailabilityDoc', () => {
    it('deletes the whole per-location doc', async () => {
      await deleteAvailabilityDoc('biz-1', 'loc-1');

      expect(mockDocDelete).toHaveBeenCalledTimes(1);
      expect(mockDocDelete).toHaveBeenCalledWith();
      expect(vi.mocked(PathResolver.availabilityDoc)).toHaveBeenCalledWith('biz-1', 'loc-1');
    });

    it('does not pre-read the doc (delete() is already idempotent)', async () => {
      await deleteAvailabilityDoc('biz-1', 'loc-1');

      expect(mockDocGet).not.toHaveBeenCalled();
      expect(mockDocUpdate).not.toHaveBeenCalled();
    });

    it('propagates delete() failures', async () => {
      mockDocDelete.mockRejectedValue(new Error('boom'));

      await expect(deleteAvailabilityDoc('biz-1', 'loc-1')).rejects.toThrow('boom');
    });
  });
});
