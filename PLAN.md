# Plan: Decouple Firestore from Domain Models

## Goal
Separate domain models (pure data + business logic) from Firestore persistence, enabling unit testing without Firebase and cleaner architecture. Old API deprecated gradually; new API introduced alongside.

---

## Current Coupling Points

1. **Base class inheritance** — Models extend `FirestoreObject`/`FirestoreObjectV2` which import `firebase-admin/firestore` at module level
2. **Static data access** — `Product.collectionRef()`, `Location.get()`, `location.set()` call Firestore directly
3. **`firestoreConverter`** — Serialization uses Firestore types (`QueryDocumentSnapshot`, `DocumentData`)
4. **`metaLinks()`** — Returns Firestore document paths for cross-document denormalization
5. **`FirestoreWriter`** — Contains `instanceof` checks against domain types for relationship management
6. **`autoId()`** — Calls `getFirestore()` to generate IDs, fails without Firebase init
7. **`LinkedObject.find()`/`findQuery()`** — Constructs Firestore `where` queries

---

## Target Architecture

```
DOMAIN LAYER (pure TS, zero Firebase imports)     PERSISTENCE LAYER (Firestore-specific)
─────────────────────────────────────────────     ─────────────────────────────────────────
DomainEntity (base: Id, created, updated)         Repository<T> interface
TenantEntity (base + businessId)                  FirestoreRepository<T> base impl
Product, Location, Order, Event, ...              ProductRepository, LocationRepository, ...
metadata() — pure field projection                MetadataRegistry — resolves metaLinks to paths
LinkedObject — data class only                    RelationshipHandlerRegistry — replaces instanceof
IdGenerator interface                             FirestoreIdGenerator implementation
```

**Key rule:** Domain layer never imports from persistence. Repositories depend on domain.

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| `metadata()` stays on domain models | It's a pure field projection — no Firestore types |
| `metaLinks()` moves to `MetadataSpec` in persistence | It constructs Firestore paths — persistence concern |
| `RelationshipHandler` replaces `instanceof` chains | Keeps repositories single-entity; cross-entity logic in dedicated handlers |
| Pluggable `IdGenerator` via static setter | Least invasive; `autoId()` replaced by UUID default, Firestore impl optional |
| `DistributedCounter` stays in persistence as-is | Deeply Firestore-coupled, no domain logic to extract |

---

## Phased Migration

### Phase 0: Foundation (no breaking changes)
New files only — no existing code modified except `index.ts` exports.

1. Create `src/domain/DomainEntity.ts` — base class with `Id`, `created`, `updated`, `isDeleted`, pluggable ID gen (UUID default)
2. Create `src/domain/TenantEntity.ts` — extends DomainEntity, adds `businessId`
3. Create `src/domain/IdGenerator.ts` — interface
4. Create `src/domain/MetadataSpec.ts` — pure interfaces for metadata declarations
5. Create `src/persistence/Repository.ts` — generic `get`/`set`/`update`/`delete`/`findByLinkedObject` interface
6. Create `src/persistence/firestore/FirestoreRepository.ts` — base implementation with metadata transaction support
7. Create `src/persistence/MetadataRegistry.ts` — resolves `MetaLinkDeclaration` to Firestore paths
8. Set up test framework (Jest or Vitest) — tsconfig already excludes `__tests__`
9. Export new types from `src/index.ts`

### Phase 1: Migrate Leaf Models (Event, Order)
**Why first:** Both have empty `metaLinks()`/`metadata()` — no denormalization complexity.

1. Create pure `src/domain/connected-accounts/Event.ts` and `src/domain/orders/Order.ts`
2. Create `src/persistence/firestore/EventRepository.ts` and `OrderRepository.ts` (converter logic moves here)
3. Move `OrderSymbols.ts` to `src/domain/orders/` (already pure enums)
4. Mark old classes `@deprecated`
5. Write unit tests — instantiate domain objects without Firebase

### Phase 2: Migrate LinkedObject
1. Create `src/domain/connected-accounts/LinkedObject.ts` — data class only
2. Move `find`/`findQuery` logic to `src/persistence/firestore/LinkedObjectQueries.ts`
3. Mark old static methods `@deprecated`

### Phase 3: Migrate Location (first model with metadata)
1. Create pure `src/domain/locations/Location.ts` extending `TenantEntity`
2. Keep `metadata()` on domain class
3. Register `LocationMetadataSpec` in `MetadataRegistry`
4. Create `src/persistence/firestore/LocationRepository.ts`
5. Deprecate `Location.get()`, `Location.find()`, `location.set()`, `location.update()`

### Phase 4: Migrate Catalog Models (hardest — cross-entity relationships)
Migration order: **Option → OptionSet → Product → Category** (bottom-up dependency)

For each model:
1. Create pure domain class in `src/domain/catalog/`
2. Create repository in `src/persistence/firestore/`
3. Create `RelationshipHandler` in `src/persistence/firestore/handlers/`

Then refactor `FirestoreWriter.setT()`/`deleteT()` to use `RelationshipHandlerRegistry` instead of `instanceof` chains.

### Phase 5: Migrate Root/Aggregate Classes
1. Extract pure data from `Business`, `Catalog`, `Surfaces`, `Orders`, `Locations`, `ConnectedAccounts` roots
2. Move Firestore path resolution to repositories
3. Refactor `BusinessUtilities.createBusiness()` to use a `UnitOfWork` pattern wrapping the transaction

### Phase 6: Cleanup (major version bump)
1. Remove deprecated facade classes
2. Remove `FirestoreObject`, `FirestoreObjectV2`, `FirestoreWriter`
3. Update `src/index.ts` to export only from `src/domain/` and `src/persistence/`
4. Publish as next major version with migration guide

---

## Dependency Graph

```
Phase 0 ──┬── Phase 1 (leaf models) ── Phase 2 (LinkedObject)
           │                                    │
           └── Phase 3 (Location + metadata) ───┘
                        │
                   Phase 4 (Catalog + relationships)
                        │
                   Phase 5 (Roots)
                        │
                   Phase 6 (Cleanup)
```

Phases 1-2 and Phase 3 can proceed in parallel after Phase 0.

---

## Critical Files

| File | Role |
|------|------|
| `src/firestore-core/core/FirestoreObject.ts` | V1 base — contract to replace |
| `src/firestore-core/core/FirestoreObjectV2.ts` | V2 base — CRUD to extract into repositories |
| `src/firestore-core/core/FirestoreWriter.ts` | `instanceof` chains → RelationshipHandlers |
| `src/firestore-core/core/LinkedObject.ts` | Data class stays, query methods move |
| `src/restaurant/locations/Location.ts` | Best first full-migration candidate |
| `src/restaurant/catalog/Product.ts` | Representative V1 model with metadata |
| `src/restaurant/connected-accounts/Event.ts` | Simplest leaf model |
| `src/restaurant/orders/OrderV3.ts` | Leaf model, no metadata |
| `src/restaurant/roots/BusinessUtilities.ts` | Transaction logic → UnitOfWork |
| `src/index.ts` | Must export both old (deprecated) and new APIs |

---

## Verification

- **Unit tests:** Instantiate each migrated domain model without Firebase initialized — must not throw
- **Metadata test:** Verify `metadata()` returns correct field projections
- **Repository tests (emulator):** `set()` then `get()` round-trips correctly, metadata denormalized to parent docs
- **Deprecation check:** Old API (`Location.get()`, `product.set()`) still works via facade
- **Compile:** `npm run tsc` passes with no errors after each phase
- **Lint:** `npx eslint src/` passes after each phase
