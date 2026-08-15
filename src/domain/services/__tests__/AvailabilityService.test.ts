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
  ProductAvailability,
  OptionAvailability,
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

  // #134: isHidden is Remy-owned (merchant manual hide). Backend writers never
  // set it, but the service must pass it through untouched when a caller does,
  // and omit it entirely when absent (merge-set writes only provided keys).
  describe('isHidden passthrough (#134)', () => {
    it('setProductAvailability passes isHidden through the merge payload', async () => {
      await setProductAvailability('biz-1', 'loc-1', 'prod-1', { isAvailable: true, isHidden: true });

      expect(mockDocSet).toHaveBeenCalledWith(
        { products: { 'prod-1': { isAvailable: true, isHidden: true } } },
        { merge: true },
      );
    });

    it('setOptionAvailability passes isHidden through the merge payload', async () => {
      await setOptionAvailability('biz-1', 'loc-1', 'opt-1', { isAvailable: true, isHidden: false });

      expect(mockDocSet).toHaveBeenCalledWith(
        { options: { 'opt-1': { isAvailable: true, isHidden: false } } },
        { merge: true },
      );
    });

    it('omitting isHidden writes no isHidden key', async () => {
      await setProductAvailability('biz-1', 'loc-1', 'prod-1', { isAvailable: true });

      expect(mockDocSet.mock.calls[0][0].products['prod-1']).not.toHaveProperty('isHidden');
    });

    it('getAvailability reads back entries carrying isHidden', async () => {
      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({
          products: { 'prod-1': { isAvailable: true, isHidden: true } },
          options: { 'opt-1': { isAvailable: true, isHidden: true } },
        }),
      });

      const result = await getAvailability('biz-1', 'loc-1');
      expect(result!.products['prod-1'].isHidden).toBe(true);
      expect(result!.options['opt-1'].isHidden).toBe(true);
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

  // #157: Firestore derives a merge-set's update mask from the LEAF paths in the
  // payload. An empty map has no leaves, so its own path becomes the mask entry
  // and the empty map is written as that field's value — replacing the whole
  // subtree. Every writer must therefore prune empty maps before writing, at
  // both the top level (products/options) and the per-entity level, and issue
  // no RPC at all when nothing survives. "Empty" means "no key with a DEFINED
  // value", not "no keys": ignoreUndefinedProperties strips undefined INSIDE the
  // SDK, before the mask is computed, so {isAvailable: undefined} reaches the
  // wire as {} and erases just the same. Falsy-but-defined values must survive.
  describe('empty-map payloads (#157)', () => {
    // Walks a written payload and fails on any object node with zero keys —
    // the shape that becomes a subtree-replacing mask entry.
    const expectNoEmptyObjectNodes = (node: unknown, path: string): void => {
      if (node === null || typeof node !== 'object') return;
      const entries = Object.entries(node as Record<string, unknown>);
      expect(entries.length, `empty object node at ${path}`).toBeGreaterThan(0);
      entries.forEach(([key, value]) => expectNoEmptyObjectNodes(value, `${path}.${key}`));
    };

    it('writes only products when options is an empty map', async () => {
      await updateAvailability('biz-1', 'loc-1', {
        products: { 'prod-1': { isAvailable: true } },
        options: {},
      });

      expect(mockDocSet).toHaveBeenCalledWith(
        { products: { 'prod-1': { isAvailable: true } } },
        { merge: true },
      );
    });

    it('writes only options when products is an empty map', async () => {
      await updateAvailability('biz-1', 'loc-1', {
        products: {},
        options: { 'opt-1': { isAvailable: false, state: 'soldOut' } },
      });

      expect(mockDocSet).toHaveBeenCalledWith(
        { options: { 'opt-1': { isAvailable: false, state: 'soldOut' } } },
        { merge: true },
      );
    });

    it('issues no write when both products and options are empty maps', async () => {
      await expect(updateAvailability('biz-1', 'loc-1', { products: {}, options: {} })).resolves.toBeUndefined();

      expect(mockDocSet).not.toHaveBeenCalled();
    });

    it('setProductAvailabilityBatch issues no write for an empty product map', async () => {
      await expect(setProductAvailabilityBatch('biz-1', 'loc-1', {})).resolves.toBeUndefined();

      expect(mockDocSet).not.toHaveBeenCalled();
    });

    it('issues no write when the only entry is an empty entity map', async () => {
      await updateAvailability('biz-1', 'loc-1', {
        options: { 'opt-1': {} as unknown as OptionAvailability },
      });

      expect(mockDocSet).not.toHaveBeenCalled();
    });

    it('writes only the populated entity from a mixed entity map', async () => {
      await updateAvailability('biz-1', 'loc-1', {
        options: {
          'opt-1': {} as unknown as OptionAvailability,
          'opt-2': { isAvailable: true },
        },
      });

      expect(mockDocSet).toHaveBeenCalledWith(
        { options: { 'opt-2': { isAvailable: true } } },
        { merge: true },
      );
    });

    // An entity whose every field is undefined is the shape an
    // ignoreUndefinedProperties consumer sends: the SDK strips the keys before
    // computing the mask, so it reaches the wire as {} and erases the entity.
    it('treats an all-fields-undefined entity as empty', async () => {
      await setProductAvailabilityBatch('biz-1', 'loc-1', {
        'prod-1': { isAvailable: undefined } as unknown as ProductAvailability,
      });

      expect(mockDocSet).not.toHaveBeenCalled();
    });

    it('writes only the populated entity when an all-fields-undefined entity is mixed in', async () => {
      await updateAvailability('biz-1', 'loc-1', {
        products: {
          'prod-1': { isAvailable: undefined, state: undefined } as unknown as ProductAvailability,
          'prod-2': { isAvailable: true },
        },
      });

      expect(mockDocSet).toHaveBeenCalledWith(
        { products: { 'prod-2': { isAvailable: true } } },
        { merge: true },
      );
    });

    it('setProductAvailability issues no write for an empty entity', async () => {
      await expect(
        setProductAvailability('biz-1', 'loc-1', 'prod-1', {} as unknown as ProductAvailability),
      ).resolves.toBeUndefined();

      expect(mockDocSet).not.toHaveBeenCalled();
    });

    it('setOptionAvailability issues no write for an empty entity', async () => {
      await expect(
        setOptionAvailability('biz-1', 'loc-1', 'opt-1', {} as unknown as OptionAvailability),
      ).resolves.toBeUndefined();

      expect(mockDocSet).not.toHaveBeenCalled();
    });

    it('setProductAvailability issues no write when every field is undefined', async () => {
      await expect(
        setProductAvailability('biz-1', 'loc-1', 'prod-1', {
          isAvailable: undefined,
          state: undefined,
          timestamp: undefined,
        } as unknown as ProductAvailability),
      ).resolves.toBeUndefined();

      expect(mockDocSet).not.toHaveBeenCalled();
    });

    it('setOptionAvailability issues no write when every field is undefined', async () => {
      await expect(
        setOptionAvailability('biz-1', 'loc-1', 'opt-1', {
          isAvailable: undefined,
          count: undefined,
        } as unknown as OptionAvailability),
      ).resolves.toBeUndefined();

      expect(mockDocSet).not.toHaveBeenCalled();
    });

    it('setProductAvailabilityBatch drops empty entries and keeps populated ones', async () => {
      await setProductAvailabilityBatch('biz-1', 'loc-1', {
        'prod-1': {} as unknown as ProductAvailability,
        'prod-2': { isAvailable: false, state: 'soldOut' },
        'prod-3': { isAvailable: undefined } as unknown as ProductAvailability,
      });

      expect(mockDocSet).toHaveBeenCalledWith(
        { products: { 'prod-2': { isAvailable: false, state: 'soldOut' } } },
        { merge: true },
      );
    });

    it('setProductAvailabilityBatch issues no write when every entry is empty', async () => {
      await expect(setProductAvailabilityBatch('biz-1', 'loc-1', {
        'prod-1': {} as unknown as ProductAvailability,
        'prod-2': { isAvailable: undefined } as unknown as ProductAvailability,
      })).resolves.toBeUndefined();

      expect(mockDocSet).not.toHaveBeenCalled();
    });

    // Over-pruning guard: populated payloads must be handed to set() byte-for-byte.
    it('leaves fully populated payloads untouched', async () => {
      await updateAvailability('biz-1', 'loc-1', {
        products: { 'prod-1': { isAvailable: true }, 'prod-2': { isAvailable: false, state: 'soldOut' } },
        options: { 'opt-1': { isAvailable: true, count: 5, state: 'inStock', timestamp: '2024-01-01T00:00:00Z' } },
      });

      expect(mockDocSet).toHaveBeenCalledTimes(1);
      expect(mockDocSet).toHaveBeenCalledWith(
        {
          products: { 'prod-1': { isAvailable: true }, 'prod-2': { isAvailable: false, state: 'soldOut' } },
          options: { 'opt-1': { isAvailable: true, count: 5, state: 'inStock', timestamp: '2024-01-01T00:00:00Z' } },
        },
        { merge: true },
      );
    });

    // Over-pruning guard: emptiness tests for DEFINED values, never truthiness.
    // Dropping { isAvailable: false } would stop sold-out items being marked so.
    it('keeps entries whose only defined field is falsy', async () => {
      await setProductAvailability('biz-1', 'loc-1', 'prod-1', { isAvailable: false });

      expect(mockDocSet).toHaveBeenCalledWith(
        { products: { 'prod-1': { isAvailable: false } } },
        { merge: true },
      );
    });

    it('keeps entries whose defined fields are all falsy', async () => {
      await setOptionAvailability('biz-1', 'loc-1', 'opt-1', { isAvailable: false, count: 0 });

      expect(mockDocSet).toHaveBeenCalledWith(
        { options: { 'opt-1': { isAvailable: false, count: 0 } } },
        { merge: true },
      );
    });

    // The prune decides whether to keep a WHOLE entity; it never rewrites a
    // surviving entity's contents, so default-config behaviour is unchanged.
    it('keeps a surviving entity unmodified, undefined keys included', async () => {
      await setOptionAvailability('biz-1', 'loc-1', 'opt-1', {
        isAvailable: true,
        state: undefined,
        count: undefined,
      });

      const entry = mockDocSet.mock.calls[0][0].options['opt-1'];
      expect(Object.keys(entry)).toEqual(['isAvailable', 'state', 'count']);
      expect(entry.state).toBeUndefined();
      expect(entry.count).toBeUndefined();
    });

    it('never hands set() a payload containing an empty object node', async () => {
      await updateAvailability('biz-1', 'loc-1', {
        products: { 'prod-1': {} as unknown as ProductAvailability, 'prod-2': { isAvailable: true } },
        options: { 'opt-1': {} as unknown as OptionAvailability },
      });

      expect(mockDocSet).toHaveBeenCalledTimes(1);
      expectNoEmptyObjectNodes(mockDocSet.mock.calls[0][0], 'payload');
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

// Removal deliberately inverts the #70 merge-set convention — see the
// "Entry removal (#133)" comment block in AvailabilityService.ts for why.
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
