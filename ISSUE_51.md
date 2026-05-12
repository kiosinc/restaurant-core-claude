# Issue #51: baseFieldsFromFirestore breaks on Firestore Timestamp fields

## Problem Summary

`new Date(firestoreTimestamp)` produces `Invalid Date` because Firestore Timestamp objects are not valid `Date` constructor arguments. This causes `RangeError: Invalid time value` on any subsequent `.toISOString()` call during the write-back path.

**Root cause:** Converters assume date fields are always stored as ISO strings, but some services write native Firestore Timestamps.

## Implementation Plan

### Phase 1 — Shared utility

**File:** `src/persistence/firestore/converters/baseFields.ts`

Add a `toDateSafe` helper that normalizes both Firestore Timestamps and ISO strings to `Date`:

```ts
function toDateSafe(value: unknown): Date {
  if (value != null && typeof (value as any).toDate === 'function') {
    return (value as any).toDate();
  }
  return new Date(value as string | number);
}
```

This mirrors the existing guard in `SemaphoreV2.ts:104-105` but as a reusable function.

### Phase 2 — Fix all affected `fromFirestore` call sites

| File | Line(s) | Current | Fix |
|---|---|---|---|
| `src/persistence/firestore/converters/baseFields.ts` | 14-15 | `new Date(data.created)`, `new Date(data.updated)` | `toDateSafe(data.created)`, `toDateSafe(data.updated)` |
| `src/persistence/firestore/converters/eventConverter.ts` | 7 | `new Date(data.timestamp)` | `toDateSafe(data.timestamp)` |
| `src/persistence/firestore/converters/orderConverter.ts` | 12 | `new Date(data.timestamp)` | `toDateSafe(data.timestamp)` |
| `src/persistence/firestore/converters/inventoryCountHelper.ts` | 28 | `new Date(data.timestamp)` | `toDateSafe(data.timestamp)` |

**Out of scope:** `SemaphoreV2.ts` — already handles this with inline guards.

**Export:** Export `toDateSafe` from `baseFields.ts` so `eventConverter`, `orderConverter`, and `inventoryCountHelper` can import it. Add to `src/index.ts` barrel if needed by external consumers (likely not — only used internally by converters).

### Phase 3 — No changes to `toFirestore`

The `toFirestore` path writes ISO strings via `.toISOString()`, which is correct. The fix is read-side only: normalize on `fromFirestore` so the domain model always holds a valid `Date`.

## Test Criteria

All tests in `src/persistence/firestore/converters/__tests__/`. Use Vitest with `globals: true`.

### New test file: `src/persistence/firestore/converters/__tests__/baseFields.test.ts`

#### `toDateSafe`

| # | Test case | Input | Expected output |
|---|---|---|---|
| 1 | ISO string input | `"2025-06-15T12:00:00.000Z"` | `Date` matching that ISO string |
| 2 | Firestore Timestamp input | `{ toDate: () => new Date('2025-06-15T12:00:00.000Z') }` | `Date` matching that ISO string |
| 3 | Unix epoch number | `1750000000000` | Valid `Date` for that epoch |
| 4 | `null` / `undefined` | `null` | `Invalid Date` (same as `new Date(null)` — no crash) |

#### `baseFieldsFromFirestore`

| # | Test case | Input `data` | Assertion |
|---|---|---|---|
| 5 | ISO string fields | `{ created: "2025-01-01T00:00:00Z", updated: "2025-06-01T00:00:00Z", isDeleted: false }` | Returns valid `Date` objects, correct `Id`, `isDeleted: false` |
| 6 | Firestore Timestamp fields | `{ created: { toDate: () => date1 }, updated: { toDate: () => date2 }, isDeleted: false }` | Returns matching `Date` objects via `.toDate()` |
| 7 | Round-trip: Timestamp in → ISO out | Pass Timestamp data through `baseFieldsFromFirestore` then `baseFieldsToFirestore` | No `RangeError`, output contains valid ISO strings |

### Existing converter tests — verify no regressions

Run the full test suite (`npm test`). Existing converter tests in:
- `EventRepository.test.ts`
- `OrderRepository.test.ts`
- `helpers/InventoryCountConverter.test.ts`

These already test the read/write path with ISO string data and must continue to pass.

## Verification

1. `npm test` — all tests pass (existing + new)
2. `npm run tsc` — no type errors
3. `npx eslint src/persistence/firestore/converters/baseFields.ts src/persistence/firestore/converters/eventConverter.ts src/persistence/firestore/converters/orderConverter.ts src/persistence/firestore/converters/inventoryCountHelper.ts` — no lint errors

## Version Bump

Patch bump in `package.json` (e.g., `1.5.4` → `1.5.5`) since this is a bug fix.

## Checklist

- [ ] `toDateSafe` utility added and exported from `baseFields.ts`
- [ ] `baseFieldsFromFirestore` uses `toDateSafe` for `created` and `updated`
- [ ] `eventConverter` `fromFirestore` uses `toDateSafe` for `timestamp`
- [ ] `orderConverter` `fromFirestore` uses `toDateSafe` for `timestamp`
- [ ] `inventoryCountHelper` `fromFirestore` uses `toDateSafe` for `timestamp`
- [ ] New unit tests for `toDateSafe` and `baseFieldsFromFirestore` with Timestamp input
- [ ] Round-trip test (Timestamp in → ISO out) passes without `RangeError`
- [ ] All existing tests pass
- [ ] TypeScript compiles cleanly
- [ ] Patch version bumped
