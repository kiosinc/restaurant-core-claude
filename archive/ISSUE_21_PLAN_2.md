# Plan: Repository Interfaces + Pure Domain Services (Hard Cutover)

## Context

Business logic is currently trapped inside Firestore-specific code. The 3 `RelationshipHandler` implementations contain genuine domain rules (cascade metadata updates across catalog entities) but express them using `FirebaseFirestore.Transaction`, `PathResolver`, and `FieldValue.delete()`. There's no abstraction layer for data access — everything depends directly on `FirestoreRepository<T>`. This plan adds repository interfaces to the domain layer and extracts business logic into a pure domain service, all in a single hard cutover.

---

## Part 1: Repository Interfaces

### Design: One base interface + per-entity type aliases

Create a generic `Repository<T>` interface in the domain layer, then a typed alias for each entity. Most aliases are empty (same 4 methods), but the pattern gives consumers type-safe injection points like `ProductRepository` instead of `Repository<Product>`.

### New files to create

**`src/domain/repositories/Repository.ts`** — base interface:
```ts
/**
 * Minimal CRUD repository interface for domain-layer abstractions.
 *
 * This interface is intentionally CRUD-only. Query methods like linked-object
 * lookups are not included because not all entities support them (only entities
 * with a `linkedObjects` field — catalog types, Location, and Order).
 *
 * For linked-object queries, use the concrete FirestoreRepository<T>.findByLinkedObject()
 * method, or the standalone Persistence.linkedObjectQuery() / Persistence.findByLinkedObjectId()
 * helpers.
 */
export interface Repository<T extends BaseEntity> {
  get(businessId: string, id: string): Promise<T | null>;
  set(entity: T, businessId: string): Promise<void>;
  update(entity: T, businessId: string): Promise<void>;
  delete(businessId: string, id: string): Promise<void>;
}
```

**`src/domain/repositories/catalog.ts`** — catalog repo types:
- `ProductRepository extends Repository<Product>`
- `CategoryRepository extends Repository<Category>`
- `OptionSetRepository extends Repository<OptionSet>`
- `OptionRepository extends Repository<Option>`
- `TaxRateRepository extends Repository<TaxRate>`
- `DiscountRepository extends Repository<Discount>`
- `ServiceChargeRepository extends Repository<ServiceCharge>`

**`src/domain/repositories/orders.ts`**:
- `OrderRepository extends Repository<Order>`
- `OrderSettingsRepository extends Repository<OrderSettings>`

**`src/domain/repositories/locations.ts`**:
- `LocationRepository extends Repository<Location>`

**`src/domain/repositories/surfaces.ts`**:
- `MenuRepository extends Repository<Menu>`
- `MenuGroupRepository extends Repository<MenuGroup>`
- `SurfaceConfigurationRepository extends Repository<SurfaceConfiguration>`
- `KioskConfigurationRepository extends Repository<KioskConfiguration>`
- `CheckoutOptionsRepository extends Repository<CheckoutOptions>`

**`src/domain/repositories/connected-accounts.ts`**:
- `EventRepository extends Repository<Event>`
- `TokenRepository extends Repository<Token>`

**`src/domain/repositories/onboarding.ts`**:
- `OnboardingOrderRepository extends Repository<OnboardingOrder>`

**`src/domain/repositories/roots.ts`** — import root types from source files (not barrel) to use original interface names:
- `BusinessRepository extends Repository<Business>`
- `CatalogRootRepository extends Repository<Catalog>`
- `LocationsRootRepository extends Repository<LocationsRoot>`
- `SurfacesRootRepository extends Repository<Surfaces>` (import from `'../roots/Surfaces'`)
- `ConnectedAccountsRootRepository extends Repository<ConnectedAccounts>` (import from `'../roots/ConnectedAccounts'`)
- `ServicesRepository extends Repository<Services>`
- `OnboardingRootRepository extends Repository<Onboarding>`

> **Import note:** `Surfaces` and `ConnectedAccounts` are re-exported as `SurfacesRoot` and `ConnectedAccountsRoot` from the roots barrel. Import from the source files (`'../roots/Surfaces'`, `'../roots/ConnectedAccounts'`) to use the original interface names.

**`src/domain/repositories/index.ts`** — barrel export for all.

### Files to modify

| File | Change |
|------|--------|
| `src/persistence/firestore/FirestoreRepository.ts` | Add `implements Repository<T>` to class declaration |
| `src/domain/index.ts` | Add `export * as Repositories from './repositories'` |

---

## Part 2: Domain Service — CatalogCascadeService

### Extracted from RelationshipHandlers

Extracts the business logic from the 3 `RelationshipHandler` implementations into a **purely computational, synchronous** service with zero Firestore dependencies.

**`src/domain/services/CatalogCascadeService.ts`**

The service exposes 6 pure methods that take entity + parent IDs (already queried by the handler) and return a `ParentUpdate[]` describing field mutations:

| Method | Input | Returns |
|--------|-------|---------|
| `onProductSaved(product, parentIds)` | Product + string[] | ParentUpdate[] — set `products.{id}` to ProductMeta |
| `onProductDeleted(product, parentIds)` | Product + string[] | ParentUpdate[] — delete `products.{id}`, remove from productDisplayOrder |
| `onOptionSetSaved(optionSet, parentIds)` | OptionSet + string[] | ParentUpdate[] — set `optionSets.{id}` to OptionSetMeta |
| `onOptionSetDeleted(optionSet, parentIds)` | OptionSet + string[] | ParentUpdate[] — delete `optionSets.{id}` + `optionSetsSelection.{id}` |
| `onOptionSaved(option, parentIds)` | Option + string[] | ParentUpdate[] — set `options.{id}` to OptionMeta |
| `onOptionDeleted(option, parentIds)` | Option + string[] | ParentUpdate[] — delete `options.{id}`, remove from optionDisplayOrder + preselectedOptionIds |

**Supporting types:**
```ts
export interface FieldUpdate {
  fieldsToSet: Record<string, unknown>;
  fieldsToDelete: string[];
  arrayFieldRemovals: Record<string, string>; // field → value to remove
}

export interface ParentUpdate {
  parentId: string;
  update: FieldUpdate;
}
```

Uses existing domain functions: `productMeta()`, `optionSetMeta()`, `optionMeta()` from catalog modules.

### Barrel export

**`src/domain/services/index.ts`** — exports CatalogCascadeService + supporting types.

### Files to modify

| File | Change |
|------|--------|
| `src/domain/index.ts` | Add `export * as Services from './services'` |

---

## Part 3: Refactor RelationshipHandlers

The 3 handlers become thin Firestore orchestrators that:
1. Query for parent documents inside the transaction (as today)
2. Extract parent IDs from query snapshots — no entity conversion needed
3. Call `CatalogCascadeService` pure methods to compute updates
4. Translate `ParentUpdate[]` → Firestore `FieldValue` operations in the transaction

### Files to modify

| File | Change |
|------|--------|
| `src/persistence/firestore/handlers/ProductRelationshipHandler.ts` | Add `CatalogCascadeService` constructor param, extract parent IDs via `snapshot.docs.map(d => d.id)`, delegate to `onProductSaved`/`onProductDeleted`, use shared `applyFieldUpdates()` |
| `src/persistence/firestore/handlers/OptionSetRelationshipHandler.ts` | Same pattern — delegates to `onOptionSetSaved`/`onOptionSetDeleted` |
| `src/persistence/firestore/handlers/OptionRelationshipHandler.ts` | Same pattern — delegates to `onOptionSaved`/`onOptionDeleted` |

**No changes** to `RelationshipHandler.ts` interface or `RelationshipHandlerRegistry.ts`.

**Breaking change:** Handler constructors now require `CatalogCascadeService`. Consumers who instantiate handlers directly must update:
```ts
const cascadeService = new CatalogCascadeService();
registry.register('product', new ProductRelationshipHandler(cascadeService));
```

### Shared `applyFieldUpdates` helper

All 3 handlers need the same FieldUpdate → FieldValue translation. Extract a shared helper function in `src/persistence/firestore/handlers/applyFieldUpdates.ts`:

```ts
export function applyFieldUpdates(
  updates: ParentUpdate[],
  collectionRef: CollectionReference,
  transaction: Transaction,
): void {
  for (const { parentId, update } of updates) {
    const docRef = collectionRef.doc(parentId);
    const data: Record<string, any> = {};
    for (const [field, value] of Object.entries(update.fieldsToSet)) {
      data[field] = value;
    }
    for (const field of update.fieldsToDelete) {
      data[field] = FieldValue.delete();
    }
    for (const [field, value] of Object.entries(update.arrayFieldRemovals)) {
      data[field] = FieldValue.arrayRemove(value);
    }
    transaction.update(docRef, data);
  }
}
```

---

## Part 4: Tests

### New test files

| File | Tests | Firestore? |
|------|-------|------------|
| `src/domain/services/__tests__/CatalogCascadeService.test.ts` | ~18 tests: 3 entities × 2 ops × 3 cases (single parent, multiple parents, no parents) | **No** |
| `src/domain/repositories/__tests__/Repository.test.ts` | Type-level test: verify `FirestoreRepository<T>` satisfies `Repository<T>` | **No** |

### Modified test files

| File | Change |
|------|--------|
| `src/persistence/firestore/handlers/__tests__/ProductRelationshipHandler.test.ts` | Construct handler with `new CatalogCascadeService()`, same behavioral assertions |
| `src/persistence/firestore/handlers/__tests__/OptionSetRelationshipHandler.test.ts` | Same |
| `src/persistence/firestore/handlers/__tests__/OptionRelationshipHandler.test.ts` | Same |

### Key fixtures to reuse
- `src/domain/__tests__/helpers/CatalogFixtures.ts` — `createTestProductInput`, `createTestOptionSetInput`, `createTestOptionInput`, `createTestCategoryInput`, `createTestTaxRateInput`, `createTestDiscountInput`, `createTestServiceChargeInput`

---

## Part 5: File Summary

### New files (12)

| # | File | Purpose |
|---|------|---------|
| 1 | `src/domain/repositories/Repository.ts` | Base `Repository<T>` interface |
| 2 | `src/domain/repositories/catalog.ts` | Product, Category, OptionSet, Option, TaxRate, Discount, ServiceCharge repos |
| 3 | `src/domain/repositories/orders.ts` | Order, OrderSettings repos |
| 4 | `src/domain/repositories/locations.ts` | Location repo |
| 5 | `src/domain/repositories/surfaces.ts` | Menu, MenuGroup, SurfaceConfig, KioskConfig, CheckoutOptions repos |
| 6 | `src/domain/repositories/connected-accounts.ts` | Event, Token repos |
| 7 | `src/domain/repositories/onboarding.ts` | OnboardingOrder repo |
| 8 | `src/domain/repositories/roots.ts` | All aggregate root repos |
| 9 | `src/domain/repositories/index.ts` | Barrel export |
| 10 | `src/domain/services/CatalogCascadeService.ts` | Pure cascade computation |
| 11 | `src/domain/services/index.ts` | Barrel export |
| 12 | `src/persistence/firestore/handlers/applyFieldUpdates.ts` | Shared FieldUpdate → FieldValue translation |

### New test files (2)

| # | File |
|---|------|
| 13 | `src/domain/services/__tests__/CatalogCascadeService.test.ts` |
| 14 | `src/domain/repositories/__tests__/Repository.test.ts` |

### Modified files (9)

| # | File | Change |
|---|------|--------|
| 1 | `src/persistence/firestore/FirestoreRepository.ts` | `implements Repository<T>` |
| 2 | `src/domain/index.ts` | Add Repositories + Services exports |
| 3 | `src/persistence/firestore/handlers/ProductRelationshipHandler.ts` | Inject CatalogCascadeService, delegate logic |
| 4 | `src/persistence/firestore/handlers/OptionSetRelationshipHandler.ts` | Same |
| 5 | `src/persistence/firestore/handlers/OptionRelationshipHandler.ts` | Same |
| 6 | `src/persistence/firestore/handlers/__tests__/ProductRelationshipHandler.test.ts` | Construct with CatalogCascadeService |
| 7 | `src/persistence/firestore/handlers/__tests__/OptionSetRelationshipHandler.test.ts` | Same |
| 8 | `src/persistence/firestore/handlers/__tests__/OptionRelationshipHandler.test.ts` | Same |
| 9 | `MIGRATION.md` | Update handler registration to include CatalogCascadeService; add Repositories + Services namespaces |

### Untouched (by design)
- All 29 converters, all entity files, MetadataRegistry, MetadataSpecs, PathResolver, BusinessFactory, RelationshipHandler interface, RelationshipHandlerRegistry

---

## Implementation Tracker

### Phase 1: Repository Interfaces

- [x] **1.1** Create `src/domain/repositories/Repository.ts` — base `Repository<T>` interface
- [x] **1.2** Create `src/domain/repositories/catalog.ts` — ProductRepository, CategoryRepository, OptionSetRepository, OptionRepository, TaxRateRepository, DiscountRepository, ServiceChargeRepository
- [x] **1.3** Create `src/domain/repositories/orders.ts` — OrderRepository, OrderSettingsRepository
- [x] **1.4** Create `src/domain/repositories/locations.ts` — LocationRepository
- [x] **1.5** Create `src/domain/repositories/surfaces.ts` — MenuRepository, MenuGroupRepository, SurfaceConfigurationRepository, KioskConfigurationRepository, CheckoutOptionsRepository
- [x] **1.6** Create `src/domain/repositories/connected-accounts.ts` — EventRepository, TokenRepository
- [x] **1.7** Create `src/domain/repositories/onboarding.ts` — OnboardingOrderRepository
- [x] **1.8** Create `src/domain/repositories/roots.ts` — BusinessRepository, CatalogRootRepository, LocationsRootRepository, SurfacesRootRepository, ConnectedAccountsRootRepository, ServicesRepository, OnboardingRootRepository, OrderSettingsRootRepository (import `Surfaces` and `ConnectedAccounts` from source files, not barrel)
- [x] **1.9** Create `src/domain/repositories/index.ts` — barrel export
- [x] **1.10** Modify `src/persistence/firestore/FirestoreRepository.ts` — add `implements Repository<T>`
- [x] **1.11** Create `src/domain/repositories/__tests__/Repository.test.ts` — type-level verification
- [x] **1.12** Run `npm run tsc` — verify compilation

### Phase 2: CatalogCascadeService

- [x] **2.1** Create `src/domain/services/CatalogCascadeService.ts` — FieldUpdate, ParentUpdate types + 6 pure methods (onProductSaved, onProductDeleted, onOptionSetSaved, onOptionSetDeleted, onOptionSaved, onOptionDeleted). Methods take `(entity, parentIds: string[])` and return `ParentUpdate[]`.
- [x] **2.2** Create `src/domain/services/index.ts` — barrel export
- [x] **2.3** Create `src/domain/services/__tests__/CatalogCascadeService.test.ts` — 18 tests:
  - [x] onProductSaved: single parent, multiple parents, no parents
  - [x] onProductDeleted: fieldsToDelete + arrayFieldRemovals correct, no parents
  - [x] onOptionSetSaved: single parent, multiple parents, no parents
  - [x] onOptionSetDeleted: removes optionSets + optionSetsSelection, no parents
  - [x] onOptionSaved: single parent, multiple parents, no parents
  - [x] onOptionDeleted: removes options + optionDisplayOrder + preselectedOptionIds, no parents
- [x] **2.4** Run `npm test` — new service tests pass, zero Firestore imports confirmed

### Phase 3: Refactor RelationshipHandlers

- [x] **3.1** Create `src/persistence/firestore/handlers/applyFieldUpdates.ts` — shared helper translating ParentUpdate[] → Firestore FieldValue operations using `collectionRef.doc(parentId)`
- [x] **3.2** Refactor `src/persistence/firestore/handlers/ProductRelationshipHandler.ts`:
  - [x] Add CatalogCascadeService constructor param
  - [x] Extract parent IDs from query snapshot: `snapshot.docs.map(d => d.id)`
  - [x] Delegate business logic to `cascadeService.onProductSaved()` / `onProductDeleted()`
  - [x] Use shared `applyFieldUpdates()` for transaction writes
- [x] **3.3** Refactor `src/persistence/firestore/handlers/OptionSetRelationshipHandler.ts`:
  - [x] Add CatalogCascadeService constructor param
  - [x] Extract parent IDs from query snapshot
  - [x] Delegate to `cascadeService.onOptionSetSaved()` / `onOptionSetDeleted()`
  - [x] Use shared `applyFieldUpdates()`
- [x] **3.4** Refactor `src/persistence/firestore/handlers/OptionRelationshipHandler.ts`:
  - [x] Add CatalogCascadeService constructor param
  - [x] Extract parent IDs from query snapshot
  - [x] Delegate to `cascadeService.onOptionSaved()` / `onOptionDeleted()`
  - [x] Use shared `applyFieldUpdates()`
- [x] **3.5** Update `src/persistence/firestore/handlers/__tests__/ProductRelationshipHandler.test.ts` — construct with `new CatalogCascadeService()`, verify same behavioral assertions
- [x] **3.6** Update `src/persistence/firestore/handlers/__tests__/OptionSetRelationshipHandler.test.ts` — same
- [x] **3.7** Update `src/persistence/firestore/handlers/__tests__/OptionRelationshipHandler.test.ts` — same
- [x] **3.8** Run `npm test` — all 549 tests pass

### Phase 4: Barrel Exports + Migration Guide + Final Verification

- [x] **4.1** Modify `src/domain/index.ts` — add `export * as Repositories from './repositories'` and `export * as Services from './services'`
- [x] **4.2** MIGRATION.md — already up-to-date (handler registration examples include `CatalogCascadeService`, `Domain.Repositories` and `Domain.Services` namespace entries present)
- [x] **4.3** Run `npm run tsc` — clean compilation, no errors
- [x] **4.4** Run `npm test` — all 549 tests pass (72 test files)
- [x] **4.5** Run `npx eslint src/` — 0 errors, 388 pre-existing warnings
- [x] **4.6** Manual review: confirmed CatalogCascadeService.test.ts has **zero** imports from `firebase-admin` or `src/persistence/`
- [x] **4.7** Bump version in `package.json` — 1.0.0 → 1.1.0
