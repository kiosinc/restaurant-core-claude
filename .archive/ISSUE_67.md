# Implementation Plan: P13-availability-doc (#67)

## Overview

Three categories of change:
1. **Type changes** — extend `ProductAvailability` with `state`/`timestamp`; tighten `OptionAvailability.state` to union
2. **New helper** — add `getOptionTimestamp` (returns `Date | undefined`, per issue spec)
3. **Test updates** — fix `'IN_STOCK'` → `'inStock'`; add 4 + 1 new tests
4. **Version bump** — `1.8.1` → `1.9.0`

---

## Group A: `src/domain/services/AvailabilityService.ts`

### A1. Extend `ProductAvailability`
```ts
export interface ProductAvailability {
  isAvailable: boolean;
  state?: 'inStock' | 'soldOut';
  timestamp?: string;
}
```
Both new fields optional — backwards-compatible. Existing callers that pass only `{ isAvailable: true }` continue to compile.

### A2. Tighten `OptionAvailability.state`
Change line 10:
```ts
// Before
state: string;
// After
state: 'inStock' | 'soldOut';
```

### A3. Add `getOptionTimestamp`
Add at bottom of `AvailabilityService.ts` (after `updateAvailability`):

```ts
export async function getOptionTimestamp(
  businessId: string,
  locationId: string,
  optionId: string,
): Promise<Date | undefined> {
  const docRef = PathResolver.availabilityDoc(businessId, locationId);
  const snap = await docRef.get();
  if (!snap.exists) return undefined;
  const opt = snap.data()?.options?.[optionId];
  return opt?.timestamp ? new Date(opt.timestamp) : undefined;
}
```

Returns `Date | undefined` (not `string | null`) — exact shape from issue spec. Callers (square-gateway-claude) compare against a `Date`.

---

## Group B: `src/domain/services/index.ts`

Add `getOptionTimestamp` to the re-export block:
```ts
export {
  ProductAvailability,
  OptionAvailability,
  AvailabilityDoc,
  getAvailability,
  setProductAvailability,
  setOptionAvailability,
  setProductAvailabilityBatch,
  updateAvailability,
  getOptionTimestamp,   // ← add
} from './AvailabilityService';
```

---

## Group C: `src/domain/services/__tests__/AvailabilityService.test.ts`

### C1. Add `getOptionTimestamp` to import

### C2. Replace `'IN_STOCK'` → `'inStock'` (5 occurrences)
- Line 41: mock data in `getAvailability` test
- Lines 79, 89: `setOptionAvailability` test input + expected assertion
- Lines 119, 124: `updateAvailability` test input + expected assertion

### C3. New `describe('getOptionTimestamp')` block (4 tests)

```ts
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
```

### C4. New test in `describe('setProductAvailability')` — state/timestamp merge write

```ts
it('writes state and timestamp fields via merge when provided', async () => {
  await setProductAvailability('biz-1', 'loc-1', 'prod-1', {
    isAvailable: false,
    state: 'soldOut',
    timestamp: '2024-06-01T09:00:00Z',
  });

  expect(mockDocSet).toHaveBeenCalledWith(
    {
      'products.prod-1': {
        isAvailable: false,
        state: 'soldOut',
        timestamp: '2024-06-01T09:00:00Z',
      },
    },
    { merge: true },
  );
});
```

---

## Group D: `package.json`

Bump `"version": "1.8.1"` → `"version": "1.9.0"`.

---

## Checklist

### Group A — AvailabilityService.ts
- [ ] Add `state?: 'inStock' | 'soldOut'` to `ProductAvailability`
- [ ] Add `timestamp?: string` to `ProductAvailability`
- [ ] Change `OptionAvailability.state` from `string` to `'inStock' | 'soldOut'`
- [ ] Add exported `getOptionTimestamp(businessId, locationId, optionId): Promise<Date | undefined>`

### Group B — index.ts
- [ ] Add `getOptionTimestamp` to re-export block

### Group C — AvailabilityService.test.ts
- [ ] Add `getOptionTimestamp` to import
- [ ] Replace all 5 `'IN_STOCK'` occurrences with `'inStock'`
- [ ] Add test: `getOptionTimestamp` returns `undefined` when doc missing
- [ ] Add test: `getOptionTimestamp` returns `undefined` when option missing
- [ ] Add test: `getOptionTimestamp` returns `Date` when option has timestamp
- [ ] Add test: `getOptionTimestamp` returns `undefined` when option has no timestamp
- [ ] Add test: `setProductAvailability` writes `state`/`timestamp` via merge

### Group D — package.json
- [ ] Bump version `1.8.1` → `1.9.0`
