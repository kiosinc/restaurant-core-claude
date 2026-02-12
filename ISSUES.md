# Architecture Weakness Analysis — `@kiosinc/restaurant-core-claude`

Weaknesses ranked from most to least critical. Each issue verified against source code.

---

## 1. Magic Registration Pattern (Runtime Correctness Risk)

`MetadataRegistry` and `RelationshipHandlerRegistry` require manual registration at app startup. Forgetting a registration causes **silent failures** — `MetadataRegistry.getMetaLinks()` returns `[]` and `getMetadata()` returns `null` for unregistered entities, so the entity saves successfully but denormalized metadata is never written. There are no compile-time checks, no runtime warnings, and no way for TypeScript to enforce that all `MetadataProjection<T>` implementors have a registered spec.

Currently 6 registrations are required (3 MetadataSpecs, 3 RelationshipHandlers), all performed by the consuming application.

**Impact:** Data corruption via stale denormalized metadata. Bugs are invisible until a customer reports stale data in aggregate root documents (Surfaces, LocationsRoot).

---

## 2. No Runtime Validation Layer

Zero validation exists across 54 domain model files and 26 repository implementations. No validation libraries (Zod, Joi, class-validator) are installed. Domain constructors perform direct assignment with no guards — empty strings pass for required names, negative prices are accepted, tax rates can exceed 100%. The only `throw` statements in the persistence layer are for duplicate `linkedObjectId` query results, not input validation.

**Impact:** Bad data enters the system silently. Failures surface at Firestore write time (cryptic errors) or in downstream code far from the invalid input.

---

## 3. Query-Based Relationship Discovery (Performance)

All 3 `RelationshipHandler` implementations (`ProductRelationshipHandler`, `OptionSetRelationshipHandler`, `OptionRelationshipHandler`) execute Firestore queries **inside the write transaction** to discover affected documents:

- `ProductRelationshipHandler` queries Categories via `where('productDisplayOrder', 'array-contains', product.Id)`
- `OptionSetRelationshipHandler` queries Products via `where('optionSets.${id}.name', '>=', '')`
- `OptionRelationshipHandler` queries OptionSets via `where('options.${id}.name', '>=', '')`

These queries run before the entity write (lines 44–48 of `FirestoreRepository.set()`), holding the transaction open while waiting for results. Bulk operations are especially affected — importing 100 products means 100 separate transactions each executing a Category query.

**Impact:** Write latency scales with relationship count. Transaction contention increases under load. The range queries on map fields (`optionSets.${id}.name >= ''`) are particularly expensive.

---

## 4. Manual Converter Boilerplate

26 repositories each manually implement `toFirestore()` and `fromFirestore()` with field-by-field mapping. Converter code accounts for ~744 lines (61.6%) of all repository code. Common patterns are duplicated without abstraction:

- Date serialization (`toISOString()` / `new Date()`) — repeated 52+ times
- `linkedObjects` deep clone via `JSON.parse(JSON.stringify())` — 36 occurrences total
- Default value handling (`?? []`, `?? {}`) — repeated 100+ times
- `isDeleted` flag mapping — repeated in all 26 repositories

The only shared helper is `InventoryCountConverter` for one specific nested type. No generic converter factory exists.

**Impact:** High maintenance burden. Adding a field requires updating the model, props interface, converter, and metadata projection. Field omissions in converters cause silent data loss. Inconsistent use of `JSON.parse(JSON.stringify())` vs. direct assignment risks shared reference bugs.

---

## 5. Legacy RTDB Code

`EventNotification` (90 lines) and `SemaphoreV2` (117 lines) still use Firebase Realtime Database. Both are exported from `index.ts` with the comment `// RTDB modules — not migrated, kept as-is`. Neither appears to be used internally — searches for `new EventNotification`, `Semaphore.lock`, and `Semaphore.release` return zero matches. These are the only 2 files in the codebase that import `getDatabase()`.

**Impact:** Dead code that consumers may depend on. Creates confusion about which persistence approach to use. Maintaining two database systems adds operational overhead.

---

## Investigated and Dismissed

The following were initially flagged but removed after code verification:

**Firestore Vendor Lock-in** — The library is explicitly built for Firestore (per CLAUDE.md). Domain models have zero Firebase imports. The `Repository<T>` interface uses only plain TypeScript types. Firestore coupling in the persistence layer is the intended design, not a weakness.

**Metadata Denormalization Scalability** — The math doesn't support this concern. Only 2 aggregate roots have denormalized maps (Surfaces, LocationsRoot) with tiny metadata objects (2 fields each). Even extreme scenarios (500 menu groups, 1000 locations) use <12% of Firestore's 1MB document limit. Not realistic for the restaurant domain.

**No Authorization in Persistence** — This is a library consumed by an API layer. Authorization belongs in the consumer. The `Repository<T>` interface correctly accepts `businessId` as a parameter, deferring access control to the calling layer.

**Verbose Constructor Props** — Most fields have defaults via `??` operators. Test fixtures use factory helpers (`createTestProductProps()`, etc.) with `Partial<T>` overrides, making tests concise. Workable as-is.

**Incomplete TenantEntity Hierarchy** — Only `Location` extends `TenantEntity`, but this doesn't cause bugs. Most entities correctly omit `businessId` from their domain model — it's a repository-layer concern passed as a method parameter. `Order` and `Token` carry `businessId` as domain data for legitimate reasons. Cosmetic inconsistency, not a defect.

**No Domain Events** — The transaction-based approach provides strong consistency (ACID guarantees) appropriate for this scale. The 3 relationship handlers cover all current cross-aggregate coordination needs. Domain events would add infrastructure complexity (message queues, eventual consistency) without clear benefit.

**Static PathResolver** — Tests work effectively by mocking `getFirestore()` via `vi.mock('firebase-admin/firestore')`. PathResolver's static methods then use the mocked database. All 31 repository test files follow this pattern successfully. Design choice, not a testability problem.

---

## Summary

The domain/persistence separation is well-executed — domain models are pure TypeScript with zero Firebase imports and full unit testability. The verified weaknesses are concentrated in the persistence layer:

1. **Magic registration** is the most dangerous — silent failures cause invisible data staleness
2. **No validation** allows bad data to enter the system unchecked
3. **In-transaction queries** in relationship handlers create a performance ceiling
4. **Converter boilerplate** is a maintenance burden that grows with every new entity
5. **Legacy RTDB code** is minor dead weight

Issues 1 and 2 would deliver the highest ROI if addressed first.
