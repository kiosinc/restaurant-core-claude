# Architecture Weakness Analysis — `@kiosinc/restaurant-core-claude`

Weaknesses ranked from most to least critical. Each issue verified against source code.
Last updated: 2026-03-16.

---

## 1. Magic Registration Pattern (Runtime Correctness Risk)

`MetadataRegistry` and `RelationshipHandlerRegistry` require manual registration at app startup. Forgetting a registration causes **silent failures** — `MetadataRegistry.getMetaLinks()` returns `[]` and `getMetadata()` returns `null` for unregistered entities, so the entity saves successfully but denormalized metadata is never written. There are no compile-time checks, no runtime warnings, and no way for TypeScript to enforce that all `MetadataSpec<T>` implementors have a registered spec.

Currently 6 registrations are required (3 MetadataSpecs, 3 RelationshipHandlers), all performed by the consuming application.

**Impact:** Data corruption via stale denormalized metadata. Bugs are invisible until a customer reports stale data in aggregate root documents (Surfaces, LocationsRoot).

---

## 2. Query-Based Relationship Discovery (Performance)

All 3 `RelationshipHandler` implementations (`ProductRelationshipHandler`, `OptionSetRelationshipHandler`, `OptionRelationshipHandler`) execute Firestore queries **inside the write transaction** to discover affected documents:

- `ProductRelationshipHandler` queries Categories via `where('productDisplayOrder', 'array-contains', product.Id)`
- `OptionSetRelationshipHandler` queries Products via `where('optionSets.${id}.name', '>=', '')`
- `OptionRelationshipHandler` queries OptionSets via `where('options.${id}.name', '>=', '')`

These queries run before the entity write (`FirestoreRepository.set()` lines 44–58), holding the transaction open while waiting for results. Bulk operations are especially affected — importing 100 products means 100 separate transactions each executing a Category query.

**Impact:** Write latency scales with relationship count. Transaction contention increases under load. The range queries on map fields (`optionSets.${id}.name >= ''`) are particularly expensive.

---

## 3. `MenuAsset.configuration` Typed as `any` (Type Safety)

`MenuAsset` in `src/domain/surfaces/Menu.ts` declares `configuration?: any`. This is the only `any` in the domain model layer and loses all type safety for menu asset configuration. The `assetType` field is a proper string union (`'product' | 'group' | 'collection' | 'htmlText'`), so a discriminated union on `configuration` is feasible.

**Impact:** No compile-time protection against invalid configuration data. Consumers must cast or guess at the shape. Bugs in asset configuration only surface at runtime.

---

## 4. Validation Gaps — `requireString` vs `requireNonEmptyString`

Factory functions for catalog entities (`createProduct`, `createCategory`, `createMenu`, `createMenuGroup`, `createOptionSet`, `createOption`) validate name with `requireString()`, which only checks `typeof value !== 'string'` — empty strings pass. In contrast, `createOrder` and `createLocation` validate with `requireNonEmptyString()`, which rejects empty/whitespace strings.

This means a Product, Category, or Menu can be created with `name: ''` and persisted to Firestore without error.

**Impact:** Empty-name entities enter the system silently. Inconsistent behavior across entity types — the same field (`name`) has different validation rules depending on the model.

---

## 5. `MenuProductMeta` / `ProductMeta` Shape Drift

Two different shapes exist for denormalized product data:

- `ProductMeta` (in `Product.ts`): `name`, `isActive`, `imageUrls`, `imageGsls`, `minPrice`, `maxPrice`, `variationCount`
- `MenuProductMeta` (in `Menu.ts`): `isActive`, `name`, `imageGsls`, `minPrice`, `variationCount`, `description`

`MenuProductMeta` adds `description`, drops `imageUrls` and `maxPrice`. `MenuGroup.products` uses `ProductMeta`, but `MenuGroupMeta.products` uses `MenuProductMeta`. There is no shared base type or extraction function for `MenuProductMeta` — it is materialized inline in `MenuRebuildService.ts:149-156`.

**Impact:** Two representations of "product summary" that can drift independently. Changes to product denormalization require updates in multiple places with no compiler help.

---

## 6. Inconsistent Null vs Empty-String Defaults

Optional fields across domain models default to either `null` or `''` with no consistent rule:

- `Menu.displayName` defaults to `null`
- `MenuGroup.displayName` defaults to `''`
- `Option.sku` defaults to `null`
- `Product.caption` defaults to `''`

**Impact:** Consumers must handle both `null` and `''` as "absent" for the same semantic concept. Equality checks and conditional rendering diverge depending on which entity type is involved.

---

## 7. `resolveChangedProducts` Full-Table Scans (Conditional)

`MenuRebuildService.resolveChangedProducts()` uses indexed `syncTraceId` queries to find directly changed entities, but then performs full-collection scans to walk up the dependency tree:

- If any options changed: reads **all** option sets (`.select('options').get()`) to find containing option sets
- If any option sets changed: reads **all** products (`.select('optionSets').get()`) to find containing products

The scans use `.select()` projections (only fetching the map field), and they're conditional — they only trigger when options or option sets were modified. But in the worst case (a sync that touches options), it reads every option set and every product document for the business.

**Impact:** For a business with 1000 products and 100 option sets, a single option change triggers ~1,100 document reads even though only a few are relevant.

---

## 8. Legacy RTDB Code

`EventNotification` (`src/restaurant/connected-accounts/EventNotification.ts`, 90 lines) still uses Firebase Realtime Database (`firebase-admin/database`). It is the only file in the codebase that imports `getDatabase()`.

**Impact:** Dead code that consumers may depend on. Creates confusion about which persistence approach to use.

---

## Resolved Issues (Previously Listed)

**No Runtime Validation Layer (formerly #2)** — Resolved. `src/domain/validation.ts` now provides 6 validators (`requireString`, `requireNonEmptyString`, `requireNonNegativeNumber`, `requireNonNegativeInteger`, `requireNonNegativeIntegerOrNeg1`, `requireMinLessOrEqual`) with a `ValidationError` class. All factory functions actively validate inputs. Remaining gap is the `requireString` vs `requireNonEmptyString` inconsistency (see issue #4 above).

**Manual Converter Boilerplate (formerly #4)** — Resolved. `converterFactory.ts` provides `createConverter<T>()` with `FieldTransform` hooks. `baseFields.ts` centralizes date serialization and `isDeleted` mapping. Most converters in `simpleConverters.ts` are one-liners. Shared `inventoryTransform` handles Product/OptionSet/Option inventory fields.

**SemaphoreV2 RTDB (formerly part of #5)** — Resolved. `SemaphoreV2` was migrated to Firestore. Only `EventNotification` remains on RTDB.

---

## Investigated and Dismissed

The following were initially flagged but removed after code verification:

**Firestore Vendor Lock-in** — The library is explicitly built for Firestore (per CLAUDE.md). Domain models have zero Firebase imports. The `Repository<T>` interface uses only plain TypeScript types. Firestore coupling in the persistence layer is the intended design, not a weakness.

**Metadata Denormalization Scalability** — The math doesn't support this concern. Only 2 aggregate roots have denormalized maps (Surfaces, LocationsRoot) with tiny metadata objects (2 fields each). Even extreme scenarios (500 menu groups, 1000 locations) use <12% of Firestore's 1MB document limit. Not realistic for the restaurant domain.

**No Authorization in Persistence** — This is a library consumed by an API layer. Authorization belongs in the consumer. The `Repository<T>` interface correctly accepts `businessId` as a parameter, deferring access control to the calling layer.

**Incomplete TenantEntity Hierarchy** — Only `Location` extends `TenantEntity`, but this doesn't cause bugs. Most entities correctly omit `businessId` from their domain model — it's a repository-layer concern passed as a method parameter. `Order` and `Token` carry `businessId` as domain data for legitimate reasons. Cosmetic inconsistency, not a defect.

**No Domain Events** — The transaction-based approach provides strong consistency (ACID guarantees) appropriate for this scale. The 3 relationship handlers cover all current cross-aggregate coordination needs. Domain events would add infrastructure complexity (message queues, eventual consistency) without clear benefit.

**Static PathResolver** — Tests work effectively by mocking `getFirestore()` via `vi.mock('firebase-admin/firestore')`. PathResolver's static methods then use the mocked database. All repository test files follow this pattern successfully. Design choice, not a testability problem.

**Duplicate Order Price Adjustments** — `Order.taxes/discounts/surcharges` are order-level adjustments; `OrderLineItem.taxes/discounts/surcharges` are line-level adjustments. These are different data, not duplicates. Standard POS pattern.

**LinkedObjectMap Key Naming** — `Order.linkedObjects` uses `{ [Id: string]: LinkedObjectRef }` while `LinkedObjectMap` uses `{ [provider: string]: LinkedObjectRef }`. The difference is only in the TypeScript type parameter name — functionally identical. Not a real inconsistency.

---

## Summary

The domain/persistence separation is well-executed — domain models are pure TypeScript with zero Firebase imports and full unit testability. The remaining weaknesses:

1. **Magic registration** is the most dangerous — silent failures cause invisible data staleness
2. **In-transaction queries** in relationship handlers create a performance ceiling
3. **MenuAsset `any`** is a type safety hole in an otherwise well-typed domain layer
4. **Validation inconsistency** allows empty-name catalog entities
5. **Meta shape drift** between ProductMeta and MenuProductMeta adds maintenance risk
6. **Null/empty-string inconsistency** burdens consumers
7. **resolveChangedProducts scans** are a latent performance issue at scale
8. **Legacy RTDB** in EventNotification is minor dead weight

Issue 1 would deliver the highest ROI if addressed first.
