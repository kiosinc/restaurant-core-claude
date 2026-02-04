# Phase 2 (Migrate LinkedObject) — Detailed Spec

## Overview

Phase 2 decouples `LinkedObject` from Firestore. The existing `LinkedObject` class mixes two concerns: (1) a data shape (`linkedObjectId` field) and (2) Firestore query logic (`find`/`findQuery` static methods). Phase 1 already introduced a pure `LinkedObjectRef` interface in the domain Order model. Phase 2 promotes this to a shared domain type, moves query logic to a persistence helper, and deprecates the old class.

**Scope:** 3 new files, 2 modified files, 0 existing code broken.

---

## Current State

### What exists today

| File | Responsibility |
|------|---------------|
| `src/firestore-core/core/LinkedObject.ts` | Class with `linkedObjectId` field + `find()`/`findQuery()` static methods (Firestore queries) |
| `src/firestore-core/core/LinkedObjectType.ts` | Union type of catalog models that carry `linkedObjects` |
| `src/firestore-core/core/LinkedObjectUtilities.ts` | `isStopSync()` — sync control logic using `FirestoreWriter.deleteObject()` |
| `src/firestore-core/Constants.ts` | `Provider` const enum (`square`, `system`) |
| `src/domain/orders/Order.ts` | Already has `LinkedObjectRef` interface (Phase 1) |
| `src/persistence/firestore/FirestoreRepository.ts` | Already has `findByLinkedObject()` (Phase 1) |

### How `LinkedObject` is used

1. **Data shape** — Catalog models (`Product`, `Category`, `Option`, `OptionSet`, `TaxRate`, `Discount`, `ServiceCharge`) and `Location` all have `linkedObjects: { [Id: string]: LinkedObject }` fields storing external provider references.

2. **`find()` / `findQuery()`** — Called from `FirestoreObjectV2.findGeneric()` to locate an entity by its external provider ID. Already replaced by `FirestoreRepository.findByLinkedObject()` in Phase 1.

3. **`LinkedObjectType`** — Type union used only by `LinkedObjectUtilities.isStopSync()`.

4. **`LinkedObjectUtilities.isStopSync()`** — Sync control helper. Calls `FirestoreWriter.deleteObject()`. Stays in persistence layer.

5. **Exports** — `src/index.ts` exports `LinkedObject`, `LinkedObjectType`, and `LinkedObjectSync`.

---

## 1. Implementation Spec

### 1.1 `src/domain/LinkedObjectRef.ts` — Shared domain type

Promotes the `LinkedObjectRef` interface from `Order.ts` to a shared domain-level type. All models (catalog, orders, locations) will reference this single definition.

```typescript
/**
 * Pure data reference to an object on an external system (e.g. Square POS).
 * Replaces the old LinkedObject class which mixed data with Firestore queries.
 *
 * Usage: `linkedObjects: { [provider: string]: LinkedObjectRef } | null`
 * The key is the provider identifier (e.g. 'square', 'system').
 */
export interface LinkedObjectRef {
  linkedObjectId: string;
}

/**
 * A map of provider keys to their linked object references.
 * Convenience type for the common `linkedObjects` field pattern.
 */
export type LinkedObjectMap = { [provider: string]: LinkedObjectRef };
```

**Key decisions:**
- **Interface, not class.** The old `LinkedObject` class constructor adds no value — it's just assignment. An interface is the right abstraction for pure data.
- **`LinkedObjectMap` convenience type.** Every model repeats `{ [Id: string]: LinkedObject }`. A named type improves readability and consistency.
- **No `Provider` enum dependency.** The key type is `string`, not `Constants.Provider`. Domain layer stays decoupled from the const enum in `firestore-core/Constants.ts`. Provider validation is a persistence/integration concern.
- **Matches Phase 1 `LinkedObjectRef`.** Same shape — Phase 1's Order.ts definition will be replaced with a re-export.

---

### 1.2 `src/persistence/firestore/LinkedObjectQueries.ts` — Query logic

Moves `LinkedObject.find()` and `LinkedObject.findQuery()` from the old class to standalone functions in the persistence layer.

```typescript
import * as Constants from '../../firestore-core/Constants';

/**
 * Constructs a Firestore query to find entities by their linked external object ID.
 * Replaces LinkedObject.findQuery().
 */
export function linkedObjectQuery(
  linkedObjectId: string,
  provider: Constants.Provider,
  collectionRef: FirebaseFirestore.CollectionReference,
  converter?: FirebaseFirestore.FirestoreDataConverter<any>,
): FirebaseFirestore.Query<any> {
  let query = collectionRef
    .where(`linkedObjects.${provider}.linkedObjectId`, '==', linkedObjectId);

  if (converter) {
    query = query.withConverter(converter);
  }

  return query;
}

/**
 * Finds a single entity by its linked external object ID.
 * Returns the entity data if exactly one match, false if none, throws if multiple.
 * Replaces LinkedObject.find().
 */
export async function findByLinkedObjectId(
  linkedObjectId: string,
  provider: Constants.Provider,
  collectionRef: FirebaseFirestore.CollectionReference,
  converter: FirebaseFirestore.FirestoreDataConverter<unknown>,
): Promise<unknown | false> {
  const snapshot = await linkedObjectQuery(
    linkedObjectId,
    provider,
    collectionRef,
    converter,
  ).get();

  if (snapshot.empty) {
    return false;
  }
  if (snapshot.docs.length > 1) {
    throw new Error(
      `There is more than one ${collectionRef.path} Collection object `
      + `${snapshot.docs.map((t) => t.id)} with the same linkedID ${linkedObjectId}`,
    );
  }
  return snapshot.docs[0].data();
}
```

**Key decisions:**
- **Standalone functions, not a class.** No state, no reason for a class.
- **Same signatures as originals.** Drop-in replacements. Callers change `LinkedObject.find(...)` to `findByLinkedObjectId(...)` and `LinkedObject.findQuery(...)` to `linkedObjectQuery(...)`.
- **Preserves `false` return.** The old `find()` returns `false` (not `null`) when empty. Maintaining this for backward compatibility. `FirestoreRepository.findByLinkedObject()` (Phase 1) already uses `null` — the two coexist during migration.
- **Uses `Constants.Provider`** — this is the persistence layer, so it can depend on `firestore-core/Constants.ts`.
- **Error message preserved.** Exact same multi-match error text for debugging continuity.

---

### 1.3 Update `src/domain/orders/Order.ts` — Re-export shared type

Replace the local `LinkedObjectRef` interface with a re-export from the shared definition.

```typescript
// BEFORE (Phase 1):
export interface LinkedObjectRef {
  linkedObjectId: string;
}

// AFTER (Phase 2):
export { LinkedObjectRef, LinkedObjectMap } from '../LinkedObjectRef';
```

The `Order` class and `OrderProps` interface continue to reference `LinkedObjectRef` — no other changes needed. Consumers importing `LinkedObjectRef` from `'./orders/Order'` or the barrel export still work.

---

### 1.4 Update barrel exports

**`src/domain/index.ts`** — Add LinkedObjectRef export:
```typescript
// Add:
export { LinkedObjectRef, LinkedObjectMap } from './LinkedObjectRef';
```

**`src/domain/orders/index.ts`** — `LinkedObjectRef` already exported (via Order.ts re-export, no change needed).

**`src/persistence/firestore/index.ts`** — Add LinkedObjectQueries export:
```typescript
// Add:
export { linkedObjectQuery, findByLinkedObjectId } from './LinkedObjectQueries';
```

---

### 1.5 Deprecation markers

**`src/firestore-core/core/LinkedObject.ts`** — Add `@deprecated` JSDoc to class and both static methods:

```typescript
/**
 * @deprecated Use `LinkedObjectRef` from `src/domain/LinkedObjectRef` for the data type.
 * Use `linkedObjectQuery`/`findByLinkedObjectId` from `src/persistence/firestore/LinkedObjectQueries`
 * for query logic. Will be removed in the next major version.
 */
export default class LinkedObject { ... }
```

**No changes to:**
- `LinkedObjectType.ts` — Still used by `LinkedObjectUtilities.isStopSync()`. Deprecation deferred to Phase 4 (catalog migration).
- `LinkedObjectUtilities.ts` — Depends on `FirestoreWriter`. Refactored in Phase 4.
- `src/index.ts` old exports — Keep exporting `LinkedObject`, `LinkedObjectType`, `LinkedObjectSync` for backward compatibility. Add new exports alongside.

**`src/index.ts`** — Add new exports (append, don't modify existing):
```typescript
// Existing (keep):
export { default as LinkedObject } from './firestore-core/core/LinkedObject';
export { default as LinkedObjectType } from './firestore-core/core/LinkedObjectType';
export * as LinkedObjectSync from './firestore-core/core/LinkedObjectUtilities';

// New (add via Domain/Persistence namespace exports — already wired in Phase 1):
// LinkedObjectRef available as Domain.LinkedObjectRef
// linkedObjectQuery available as Persistence.linkedObjectQuery
```

---

## 2. Testing Spec

### 2.1 Test Requirements

All tests must pass **without**:
- `admin.initializeApp()` called
- Firestore emulator running
- Network access
- Environment variables

Domain tests are pure unit tests. Persistence tests use `vi.mock('firebase-admin/firestore')`.

---

### 2.2 Test Cases

#### `src/domain/__tests__/LinkedObjectRef.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | LinkedObjectRef holds linkedObjectId | Object literal `{ linkedObjectId: 'ext-123' }` satisfies interface, field accessible |
| 2 | LinkedObjectMap holds provider-keyed refs | `{ square: { linkedObjectId: 'sq-1' }, system: { linkedObjectId: 'sys-1' } }` satisfies type |
| 3 | LinkedObjectMap allows any string key | Key `'custom-provider'` compiles and is accessible |
| 4 | LinkedObjectRef matches Order's usage | Object assignable to `OrderProps.linkedObjects` value type |
| 5 | No Firebase dependency | Test passing = proof (no mock setup needed) |

#### `src/persistence/firestore/__tests__/LinkedObjectQueries.test.ts`

Uses `vi.mock('firebase-admin/firestore')` with in-memory stubs for `CollectionReference`, `Query`, `QuerySnapshot`.

| # | Test | Assertion |
|---|------|-----------|
| 1 | linkedObjectQuery builds correct where clause | `where()` called with `'linkedObjects.square.linkedObjectId'`, `'=='`, `'ext-123'` |
| 2 | linkedObjectQuery applies converter when provided | `withConverter()` called with provided converter |
| 3 | linkedObjectQuery skips converter when not provided | `withConverter()` not called |
| 4 | findByLinkedObjectId returns data when one match | Returns `snapshot.docs[0].data()` |
| 5 | findByLinkedObjectId returns false when no match | Returns `false` (not null) |
| 6 | findByLinkedObjectId throws on multiple matches | Error message contains collection path and doc IDs |
| 7 | findByLinkedObjectId passes converter to query | Converter flows through to `linkedObjectQuery` |

#### `src/domain/orders/__tests__/Order.test.ts` — Verify no regression

| # | Test | Existing? | Assertion |
|---|------|-----------|-----------|
| - | LinkedObjectRef stores data correctly | Yes (existing test) | Still passes after re-export change |
| 20+ | All existing Order tests | Yes | No regressions from re-export |

---

## 3. Implementation & Testing Tracker

### Domain Layer — Code
- [ ] Create `src/domain/LinkedObjectRef.ts` — `LinkedObjectRef` interface + `LinkedObjectMap` type
- [ ] Update `src/domain/orders/Order.ts` — Replace local `LinkedObjectRef` with re-export from `../LinkedObjectRef`
- [ ] Update `src/domain/index.ts` — Add `LinkedObjectRef`, `LinkedObjectMap` exports
- [ ] Verify `src/domain/orders/index.ts` — Confirm `LinkedObjectRef` still exported (via Order.ts re-export)

### Domain Layer — Tests
- [ ] Create `src/domain/__tests__/LinkedObjectRef.test.ts` (5 tests)
- [ ] Run existing `src/domain/orders/__tests__/Order.test.ts` — All 20 tests still pass

### Persistence Layer — Code
- [ ] Create `src/persistence/firestore/LinkedObjectQueries.ts` — `linkedObjectQuery()` + `findByLinkedObjectId()` functions
- [ ] Update `src/persistence/firestore/index.ts` — Add `LinkedObjectQueries` exports

### Persistence Layer — Tests
- [ ] Create `src/persistence/firestore/__tests__/LinkedObjectQueries.test.ts` (7 tests)

### Deprecation
- [ ] Add `@deprecated` JSDoc to `src/firestore-core/core/LinkedObject.ts` class and static methods

### Integration Verification
- [ ] `npm run tsc` passes with no errors
- [ ] `npx eslint src/` passes (excluding node_modules)
- [ ] `npm run test` — All tests pass (existing 75+ tests + 12 new = 87+ total)
- [ ] Existing code still compiles — old `LinkedObject` import/usage unchanged
- [ ] `src/index.ts` exports both old (deprecated) and new APIs

---

## Files Changed Summary

| Action | File | Description |
|--------|------|-------------|
| **Create** | `src/domain/LinkedObjectRef.ts` | Shared `LinkedObjectRef` interface + `LinkedObjectMap` type |
| **Create** | `src/persistence/firestore/LinkedObjectQueries.ts` | `linkedObjectQuery()` + `findByLinkedObjectId()` |
| **Create** | `src/domain/__tests__/LinkedObjectRef.test.ts` | 5 domain-level tests |
| **Create** | `src/persistence/firestore/__tests__/LinkedObjectQueries.test.ts` | 7 persistence-level tests |
| **Modify** | `src/domain/orders/Order.ts` | Replace local interface with re-export |
| **Modify** | `src/domain/index.ts` | Add `LinkedObjectRef`, `LinkedObjectMap` to barrel |
| **Modify** | `src/persistence/firestore/index.ts` | Add query function exports |
| **Modify** | `src/firestore-core/core/LinkedObject.ts` | Add `@deprecated` JSDoc |

---

## Dependency Graph Position

```
Phase 0 (done) ── Phase 1 (done) ── ▶ Phase 2 (this) ◀
                                            │
                   Phase 3 (Location) ──────┘
                        │
                   Phase 4 (Catalog + relationships)
```

Phase 2 is a prerequisite for Phase 3 (Location) because Location has `linkedObjects: { [Id: string]: LinkedObject }` — Phase 3 will change that type to `LinkedObjectMap`.

---

## Critical Files Reference

| File | Why |
|------|-----|
| `src/firestore-core/core/LinkedObject.ts` | Old class being deprecated |
| `src/firestore-core/core/LinkedObjectType.ts` | Union type — untouched, deferred to Phase 4 |
| `src/firestore-core/core/LinkedObjectUtilities.ts` | Sync helper — untouched, deferred to Phase 4 |
| `src/firestore-core/Constants.ts` | `Provider` enum used by query functions |
| `src/domain/orders/Order.ts` | Phase 1 local `LinkedObjectRef` → re-export |
| `src/persistence/firestore/FirestoreRepository.ts` | Already has `findByLinkedObject()` — parallel capability |
