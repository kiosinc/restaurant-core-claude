# Issue #44: Denormalize semaphores to top-level Firestore collection

## Context

Semaphores (`catalogUpdate`, `locationUpdate`) are currently stored at `businesses/{businessId}/private/vars/semaphores/{semaphoreName}`. This deeply nested path shares a prefix with all other business data, causing write contention during catalog/location syncs. Moving to a top-level `semaphores/{businessId}_{semaphoreName}` collection isolates semaphore traffic onto independent Firestore storage nodes.

## Changes

### 1. `src/firestore-core/Paths.ts`
- Add a new top-level collection name constant (e.g., `topLevelSemaphores = 'semaphores'`) to avoid collision with the existing `semaphores` enum value used for the nested subcollection name
- Keep the existing `semaphores` value since it's the subcollection name (no longer referenced by PathResolver after the change, but safe to leave)

### 2. `src/persistence/firestore/PathResolver.ts`
- Change `semaphoresCollection()` to remove the `businessId` parameter and return the top-level collection:
  ```typescript
  static semaphoresCollection(): FirebaseFirestore.CollectionReference {
    return this.db().collection(Paths.CollectionNames.topLevelSemaphores);
  }
  ```

### 3. `src/restaurant/vars/SemaphoreV2.ts`
- Update `ref()` to compose the document ID as `{businessId}_{type}`:
  ```typescript
  static ref(businessId: string, type: string) {
    return PathResolver.semaphoresCollection().doc(`${businessId}_${type}`);
  }
  ```
- No other changes — `lock()`, `release()`, and `firestoreConverter` work unchanged since they operate on the doc reference returned by `ref()`

### 4. Tests

#### `src/persistence/firestore/__tests__/PathResolver.test.ts`
- Update the `semaphoresCollection` test to assert the new top-level path `semaphores` and remove the businessId argument

#### `src/restaurant/vars/__tests__/SemaphoreV2.test.ts`
- Update `mockDocRef.path` from `businesses/biz-1/private/vars/semaphores/catalog` to `semaphores/biz-1_catalog`
- Update the `ref()` test: `semaphoresCollection` mock is called with no args, and `mockCollectionRef.doc` is called with `'biz-1_catalog'`

## Verification

1. Run `npm test` — all tests pass
2. Run `npm run tsc` — compiles cleanly
3. Run `npx eslint src/` — no lint errors
