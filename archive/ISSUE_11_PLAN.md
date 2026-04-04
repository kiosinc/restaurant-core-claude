# Plan: Wire RelationshipHandlerRegistry into FirestoreRepository

## Context

The `RelationshipHandlerRegistry` and its three concrete handlers are fully implemented and tested in isolation, but never invoked from `FirestoreRepository`. This was a known gap deferred across spec phases (documented in MIGRATION.md line 474). Without the wiring, catalog entity saves/deletes silently skip cascading metadata updates — e.g., renaming a Product doesn't update `ProductMeta` in parent Category documents.

## Approach

Add `RelationshipHandlerRegistry` as an **optional** second constructor parameter to `FirestoreRepository` (defaulting to an empty registry). Invoke the resolved handler inside the existing transactions in `set()` and `delete()`. This is non-breaking — all 25 existing repository subclasses inherit the constructor and continue working without changes.

## Changes

### 1. `src/persistence/firestore/FirestoreRepository.ts`

- Import `RelationshipHandlerRegistry` from `./handlers/RelationshipHandlerRegistry`
- Add optional second constructor parameter with empty default:
  ```typescript
  constructor(
    protected readonly metadataRegistry: MetadataRegistry,
    protected readonly relationshipHandlerRegistry: RelationshipHandlerRegistry = new RelationshipHandlerRegistry(),
  ) {}
  ```
- In `set()`, invoke the handler **before** the entity write and metadata writes (still inside the transaction). Firestore transactions require all reads (`t.get()`) to complete before any writes (`t.set()`, `t.update()`, `t.delete()`). The handlers perform `t.get()` queries to find parent documents, so they must execute first:
  ```typescript
  await db.runTransaction(async (transaction) => {
    // 1. Handler reads + writes first (handlers do t.get() then t.update())
    const handler = this.relationshipHandlerRegistry.resolve(entity);
    if (handler) {
      if (entity.isDeleted) {
        await handler.onDelete(entity, businessId, transaction);
      } else {
        await handler.onSet(entity, businessId, transaction);
      }
    }

    // 2. Entity write
    transaction.set(docRef, data);

    // 3. Metadata writes
    for (const link of metaLinks) {
      const metaDocRef = db.doc(link.documentPath);
      transaction.update(metaDocRef, { [link.fieldPath]: metadata });
    }
  });
  ```
- In `delete()`, invoke the handler **before** the entity delete and metadata cleanup, for the same read-before-write reason:
  ```typescript
  await db.runTransaction(async (transaction) => {
    // 1. Handler reads + writes first
    const handler = this.relationshipHandlerRegistry.resolve(entity);
    if (handler) {
      await handler.onDelete(entity, businessId, transaction);
    }

    // 2. Entity delete
    transaction.delete(docRef);

    // 3. Metadata cleanup
    for (const link of metaLinks) {
      const metaDocRef = db.doc(link.documentPath);
      transaction.update(metaDocRef, { [link.fieldPath]: FieldValue.delete() });
    }
  });
  ```

### 2. `src/persistence/firestore/__tests__/FirestoreRepository.test.ts`

Add seven tests:
- `set()` invokes handler.onSet() inside transaction when handler is registered
- `set()` works without handler (no registry passed — existing behavior preserved)
- `set()` dispatches to handler.onDelete() when entity has isDeleted=true
- `delete()` invokes handler.onDelete() inside transaction when handler is registered
- `delete()` works without handler (existing behavior preserved)
- handler error rolls back entire transaction (entity write + metadata)
- handler `t.get()` is called before any transaction writes (enforces Firestore read-before-write constraint)

### 3. `MIGRATION.md`

Remove the "Known limitation" callout on line 474 and replace with full setup example showing:
- Creating the `RelationshipHandlerRegistry`
- Registering the three handlers
- Passing the registry as the second constructor argument to the relevant repositories (ProductRepository, OptionSetRepository, OptionRepository)
- Noting that the other 22 repositories do not need a handler registry

## Design Decisions & Edge Cases

### Firestore transaction read-before-write ordering

Firestore transactions require all reads (`t.get()`) to complete before any writes (`t.set()`, `t.update()`, `t.delete()`). The Firebase Admin SDK enforces this client-side — calling `t.get()` after any write method throws:

> `Error: Firestore transactions require all reads to be executed before all writes.`

All three relationship handlers perform `t.get()` queries to find parent documents (e.g., `ProductRelationshipHandler` queries Categories by `productDisplayOrder`). Therefore, handler invocation **must** precede the entity write and metadata writes inside the transaction. The handler's own writes (`t.update()` on parent documents) are fine after its reads — what matters is that no `t.get()` call follows any write.

The resulting execution order within each transaction:
1. Handler `t.get()` — READ (finds parent documents)
2. Handler `t.update()` — WRITE (updates parent metadata)
3. Entity `transaction.set()` / `transaction.delete()` — WRITE
4. Metadata `transaction.update()` — WRITE

All writes commit atomically regardless of their ordering within the transaction callback.

**Test enforcement:** The read-before-write test uses a mock transaction that tracks write calls and throws if `get()` is called after any write, mirroring the real Firestore behavior.

### `update()` is intentionally excluded

The `update()` method remains a bare `docRef.update()` with no transaction, no metadata writes, and no handler invocation. This is deliberate — `update()` is documented in MIGRATION.md (lines 199-204) as a lightweight path for field changes that don't affect metadata projections. Consumers who need cascading updates must use `set()`. No changes to `update()` are planned.

### Soft-delete dispatch

If a consumer constructs an entity with `isDeleted: true` and calls `set()`, the handler should cascade a delete, not an update. This is handled by the `isDeleted` check shown in the `set()` code above — the same block serves as both the wiring point and the soft-delete dispatch.

### Error handling / transaction blast radius

If a handler throws (e.g., a queried parent document doesn't exist, Firestore rejects an update), the entire transaction fails — the primary entity write and metadata writes are all rolled back. This is the desired behavior (atomic consistency), but it is a semantic change: previously `set()` could only fail on the entity write or metadata denormalization. Now it can also fail on cascading updates to sibling collections. This should be documented in the MIGRATION.md update as a behavioral note.

### Only 3 of 25 repositories benefit from handler wiring

The three relationship handlers target catalog entities:

| Repository | Handler |
|---|---|
| `ProductRepository` | `ProductRelationshipHandler` |
| `OptionSetRepository` | `OptionSetRelationshipHandler` |
| `OptionRepository` | `OptionRelationshipHandler` |

The other 22 repositories have no registered handlers — the `resolve()` call returns `null` and the handler block is skipped. The MIGRATION.md update should list these three repositories explicitly so consumers know which ones to pass a populated registry to.

### Catalog entities have no MetadataSpec (by design)

Product, Category, OptionSet, and Option all implement `MetadataProjection` but have no corresponding `MetadataSpec` registered in `MetadataRegistry`. This is intentional — their metadata propagates "upward" via relationship handlers (e.g., Product → Category), not via the MetadataSpec/MetaLinkDeclaration path (which handles Location → LocationsRoot, Menu → SurfacesRoot, MenuGroup → SurfacesRoot). The `metadataRegistry.getMetaLinks()` call in `set()` returns an empty array for these entities, and that is correct.

### BusinessFactory is a separate write path

`BusinessFactory.createBusiness()` writes all 8 aggregate root documents directly via Firestore transactions, bypassing repositories, MetadataRegistry, and RelationshipHandlerRegistry. This is acceptable because root aggregates don't have relationship handlers. If handlers are ever added for root entity types, BusinessFactory would need to be updated to invoke them.

## Additional Bug Fixes (from BUG.md)

The following bugs were identified in the same audit and are included in this issue.

### 4. Fix `LinkedObjectQueries` provider type mismatch (Bug #2 — Minor)

**File:** `src/persistence/firestore/LinkedObjectQueries.ts`

`linkedObjectQuery()` and `findByLinkedObjectId()` declare `provider: Constants.Provider` — a `const enum`. The `Repository<T>.findByLinkedObject()` interface declares `provider: string`. This creates a type mismatch for the same conceptual parameter. Callers passing a string literal like `'square'` to the standalone helpers get a TypeScript compile error.

**Fix:** Change both functions to accept `provider: string`, matching the repository interface.

### 5. Fix `findByLinkedObjectId` return type (Bug #3 — Minor)

**File:** `src/persistence/firestore/LinkedObjectQueries.ts`

Every other query method in the codebase returns a typed result with `null` for not-found. This legacy function returns `unknown` (untyped) and `false` (instead of `null`) for not-found. The inconsistency forces callers to cast the result and check for a non-standard sentinel value.

**Fix:** Change return type to `Promise<T | null>` (or at minimum `Promise<unknown | null>`), returning `null` instead of `false`.

### 6. Fix `PathResolver` hardcoded collection name (Bug #4 — Trivial)

**File:** `src/persistence/firestore/PathResolver.ts`

Every other `PathResolver` method references `Paths.CollectionNames.*` constants. `checkoutOptionsCollection()` uses a raw string literal `'checkoutOptions'` because the corresponding entry is missing from the `CollectionNames` enum in `src/firestore-core/Paths.ts`.

**Fix:**
1. Add `checkoutOptions = 'checkoutOptions'` to the `CollectionNames` enum in `src/firestore-core/Paths.ts`
2. Update `PathResolver.checkoutOptionsCollection()` to use `Paths.CollectionNames.checkoutOptions`

## Files Modified

1. `src/persistence/firestore/FirestoreRepository.ts`
2. `src/persistence/firestore/__tests__/FirestoreRepository.test.ts`
3. `MIGRATION.md`
4. `src/persistence/firestore/LinkedObjectQueries.ts` (bugs #2, #3)
5. `src/firestore-core/Paths.ts` (bug #4)
6. `src/persistence/firestore/PathResolver.ts` (bug #4)

## Verification

```bash
npm test
npm run tsc
```
