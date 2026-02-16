# Analysis: ISSUE_21_PLAN.md — Success Potential, Completeness & Coverage

## Executive Summary

The plan is **well-researched and highly accurate** (~98%). It correctly identifies 25 repositories, 25 persistent domain models, all metadata/handler files, and proper scope boundaries. The tiered migration approach is sound. A few minor naming inconsistencies and gaps exist but nothing structurally wrong.

**Verdict: High probability of success** given minimal external consumer coupling and comprehensive test coverage (72 files, 510+ tests).

---

## 1. Potential for Success

### Strengths

| Factor | Assessment |
|--------|------------|
| **Consumer coupling** | Very low — repository imports found only in tests and internal code, not in external consumers |
| **Test coverage** | Strong — 32 repo tests + 34 domain tests provide a safety net during migration |
| **Tiered approach** | Smart — starts with trivial models (Tier 1: 6 models) and escalates to complex (Tier 6: Order) |
| **Breaking change strategy** | Pragmatic — single major version bump, no coexistence phase. Viable with few consumers |
| **Scope boundaries** | Correct — helpers (Address, BusinessProfile, InventoryCount, OrderSymbols) correctly excluded |

### Risks

| Risk | Severity | Mitigation in Plan |
|------|----------|-------------------|
| **72 test files need updating** | Medium | Tier-by-tier approach limits blast radius per step |
| **Metadata/handler chain complexity** (Option→OptionSet→Product→Category) | Medium | Deferred to Tier 5, after simpler models validate the pattern |
| **Order model nested date bug** | Low | Explicitly deferred — "preserve existing behavior, fix separately" |
| **BusinessFactory refactoring** | Low | Correctly identified; private `*ToFirestore` functions map cleanly to converter configs |
| **String-key registry migration** | Low | Simple mechanical change from `Map<Constructor, Spec>` → `Map<string, Spec>` |

### Missing Risk: No Rollback Strategy

The plan doesn't describe what happens if migration gets stuck partway through (e.g., Tiers 1-3 done but Tier 5 reveals a fundamental issue). Since it's a single breaking change with no coexistence, a partial state would leave the codebase inconsistent. Consider: should the work happen on a feature branch with per-tier commits?

---

## 2. Completeness

### Verified Correct (25/25 model-repo mappings)

Every model listed in Steps 1–6 has a corresponding repository file that exists. Every repository file has a model listed in the plan. **No orphaned models or repositories.**

### Minor Gaps Found — Clarifications

| Gap | Status | Resolution |
|-----|--------|------------|
| **Naming: "LocationsRoot"** — Plan calls the domain model "LocationsRoot" but the actual class is `Locations` in `src/domain/roots/Locations.ts` (only the repo has the "Root" suffix) | Clarified | Domain class is `Locations`; repo is `LocationsRootRepository`. Converter should be named `locationsConverter.ts` (not `locationsRootConverter.ts`) to match domain, or keep `locationsRootConverter.ts` to match repo — either is fine, just be consistent |
| **OrderSettings is nested** — Plan lists it as a separate model but it's a class within `src/domain/roots/Orders.ts`, not a standalone file | Clarified | `OrderSettings` is defined alongside `Orders` in the same file. Migration converts both in that file. Converter is separate (`orderSettingsConverter.ts`) since they have distinct repos |
| **TokenRepository has no test file** — All other repos have corresponding `.test.ts` files; Token does not | Accepted | Token is abstract — `fromFirestore` throws. Consumer-specific token types provide their own config and tests. No action needed |
| **`src/domain/misc/` directory** — Contains `Address.ts` and `BusinessProfile.ts` (plain interfaces) | Accepted | These are helper types with no repository, no class, no constructor. They require zero changes and are correctly out of scope |

### Resolved Gaps (updated in ISSUE_21_PLAN.md)

- **Runtime behavior validation** — Added 3-level verification: roundtrip serialization tests (mandatory), Firestore emulator smoke tests (optional post-migration), consumer dry-run via `npm link`
- **Fixture file detail** — Step 7.6 now enumerates all 5 fixture files (19 factory functions) with specific change instructions per file

### What the Plan Gets Right

- **Foundation steps (0a–0i)** are complete and correctly ordered
- **Barrel export changes** section is thorough — covers all 5 index files
- **Verification checklist** is practical (grep checks, file counts, compile + test + runtime roundtrips)
- **Special cases** called out: Token abstract→interface, Event static→standalone, Order nested date bug

---

## 2b. Testing Review

### Test Infrastructure Summary

| Category | Files | Tests | Migration Impact |
|----------|-------|-------|-----------------|
| Domain tests | 37 | ~290 | Syntactic: constructor → factory, `.metadata()` → standalone |
| Repository tests | 23 | ~130 | Syntactic: subclass → generic + converter config |
| Handler tests | 4 | 21 | Minimal: standalone meta fn call, string-key registration |
| MetadataSpec tests | 3 | 10 | Minimal: standalone meta fn reference |
| Infrastructure tests | 5 | 56 | String-key registry, BaseEntity replaces DomainEntity |
| Fixture files | 5 (19 fns) | — | Rename `*Props` → `*Input`, return `Partial<Model>` |
| **Total** | **72** | **~512** | **All changes are syntactic** |

### Key Finding: Roundtrip Tests Already Exist

The plan's original "Runtime Behavior Validation" section suggested adding roundtrip serialization tests as new work. **This is partially redundant** — all 23 concrete repositories already have `round-trip preserves data` tests. These just need to be migrated (not created). Updated the plan to clarify this and add a lighter "direct converter roundtrip" test as the new addition.

### Test Pattern Consistency

All 23 repository test files follow the same 4-test pattern:
1. `get() returns [Model] when exists`
2. `get() returns null when missing`
3. `set() serializes all fields`
4. `round-trip preserves data`

Plus model-specific edge cases (null defaults, empty arrays, deep clones, nested objects).

### Edge Case Coverage Assessment

| Edge Case | Covered? | Examples |
|-----------|----------|---------|
| Null field handling | ✓ | Location (13 nullable fields), Order (8 nullable fields), Event timestamps |
| Empty array defaults | ✓ | Product imageUrls/imageGsls, Category productDisplayOrder |
| Empty object defaults | ✓ | Product optionSets/locationInventory, Category products |
| String defaults | ✓ | Product caption/description → `""` |
| Date preservation | ✓ | All roundtrips use `.getTime()` equality |
| Deep clone behavior | ✓ | Product `set()` deep-clones optionSets (explicit `!==` check) |
| Nested map structures | ✓ | Category products map, Product optionSetsSelection |
| Enum values | ✓ | OrderState, OrderType, InventoryCountState |
| LinkedObject maps | ✓ | TaxRate, ServiceCharge, Discount — all test linkedObjects serialization |

### No Test Gaps Found

- All 25 models have domain test files
- All 23 concrete models have repository test files (Token is abstract — no repo test is correct)
- All 3 MetadataSpec models have spec test files
- All 3 RelationshipHandler models have handler test files
- Base infrastructure fully tested (FirestoreRepository 18 tests, MetadataRegistry 10 tests)
- Fixtures cover all models via 5 files with 19 factory functions

### Testing Completeness Verdict

**Score: 99%** — The test infrastructure is comprehensive and well-structured. The only addition needed post-migration is direct converter roundtrip tests (isolating converter logic from repository mocking). All other tests migrate syntactically with no new concepts.

---

## 3. Coverage

### Files Covered vs. Actual

| Category | Plan Claims | Actual Count | Covered? |
|----------|-------------|--------------|----------|
| Repository subclasses to delete | 25 | 25 | ✓ 100% |
| Domain models to migrate | 25 | 25 persistent | ✓ 100% |
| Helper/enum files (no changes needed) | Not listed | 4 (Address, BusinessProfile, InventoryCount, OrderSymbols) | ✓ Correctly excluded |
| MetadataSpec files | 3 mentioned | 3 exist (Location, Menu, MenuGroup) | ✓ 100% |
| Meta type files | Implied | 6 exist (Category, Option, OptionSet, Product, Menu, MenuGroup) | ✓ Handled via standalone `*Meta()` functions |
| RelationshipHandler files | 3 mentioned | 3 exist (Option, OptionSet, Product) | ✓ 100% |
| Registry files | 2 (Metadata + Handler) | 2 | ✓ 100% |
| BusinessFactory | 1 | 1 | ✓ Identified |
| LinkedObjectQueries | Keep | Verified exists (50 lines, 2 functions) | ✓ Correct |
| PathResolver | Keep (not mentioned) | Exists, not tied to repo pattern | ✓ Correctly untouched |
| Base classes to delete | 3 (DomainEntity, TenantEntity, IdGenerator) | 3 | ✓ 100% |
| Test files requiring updates | ~66 implied | 72 total (32 repo + 34 domain + 6 infra) | ⚠️ Plan should note exact count |

### What's NOT Covered — Resolved

1. ~~**Consumer migration guide**~~ — **RESOLVED.** See new "Consumer Migration Guide" section below.

2. ~~**CI/CD impact**~~ — **RESOLVED.** See new "CI/CD Coordination" section below.

3. ~~**Runtime behavior validation**~~ — **RESOLVED.** Roundtrip serialization tests (mandatory), emulator smoke tests (optional), and consumer dry-run added to Verification section.

4. ~~**`src/domain/__tests__/helpers/`**~~ — **RESOLVED.** Step 7.6 details all 5 fixture files (19 factory functions) with specific migration instructions.

---

## Consumer Migration Guide

Downstream packages importing from `@kiosinc/restaurant-core` will need these changes:

### Domain Model Construction

```typescript
// BEFORE (v0.x)
import { Domain } from '@kiosinc/restaurant-core';
const product = new Domain.Catalog.Product({ name: 'Burger', minPrice: 500, ... });
const meta = product.metadata();

// AFTER (v1.0)
import { Domain } from '@kiosinc/restaurant-core';
const product = Domain.Catalog.createProduct({ name: 'Burger', minPrice: 500, ... });
const meta = Domain.Catalog.productMeta(product);
```

### Repository Instantiation

```typescript
// BEFORE (v0.x)
import { Persistence } from '@kiosinc/restaurant-core';
const repo = new Persistence.Firestore.ProductRepository(metadataRegistry);

// AFTER (v1.0)
import { Persistence } from '@kiosinc/restaurant-core';
const repo = new Persistence.Firestore.FirestoreRepository<Product>(
  Persistence.Firestore.productConverter,
  metadataRegistry,
  handlerRegistry
);
```

### Registry Setup

```typescript
// BEFORE (v0.x)
metadataRegistry.register(Product, productMetadataSpec);
handlerRegistry.register(Product, productHandler);

// AFTER (v1.0)
metadataRegistry.register('product', productMetadataSpec);
handlerRegistry.register('product', productHandler);
```

### Removed Exports

| Removed | Replacement |
|---------|-------------|
| `DomainEntity`, `DomainEntityProps` | `BaseEntity` interface |
| `TenantEntity`, `TenantEntityProps` | `businessId` field directly on model interface |
| `MetadataProjection<T>` | Standalone `*Meta()` functions |
| `IdGenerator` (class) | `generateId()`, `setIdGenerator()`, `getIdGenerator()` functions |
| All `*Props` interfaces | Use `Partial<Model>` for construction input |
| All 25 `*Repository` classes | `FirestoreRepository<T>` + converter configs |
| `Repository` abstract interface | Removed (single concrete class) |

---

## CI/CD Coordination

### Version Bump

- Bump `package.json` version to `1.0.0` (major breaking change)
- Artifact Registry rejects duplicate versions — ensure no prior `1.0.0` exists

### Cloud Build

- Cloud Build triggers on PR merge to `master` or `dev`
- No pipeline changes needed — build runs `npm run pre-publish` (clean + compile) as before
- Tests run via `npm test` in existing pipeline

### Dependent Service Coordination

1. **Before merging:** `npm link` the migrated library into each consuming service and verify compilation
2. **Merge order:** Merge `restaurant-core@1.0.0` first, then update consumers in sequence
3. **Consumer PRs:** Each consumer needs a PR that:
   - Updates `@kiosinc/restaurant-core` dependency to `^1.0.0`
   - Applies constructor → factory changes per Consumer Migration Guide above
   - Updates registry setup to use string keys
4. **Rollback:** If a consumer fails to migrate, it can pin to the last `0.x` version while fixes are applied

---

## Final Assessment

| Dimension | Score | Notes |
|-----------|-------|-------|
| **Accuracy** | 98% | 25/25 mappings verified. Minor naming inconsistencies only. |
| **Completeness** | 99% | All source files covered. Consumer migration guide, CI/CD coordination, fixture detail, and runtime validation all addressed. Minor naming clarifications noted. |
| **Coverage** | 99% | Every repository, model, handler, spec, registry, fixture file, and consumer impact accounted for. |
| **Feasibility** | High | Low coupling, strong tests, clear tier ordering. Biggest risk is the sheer volume of mechanical changes (25 models × 6 touchpoints each). |
| **Clarity** | High | Well-structured tables, explicit special cases, concrete code examples. |

**Bottom line:** This plan is ready for execution with minor clarifications. The tiered approach, low consumer coupling, and strong test safety net make it highly likely to succeed.

---

## Exhaustive Implementation Checklist

### Step 0: Foundation

- [ ] **0a. Create `src/domain/BaseEntity.ts`**
  - [ ] Define `BaseEntity` interface (`Id`, `created`, `updated`, `isDeleted`)
  - [ ] Define `IdGenerator` interface
  - [ ] Implement `generateId()`, `setIdGenerator()`, `getIdGenerator()` module-level functions
  - [ ] Write `src/domain/__tests__/BaseEntity.test.ts`

- [ ] **0b. Refactor `src/persistence/firestore/FirestoreRepository.ts`**
  - [ ] Change `T extends DomainEntity` → `T extends BaseEntity`
  - [ ] Remove `abstract` keyword
  - [ ] Remove `protected abstract config()` method
  - [ ] Add constructor: `constructor(cfg: FirestoreRepositoryConfig<T>, metadataRegistry, relationshipHandlerRegistry?)`
  - [ ] Add `modelKey: string` field to `FirestoreRepositoryConfig<T>`
  - [ ] Update `set()`/`delete()` to pass `this.cfg.modelKey` to registries
  - [ ] Keep `dateify()` as-is
  - [ ] Keep `update()` as-is
  - [ ] Update `src/persistence/firestore/__tests__/FirestoreRepository.test.ts` (18 tests)

- [ ] **0c. Refactor `src/persistence/MetadataRegistry.ts`**
  - [ ] Change `Map<Constructor, MetadataSpec>` → `Map<string, MetadataSpec>`
  - [ ] `register(modelKey: string, spec)` replaces `register(entityClass, spec)`
  - [ ] `resolve(modelKey: string)` replaces prototype-chain walking
  - [ ] Update `getMetaLinks(modelKey, entity, businessId)` and `getMetadata(modelKey, entity)`
  - [ ] Update `src/persistence/__tests__/MetadataRegistry.test.ts` (10 tests)

- [ ] **0d. Refactor `src/persistence/firestore/handlers/RelationshipHandlerRegistry.ts`**
  - [ ] Change `Map<Function, Handler>` → `Map<string, Handler>`
  - [ ] `register(modelKey, handler)` / `resolve(modelKey)`
  - [ ] Update `src/persistence/firestore/handlers/__tests__/RelationshipHandlerRegistry.test.ts` (4 tests)
  - [ ] Remove prototype chain walking test (no longer applicable)

- [ ] **0e. Relax `src/persistence/firestore/handlers/RelationshipHandler.ts`**
  - [ ] Change `T extends DomainEntity` → `T extends BaseEntity`

- [ ] **0f. Update `src/domain/MetadataSpec.ts`**
  - [ ] Delete `MetadataProjection<T>` interface
  - [ ] Keep `MetaLinkDeclaration` and `MetadataSpec<TEntity, TMeta>`
  - [ ] Relax `TEntity` constraint to `extends BaseEntity`
  - [ ] Update `src/domain/__tests__/MetadataSpec.test.ts` (3 tests)

- [ ] **0g. Delete `src/persistence/Repository.ts`**
  - [ ] Delete `src/persistence/__tests__/Repository.test.ts` (1 test)

- [ ] **0h. Create `src/persistence/firestore/converters/` directory**
  - [ ] Create `src/persistence/firestore/converters/index.ts` barrel

- [ ] **0i. Verify foundation**
  - [ ] `npm run tsc` passes
  - [ ] `npm test` passes

---

### Step 1: Tier 1 — Trivial (6 models)

#### Catalog

- [ ] **Domain:** `src/domain/roots/Catalog.ts`
  - [ ] Replace `class Catalog extends DomainEntity` with `interface Catalog extends BaseEntity`
  - [ ] Remove `CatalogProps` interface
  - [ ] Add `createCatalog(input)` factory function
- [ ] **Converter:** Create `src/persistence/firestore/converters/catalogConverter.ts`
  - [ ] Lift `toFirestore`/`fromFirestore` from `CatalogRootRepository.ts`
  - [ ] Export config with `modelKey: 'catalog'`
- [ ] **Delete:** `src/persistence/firestore/CatalogRootRepository.ts`
- [ ] **Domain test:** Update `src/domain/roots/__tests__/Catalog.test.ts` (4 tests)
  - [ ] `new Catalog(props)` → `createCatalog(input)`
- [ ] **Repo test:** Update `src/persistence/firestore/__tests__/CatalogRootRepository.test.ts` (3 tests)
  - [ ] `new CatalogRootRepository(registry)` → `new FirestoreRepository<Catalog>(catalogConverter, registry)`
  - [ ] Add direct converter roundtrip test

#### ConnectedAccounts

- [ ] **Domain:** `src/domain/roots/ConnectedAccounts.ts`
  - [ ] Replace class with interface + `createConnectedAccounts()` factory
  - [ ] Remove `ConnectedAccountsProps`
- [ ] **Converter:** Create `src/persistence/firestore/converters/connectedAccountsConverter.ts`
- [ ] **Delete:** `src/persistence/firestore/ConnectedAccountsRootRepository.ts`
- [ ] **Domain test:** Update `src/domain/roots/__tests__/ConnectedAccounts.test.ts` (3 tests)
- [ ] **Repo test:** Update `src/persistence/firestore/__tests__/ConnectedAccountsRootRepository.test.ts` (3 tests)

#### Services

- [ ] **Domain:** `src/domain/roots/Services.ts`
  - [ ] Replace class with interface + `createServices()` factory
  - [ ] Remove `ServicesProps`
- [ ] **Converter:** Create `src/persistence/firestore/converters/servicesConverter.ts`
- [ ] **Delete:** `src/persistence/firestore/ServicesRepository.ts`
- [ ] **Domain test:** Update `src/domain/roots/__tests__/Services.test.ts` (4 tests)
- [ ] **Repo test:** Update `src/persistence/firestore/__tests__/ServicesRepository.test.ts` (3 tests)

#### KioskConfiguration

- [ ] **Domain:** `src/domain/surfaces/KioskConfiguration.ts`
  - [ ] Replace class with interface + `createKioskConfiguration()` factory
  - [ ] Remove `KioskConfigurationProps`
- [ ] **Converter:** Create `src/persistence/firestore/converters/kioskConfigurationConverter.ts`
- [ ] **Delete:** `src/persistence/firestore/KioskConfigurationRepository.ts`
- [ ] **Domain test:** Update `src/domain/surfaces/__tests__/KioskConfiguration.test.ts` (7 tests)
- [ ] **Repo test:** Update `src/persistence/firestore/__tests__/KioskConfigurationRepository.test.ts` (3 tests)

#### Token

- [ ] **Domain:** `src/domain/connected-accounts/Token.ts`
  - [ ] Replace abstract class with plain interface + `createToken()` factory
  - [ ] Remove `TokenProps`
- [ ] **Converter:** Create `src/persistence/firestore/converters/tokenConverter.ts`
  - [ ] `fromFirestore` throws (same as current abstract behavior)
- [ ] **Delete:** `src/persistence/firestore/TokenRepository.ts`
- [ ] **Domain test:** Update `src/domain/connected-accounts/__tests__/Token.test.ts` (7 tests)
- [ ] **No repo test** (Token is abstract — confirmed no test exists)

#### Event

- [ ] **Domain:** `src/domain/connected-accounts/Event.ts`
  - [ ] Replace class with interface + `createEvent()` factory
  - [ ] Remove `EventProps`
  - [ ] `Event.identifier(provider, type)` → standalone `eventIdentifier(provider, type)` function
- [ ] **Converter:** Create `src/persistence/firestore/converters/eventConverter.ts`
- [ ] **Delete:** `src/persistence/firestore/EventRepository.ts`
- [ ] **Domain test:** Update `src/domain/connected-accounts/__tests__/Event.test.ts` (16 tests)
  - [ ] `Event.identifier()` → `eventIdentifier()`
- [ ] **Repo test:** Update `src/persistence/firestore/__tests__/EventRepository.test.ts` (11 tests)

#### Tier 1 Barrel Exports

- [ ] Update `src/domain/roots/index.ts` — remove `CatalogProps`, `ConnectedAccountsProps`, `ServicesProps`; add `createCatalog`, `createConnectedAccounts`, `createServices`
- [ ] Update `src/domain/surfaces/index.ts` — remove `KioskConfigurationProps`; add `createKioskConfiguration`
- [ ] Update `src/domain/connected-accounts/index.ts` — remove `TokenProps`, `EventProps`; add `createToken`, `createEvent`, `eventIdentifier`
- [ ] Update `src/persistence/firestore/converters/index.ts` — export 6 new converters
- [ ] Update `src/persistence/firestore/index.ts` — remove 6 repository exports

#### Tier 1 Fixture Updates

- [ ] Update `src/domain/__tests__/helpers/EventFixtures.ts`
  - [ ] Remove `EventProps` import → use `Partial<Event>`
  - [ ] Rename `createTestEventProps()` → `createTestEventInput()`

#### Tier 1 Verify

- [ ] `npm run tsc` passes
- [ ] `npm test` passes

---

### Step 2: Tier 2 — LinkedObjectMap (3 models)

#### TaxRate

- [ ] **Domain:** `src/domain/catalog/TaxRate.ts`
  - [ ] Replace class with interface + `createTaxRate()` factory
  - [ ] Remove `TaxRateProps`
- [ ] **Converter:** Create `src/persistence/firestore/converters/taxRateConverter.ts`
- [ ] **Delete:** `src/persistence/firestore/TaxRateRepository.ts`
- [ ] **Domain test:** Update `src/domain/catalog/__tests__/TaxRate.test.ts` (6 tests)
- [ ] **Repo test:** Update `src/persistence/firestore/__tests__/TaxRateRepository.test.ts` (4 tests)

#### ServiceCharge

- [ ] **Domain:** `src/domain/catalog/ServiceCharge.ts`
  - [ ] Replace class with interface + `createServiceCharge()` factory
  - [ ] Remove `ServiceChargeProps`
- [ ] **Converter:** Create `src/persistence/firestore/converters/serviceChargeConverter.ts`
- [ ] **Delete:** `src/persistence/firestore/ServiceChargeRepository.ts`
- [ ] **Domain test:** Update `src/domain/catalog/__tests__/ServiceCharge.test.ts` (6 tests)
- [ ] **Repo test:** Update `src/persistence/firestore/__tests__/ServiceChargeRepository.test.ts` (8 tests)

#### Discount

- [ ] **Domain:** `src/domain/catalog/Discount.ts`
  - [ ] Replace class with interface + `createDiscount()` factory
  - [ ] Remove `DiscountProps`
- [ ] **Converter:** Create `src/persistence/firestore/converters/discountConverter.ts`
- [ ] **Delete:** `src/persistence/firestore/DiscountRepository.ts`
- [ ] **Domain test:** Update `src/domain/catalog/__tests__/Discount.test.ts` (8 tests)
- [ ] **Repo test:** Update `src/persistence/firestore/__tests__/DiscountRepository.test.ts` (6 tests)

#### Tier 2 Barrel Exports

- [ ] Update `src/domain/catalog/index.ts` — remove `TaxRateProps`, `ServiceChargeProps`, `DiscountProps`; add factories
- [ ] Update `src/persistence/firestore/converters/index.ts` — export 3 new converters
- [ ] Update `src/persistence/firestore/index.ts` — remove 3 repository exports

#### Tier 2 Fixture Updates

- [ ] Update `src/domain/__tests__/helpers/CatalogFixtures.ts`
  - [ ] Remove `TaxRateProps`, `DiscountProps`, `ServiceChargeProps` imports
  - [ ] Change return types and rename functions for TaxRate, Discount, ServiceCharge

#### Tier 2 Verify

- [ ] `npm run tsc` passes
- [ ] `npm test` passes

---

### Step 3: Tier 3 — Moderate nesting (7 models)

#### Locations (domain class is `Locations`, not `LocationsRoot`)

- [ ] **Domain:** `src/domain/roots/Locations.ts`
  - [ ] Replace class with interface + `createLocations()` factory
  - [ ] Remove `LocationsProps`
- [ ] **Converter:** Create `src/persistence/firestore/converters/locationsRootConverter.ts`
- [ ] **Delete:** `src/persistence/firestore/LocationsRootRepository.ts`
- [ ] **Domain test:** Update `src/domain/roots/__tests__/LocationsRoot.test.ts` (4 tests)
- [ ] **Repo test:** Update `src/persistence/firestore/__tests__/LocationsRootRepository.test.ts` (3 tests)

#### Surfaces

- [ ] **Domain:** `src/domain/roots/Surfaces.ts`
  - [ ] Replace class with interface + `createSurfaces()` factory
  - [ ] Remove `SurfacesProps`
- [ ] **Converter:** Create `src/persistence/firestore/converters/surfacesRootConverter.ts`
- [ ] **Delete:** `src/persistence/firestore/SurfacesRootRepository.ts`
- [ ] **Domain test:** Update `src/domain/roots/__tests__/Surfaces.test.ts` (6 tests)
- [ ] **Repo test:** Update `src/persistence/firestore/__tests__/SurfacesRootRepository.test.ts` (3 tests)

#### Business

- [ ] **Domain:** `src/domain/roots/Business.ts`
  - [ ] Replace class with interface + `createBusiness()` factory
  - [ ] Remove `BusinessProps`
- [ ] **Converter:** Create `src/persistence/firestore/converters/businessConverter.ts`
- [ ] **Delete:** `src/persistence/firestore/BusinessRepository.ts`
- [ ] **Domain test:** Update `src/domain/roots/__tests__/Business.test.ts` (8 tests)
- [ ] **Repo test:** Update `src/persistence/firestore/__tests__/BusinessRepository.test.ts` (4 tests)

#### Onboarding

- [ ] **Domain:** `src/domain/roots/Onboarding.ts`
  - [ ] Replace class with interface + `createOnboarding()` factory
  - [ ] Remove `OnboardingProps`
- [ ] **Converter:** Create `src/persistence/firestore/converters/onboardingConverter.ts`
- [ ] **Delete:** `src/persistence/firestore/OnboardingRepository.ts`
- [ ] **Domain test:** Update `src/domain/roots/__tests__/Onboarding.test.ts` (8 tests)
- [ ] **Repo test:** Update `src/persistence/firestore/__tests__/OnboardingRepository.test.ts` (4 tests)

#### OrderSettings (nested in `src/domain/roots/Orders.ts`)

- [ ] **Domain:** `src/domain/roots/Orders.ts`
  - [ ] Replace `OrderSettings` class with interface + `createOrderSettings()` factory
  - [ ] Remove `OrderSettingsProps`
- [ ] **Converter:** Create `src/persistence/firestore/converters/orderSettingsConverter.ts`
- [ ] **Delete:** `src/persistence/firestore/OrderSettingsRepository.ts`
- [ ] **Domain test:** Update `src/domain/roots/__tests__/OrderSettings.test.ts` (8 tests)
- [ ] **Repo test:** Update `src/persistence/firestore/__tests__/OrderSettingsRepository.test.ts` (4 tests)

#### SurfaceConfiguration

- [ ] **Domain:** `src/domain/surfaces/SurfaceConfiguration.ts`
  - [ ] Replace class with interface + `createSurfaceConfiguration()` factory
  - [ ] Remove `SurfaceConfigurationProps`
- [ ] **Converter:** Create `src/persistence/firestore/converters/surfaceConfigurationConverter.ts`
- [ ] **Delete:** `src/persistence/firestore/SurfaceConfigurationRepository.ts`
- [ ] **Domain test:** Update `src/domain/surfaces/__tests__/SurfaceConfiguration.test.ts` (11 tests)
- [ ] **Repo test:** Update `src/persistence/firestore/__tests__/SurfaceConfigurationRepository.test.ts` (4 tests)

#### CheckoutOptions

- [ ] **Domain:** `src/domain/surfaces/CheckoutOptions.ts`
  - [ ] Replace class with interface + `createCheckoutOptions()` factory
  - [ ] Remove `CheckoutOptionsProps`
- [ ] **Converter:** Create `src/persistence/firestore/converters/checkoutOptionsConverter.ts`
- [ ] **Delete:** `src/persistence/firestore/CheckoutOptionsRepository.ts`
- [ ] **Domain test:** Update `src/domain/surfaces/__tests__/CheckoutOptions.test.ts` (10 tests)
- [ ] **Repo test:** Update `src/persistence/firestore/__tests__/CheckoutOptionsRepository.test.ts` (5 tests)

#### BusinessFactory

- [ ] **Update:** `src/persistence/firestore/BusinessFactory.ts`
  - [ ] `new Business(...)` → `createBusiness(...)`
  - [ ] `new Catalog(...)` → `createCatalog(...)`
  - [ ] `new ConnectedAccounts(...)` → `createConnectedAccounts(...)`
  - [ ] `new Surfaces(...)` → `createSurfaces(...)`
  - [ ] `new Onboarding(...)` → `createOnboarding(...)`
  - [ ] `new OrderSettings(...)` → `createOrderSettings(...)`
  - [ ] `new Services(...)` → `createServices(...)`
  - [ ] `new Locations(...)` → `createLocations(...)`
  - [ ] Replace private `*ToFirestore` functions with converter config imports
- [ ] **Update test:** `src/persistence/firestore/__tests__/BusinessFactory.test.ts` (5 tests)

#### Tier 3 Barrel Exports

- [ ] Update `src/domain/roots/index.ts` — remove remaining root `*Props`; add factories
- [ ] Update `src/domain/surfaces/index.ts` — remove `SurfaceConfigurationProps`, `CheckoutOptionsProps`; add factories
- [ ] Update `src/persistence/firestore/converters/index.ts` — export 7 new converters
- [ ] Update `src/persistence/firestore/index.ts` — remove 7 repository exports

#### Tier 3 Fixture Updates

- [ ] Update `src/domain/__tests__/helpers/SurfacesFixtures.ts`
  - [ ] Remove `SurfaceConfigurationProps`, `KioskConfigurationProps`, `CheckoutOptionsProps` imports
  - [ ] Change return types and rename functions

#### Tier 3 Verify

- [ ] `npm run tsc` passes
- [ ] `npm test` passes

---

### Step 4: Tier 4 — Metadata + MetadataSpec (4 models)

#### Category

- [ ] **Domain:** `src/domain/catalog/Category.ts`
  - [ ] Replace class with interface + `createCategory()` factory
  - [ ] Remove `CategoryProps`
  - [ ] `category.metadata()` → standalone `categoryMeta(category)` function
- [ ] **Meta type:** Keep `src/domain/catalog/CategoryMeta.ts` as-is (just a type)
- [ ] **Converter:** Create `src/persistence/firestore/converters/categoryConverter.ts`
- [ ] **Delete:** `src/persistence/firestore/CategoryRepository.ts`
- [ ] **Domain test:** Update `src/domain/catalog/__tests__/Category.test.ts` (10 tests)
  - [ ] `category.metadata()` → `categoryMeta(category)`
- [ ] **Repo test:** Update `src/persistence/firestore/__tests__/CategoryRepository.test.ts` (6 tests)

#### Location

- [ ] **Domain:** `src/domain/locations/Location.ts`
  - [ ] Replace class with interface + `createLocation()` factory
  - [ ] Remove `LocationProps`
  - [ ] Add `businessId: string` directly on interface (replaces `TenantEntity` inheritance)
  - [ ] `location.metadata()` → standalone `locationMeta(location)` function
- [ ] **Converter:** Create `src/persistence/firestore/converters/locationConverter.ts`
- [ ] **Delete:** `src/persistence/firestore/LocationRepository.ts`
- [ ] **MetadataSpec:** Update `src/persistence/firestore/LocationMetadataSpec.ts`
  - [ ] `entity.metadata()` → `locationMeta(entity)`
- [ ] **Domain test:** Update `src/domain/locations/__tests__/Location.test.ts` (11 tests)
- [ ] **Repo test:** Update `src/persistence/firestore/__tests__/LocationRepository.test.ts` (10 tests)
- [ ] **Spec test:** Update `src/persistence/firestore/__tests__/LocationMetadataSpec.test.ts` (4 tests)

#### Menu

- [ ] **Domain:** `src/domain/surfaces/Menu.ts`
  - [ ] Replace class with interface + `createMenu()` factory
  - [ ] Remove `MenuProps`
  - [ ] `menu.metadata()` → standalone `menuMeta(menu)` function
- [ ] **Meta type:** Keep `src/domain/surfaces/MenuMeta.ts` as-is
- [ ] **Converter:** Create `src/persistence/firestore/converters/menuConverter.ts`
- [ ] **Delete:** `src/persistence/firestore/MenuRepository.ts`
- [ ] **MetadataSpec:** Update `src/persistence/firestore/MenuMetadataSpec.ts`
  - [ ] `entity.metadata()` → `menuMeta(entity)`
- [ ] **Domain test:** Update `src/domain/surfaces/__tests__/Menu.test.ts` (14 tests)
- [ ] **Repo test:** Update `src/persistence/firestore/__tests__/MenuRepository.test.ts` (6 tests)
- [ ] **Spec test:** Update `src/persistence/firestore/__tests__/MenuMetadataSpec.test.ts` (3 tests)

#### MenuGroup

- [ ] **Domain:** `src/domain/surfaces/MenuGroup.ts`
  - [ ] Replace class with interface + `createMenuGroup()` factory
  - [ ] Remove `MenuGroupProps`
  - [ ] `menuGroup.metadata()` → standalone `menuGroupMeta(menuGroup)` function
- [ ] **Meta type:** Keep `src/domain/surfaces/MenuGroupMeta.ts` as-is
- [ ] **Converter:** Create `src/persistence/firestore/converters/menuGroupConverter.ts`
- [ ] **Delete:** `src/persistence/firestore/MenuGroupRepository.ts`
- [ ] **MetadataSpec:** Update `src/persistence/firestore/MenuGroupMetadataSpec.ts`
  - [ ] `entity.metadata()` → `menuGroupMeta(entity)`
- [ ] **Domain test:** Update `src/domain/surfaces/__tests__/MenuGroup.test.ts` (13 tests)
- [ ] **Repo test:** Update `src/persistence/firestore/__tests__/MenuGroupRepository.test.ts` (6 tests)
- [ ] **Spec test:** Update `src/persistence/firestore/__tests__/MenuGroupMetadataSpec.test.ts` (3 tests)

#### Tier 4 Barrel Exports

- [ ] Update `src/domain/catalog/index.ts` — remove `CategoryProps`; add `createCategory`, `categoryMeta`
- [ ] Update `src/domain/locations/index.ts` — remove `LocationProps`; add `createLocation`, `locationMeta`
- [ ] Update `src/domain/surfaces/index.ts` — remove `MenuProps`, `MenuGroupProps`; add factories and meta functions
- [ ] Update `src/persistence/firestore/converters/index.ts` — export 4 new converters
- [ ] Update `src/persistence/firestore/index.ts` — remove 4 repository exports

#### Tier 4 Fixture Updates

- [ ] Update `src/domain/__tests__/helpers/CatalogFixtures.ts`
  - [ ] Remove `CategoryProps` import; update `createTestCategoryProps` → `createTestCategoryInput`
- [ ] Update `src/domain/__tests__/helpers/LocationFixtures.ts`
  - [ ] Remove `LocationProps` import; update function
- [ ] Update `src/domain/__tests__/helpers/SurfacesFixtures.ts`
  - [ ] Remove `MenuProps`, `MenuGroupProps` imports; update functions

#### Tier 4 Verify

- [ ] `npm run tsc` passes
- [ ] `npm test` passes

---

### Step 5: Tier 5 — RelationshipHandler + InventoryCount (3 models)

#### Option

- [ ] **Domain:** `src/domain/catalog/Option.ts`
  - [ ] Replace class with interface + `createOption()` factory
  - [ ] Remove `OptionProps`
  - [ ] `option.metadata()` → standalone `optionMeta(option)` function
- [ ] **Meta type:** Keep `src/domain/catalog/OptionMeta.ts` as-is
- [ ] **Converter:** Create `src/persistence/firestore/converters/optionConverter.ts`
- [ ] **Delete:** `src/persistence/firestore/OptionRepository.ts`
- [ ] **Handler:** Update `src/persistence/firestore/handlers/OptionRelationshipHandler.ts`
  - [ ] `entity.metadata()` → `optionMeta(entity)`
- [ ] **Domain test:** Update `src/domain/catalog/__tests__/Option.test.ts` (15 tests)
- [ ] **Repo test:** Update `src/persistence/firestore/__tests__/OptionRepository.test.ts` (10 tests)
- [ ] **Handler test:** Update `src/persistence/firestore/handlers/__tests__/OptionRelationshipHandler.test.ts` (7 tests)

#### OptionSet

- [ ] **Domain:** `src/domain/catalog/OptionSet.ts`
  - [ ] Replace class with interface + `createOptionSet()` factory
  - [ ] Remove `OptionSetProps`
  - [ ] `optionSet.metadata()` → standalone `optionSetMeta(optionSet)` function
- [ ] **Meta type:** Keep `src/domain/catalog/OptionSetMeta.ts` as-is
- [ ] **Converter:** Create `src/persistence/firestore/converters/optionSetConverter.ts`
- [ ] **Delete:** `src/persistence/firestore/OptionSetRepository.ts`
- [ ] **Handler:** Update `src/persistence/firestore/handlers/OptionSetRelationshipHandler.ts`
  - [ ] `entity.metadata()` → `optionSetMeta(entity)`
- [ ] **Domain test:** Update `src/domain/catalog/__tests__/OptionSet.test.ts` (12 tests)
- [ ] **Repo test:** Update `src/persistence/firestore/__tests__/OptionSetRepository.test.ts` (7 tests)
- [ ] **Handler test:** Update `src/persistence/firestore/handlers/__tests__/OptionSetRelationshipHandler.test.ts` (5 tests)

#### Product

- [ ] **Domain:** `src/domain/catalog/Product.ts`
  - [ ] Replace class with interface + `createProduct()` factory
  - [ ] Remove `ProductProps`
  - [ ] `product.metadata()` → standalone `productMeta(product)` function
- [ ] **Meta type:** Keep `src/domain/catalog/ProductMeta.ts` as-is
- [ ] **Converter:** Create `src/persistence/firestore/converters/productConverter.ts`
  - [ ] Ensure deep clone of `optionSets` and `optionSetsSelection` in `toFirestore`
- [ ] **Delete:** `src/persistence/firestore/ProductRepository.ts`
- [ ] **Handler:** Update `src/persistence/firestore/handlers/ProductRelationshipHandler.ts`
  - [ ] `entity.metadata()` → `productMeta(entity)`
- [ ] **Domain test:** Update `src/domain/catalog/__tests__/Product.test.ts` (14 tests)
- [ ] **Repo test:** Update `src/persistence/firestore/__tests__/ProductRepository.test.ts` (7 tests)
- [ ] **Handler test:** Update `src/persistence/firestore/handlers/__tests__/ProductRelationshipHandler.test.ts` (5 tests)

#### InventoryCount

- [ ] **Move:** `src/persistence/firestore/helpers/InventoryCountConverter.ts` → `src/persistence/firestore/converters/inventoryCountHelper.ts`
- [ ] **Update test:** `src/persistence/firestore/__tests__/helpers/InventoryCountConverter.test.ts` (12 tests) — update import path
- [ ] Update Option/OptionSet/Product converters to import from new location

#### Tier 5 Barrel Exports

- [ ] Update `src/domain/catalog/index.ts` — remove `OptionProps`, `OptionSetProps`, `ProductProps`; add factories and meta functions
- [ ] Update `src/persistence/firestore/converters/index.ts` — export 3 new converters + inventoryCountHelper
- [ ] Update `src/persistence/firestore/index.ts` — remove 3 repository exports

#### Tier 5 Fixture Updates

- [ ] Update `src/domain/__tests__/helpers/CatalogFixtures.ts`
  - [ ] Remove `OptionProps`, `OptionSetProps`, `ProductProps` imports
  - [ ] Rename and retype all remaining functions

#### Tier 5 Verify

- [ ] `npm run tsc` passes
- [ ] `npm test` passes

---

### Step 6: Tier 6 — Most complex (2 models)

#### OnboardingOrder

- [ ] **Domain:** `src/domain/onboarding/OnboardingOrder.ts`
  - [ ] Replace class with interface + `createOnboardingOrder()` factory
  - [ ] Remove `OnboardingOrderProps`
- [ ] **Converter:** Create `src/persistence/firestore/converters/onboardingOrderConverter.ts`
- [ ] **Delete:** `src/persistence/firestore/OnboardingOrderRepository.ts`
- [ ] **Domain test:** Update `src/domain/onboarding/__tests__/OnboardingOrder.test.ts` (8 tests)
- [ ] **Repo test:** Update `src/persistence/firestore/__tests__/OnboardingOrderRepository.test.ts` (5 tests)

#### Order

- [ ] **Domain:** `src/domain/orders/Order.ts`
  - [ ] Replace class with interface + `createOrder()` factory
  - [ ] Remove `OrderProps`
  - [ ] Add `businessId: string` directly on interface (replaces `TenantEntity`)
  - [ ] Preserve nested date bug (fulfillment.scheduledTime, payment.paymentTimestamp stay strings after deser)
- [ ] **Converter:** Create `src/persistence/firestore/converters/orderConverter.ts`
- [ ] **Delete:** `src/persistence/firestore/OrderRepository.ts`
- [ ] **Domain test:** Update `src/domain/orders/__tests__/Order.test.ts` (21 tests)
- [ ] **Repo test:** Update `src/persistence/firestore/__tests__/OrderRepository.test.ts` (13 tests)

#### Tier 6 Barrel Exports

- [ ] Update `src/domain/onboarding/index.ts` — remove `OnboardingOrderProps`; add `createOnboardingOrder`
- [ ] Update `src/domain/orders/index.ts` — remove `OrderProps`; add `createOrder`
- [ ] Update `src/persistence/firestore/converters/index.ts` — export 2 new converters
- [ ] Update `src/persistence/firestore/index.ts` — remove 2 repository exports

#### Tier 6 Fixture Updates

- [ ] Update `src/domain/__tests__/helpers/OrderFixtures.ts`
  - [ ] Remove `OrderProps` import; rename functions
- [ ] Update `src/domain/__tests__/helpers/SurfacesFixtures.ts`
  - [ ] Remove `OnboardingOrderProps`, `TokenProps` imports; rename functions

#### Tier 6 Verify

- [ ] `npm run tsc` passes
- [ ] `npm test` passes

---

### Step 7: Cleanup

- [ ] **Delete** `src/domain/DomainEntity.ts`
- [ ] **Delete** `src/domain/TenantEntity.ts`
- [ ] **Delete** `src/domain/IdGenerator.ts`
- [ ] **Delete** `src/domain/__tests__/DomainEntity.test.ts`
- [ ] **Delete** `src/domain/__tests__/TenantEntity.test.ts`
- [ ] **Delete** `src/domain/__tests__/IdGenerator.test.ts`
- [ ] **Delete** `src/persistence/Repository.ts` (if not already deleted in 0g)
- [ ] **Delete** `src/persistence/__tests__/Repository.test.ts` (if not already deleted in 0g)
- [ ] **Delete** `src/persistence/firestore/helpers/InventoryCountConverter.ts` (moved in Step 5)

#### Final Barrel Export Cleanup

- [ ] **`src/domain/index.ts`**
  - [ ] Remove: `DomainEntity`, `DomainEntityProps`, `TenantEntity`, `TenantEntityProps`, `MetadataProjection`, `IdGenerator` (old)
  - [ ] Add: `BaseEntity`, `IdGenerator` (interface), `generateId`, `setIdGenerator`, `getIdGenerator`
  - [ ] Keep: `MetaLinkDeclaration`, `MetadataSpec`, `LinkedObjectRef`, `LinkedObjectMap`, subdomain re-exports
- [ ] **`src/persistence/index.ts`**
  - [ ] Remove: `Repository` export
  - [ ] Keep: `MetadataRegistry`, `export * from './firestore'`
- [ ] **`src/persistence/firestore/index.ts`**
  - [ ] Verify: all 25 `*Repository` exports removed
  - [ ] Verify: `export * from './converters'` present
  - [ ] Keep: `FirestoreRepository`, `FirestoreRepositoryConfig`, `PathResolver`, 3 MetadataSpec classes, handlers, `LinkedObjectQueries`, `BusinessFactory`
- [ ] **`src/persistence/firestore/handlers/index.ts`**
  - [ ] Verify handler exports still correct
- [ ] **`src/index.ts`** — no changes needed (re-exports namespaces)

#### Version Bump

- [ ] Bump `package.json` version to `1.0.0`

---

### Final Verification

- [ ] `npm run tsc` — compiles cleanly
- [ ] `npm test` — all 512+ tests pass
- [ ] `npx eslint src/` — no lint errors
- [ ] `grep -r "DomainEntity" src/ --include="*.ts" -l` → 0 files
- [ ] `grep -r "TenantEntity" src/ --include="*.ts" -l` → 0 files
- [ ] `grep -r "extends DomainEntityProps" src/` → 0 hits
- [ ] `grep -r "new Product\|new Category\|new TaxRate\|new Order\|new Business\|new Catalog" src/` → 0 hits (excluding test helper comments)
- [ ] `ls src/persistence/firestore/*Repository.ts` → only `FirestoreRepository.ts`
- [ ] `ls src/persistence/firestore/converters/*Converter.ts` → 25 files + inventoryCountHelper
- [ ] `package.json` version = `1.0.0`

### File Count Summary

| Action | Count |
|--------|-------|
| Files created | 27 (1 BaseEntity + 25 converters + 1 converters/index.ts) |
| Files deleted | 30 (25 repositories + DomainEntity + TenantEntity + IdGenerator + Repository + helpers/InventoryCountConverter) |
| Domain files modified | 25 (class → interface + factory) |
| Domain test files modified | 29 (all model tests + DomainEntity/TenantEntity/IdGenerator → BaseEntity) |
| Repo test files modified | 23 (all repository tests) |
| Handler files modified | 3 (Option, OptionSet, Product handlers) |
| Handler test files modified | 4 (3 handlers + registry) |
| MetadataSpec files modified | 3 (Location, Menu, MenuGroup) |
| MetadataSpec test files modified | 3 |
| Infrastructure files modified | 5 (FirestoreRepository, MetadataRegistry, RelationshipHandlerRegistry, RelationshipHandler, MetadataSpec) |
| Infrastructure test files modified | 2 (FirestoreRepository.test, MetadataRegistry.test) |
| Barrel index files modified | 12 |
| Fixture files modified | 5 |
| Other files modified | 2 (BusinessFactory + its test) |
| **Total files touched** | **~143** |
