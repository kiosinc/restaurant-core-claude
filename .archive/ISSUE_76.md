# Plan — Issue #76: `createOptionSet` rejects legacy `displayOrder: -1`

## Problem (verified)

`createOptionSet` validates `displayOrder` with strict `requireNonNegativeInteger` (`src/domain/catalog/OptionSet.ts:57`), which throws on `-1`. `-1` is a legitimate legacy sentinel ("Square supplied no ordinal"). Because `optionSetConverter.fromFirestore` → `createConverter` → `createOptionSet` (`converterFactory.ts:29`), any persisted option-set doc with `displayOrder: -1` throws on **read**, poison-pilling catalog sync / pricing / menu rebuild.

The inconsistency: `minSelection`/`maxSelection` use `requireNonNegativeIntegerOrNeg1` (accept `-1`), but `displayOrder` does not.

## Fix (issue's recommended option 1: coerce on read)

Coerce `displayOrder: -1 → 0` inside `createOptionSet` **before** validation. This:
- Removes the poison pill (legacy `-1` docs now read fine, hydrating to `0`).
- Converges legacy `-1` and the current sync mapper's `?? 0` to the same stored value (`0` = natural "unordered/first").
- Keeps strict validation for all other negatives (`-2` still throws).
- No data migration; single chokepoint (the factory is hit on every read and write).

### Code change — `src/domain/catalog/OptionSet.ts`

Replace:
```ts
requireNonNegativeInteger('displayOrder', input.displayOrder);
```
with coerce-then-validate:
```ts
// Legacy "-1" was the sentinel for "Square supplied no ordinal"; the current sync
// mapper writes 0 for the same case. Coerce so legacy docs read as 0 (see #76).
const displayOrder = input.displayOrder === -1 ? 0 : input.displayOrder;
requireNonNegativeInteger('displayOrder', displayOrder);
```
And use the coerced local in the returned object: `displayOrder,` (instead of `displayOrder: input.displayOrder`).

Behavior table:
| input.displayOrder | result |
|---|---|
| `-1` | coerced → `0`, passes |
| `-2` (or other <-1) | unchanged → throws `ValidationError` |
| `0,1,2,…` | unchanged, passes |

## Tests — `src/domain/catalog/__tests__/OptionSet.test.ts`

1. **Replace** existing `throws for negative displayOrder` (line 127, uses `displayOrder: -1`) with:
   - `coerces displayOrder -1 sentinel to 0` — `createOptionSet({displayOrder: -1})` does **not** throw and `os.displayOrder === 0`.
2. **Add** `throws for displayOrder < -1` — `createOptionSet({displayOrder: -2})` throws `ValidationError`.
3. Keep `throws for negative displayTier` (displayTier behavior unchanged).

## Manual verification

None required beyond automated tests — the throw/coerce is deterministic and fully unit-coverable.

## Checklist

### Group 1 — Option-set layer (`src/domain/catalog/`)
- [ ] Coerce `displayOrder: -1 → 0` before validation in `createOptionSet` (`OptionSet.ts`), and store the coerced value
- [ ] Replace the `displayOrder: -1` throw test with a coercion test (`-1 → 0`, no throw)
- [ ] Add a `displayOrder: -2` throws-ValidationError test
- [ ] Run full verification: `npx tsc --noEmit`, `npx eslint src/`, `npm test`
- [ ] Bump `package.json` version (patch: 1.10.0 → 1.10.1) per repo publish rules

## Scope

- **In:** option-set `displayOrder: -1` validation (this issue).
- **Out:** product-layer legacy `minPrice`/`maxPrice`/`variationCount` (tracked separately per the issue); no data migration; no square-gateway changes.
