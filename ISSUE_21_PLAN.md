# Migration Plan: DDD Repository Pattern → Standard Firestore

## Problem Statement

The current codebase uses a Domain-Driven Design (DDD) repository pattern on top of Firestore. This is atypical for Firestore/TypeScript projects and introduces significant boilerplate — every field is enumerated 4-5 times across Props interfaces, class property declarations, constructor assignments, `toFirestore()`, and `fromFirestore()`. Adding a single field to a model requires changes in 3-5 places.

## Current Architecture

### Domain Model Layer (~26 models)
- Class hierarchy: `DomainEntity` → `TenantEntity` → concrete model (e.g., `Product`)
- Each model has a `*Props` interface and a constructor that maps props to class properties field-by-field
- Models implement `MetadataProjection<T>` with a `metadata()` method that returns a denormalized view

### Repository Layer (~26 repositories)
- Abstract base: `FirestoreRepository<T>` with `FirestoreRepositoryConfig<T>`
- Each repository implements `toFirestore()` and `fromFirestore()` with manual field-by-field mapping
- Dates serialized as ISO strings, reconverted on read via `dateify()` helper
- Complex objects cloned via `JSON.parse(JSON.stringify())` for Firestore compatibility

### Metadata Denormalization
- `MetadataRegistry` — registers `MetadataSpec` for each entity class
- On `repository.set()`, automatically updates denormalized metadata in related documents within the same transaction
- Example: saving a Product updates `ProductMeta` embedded in all Categories that reference it

### Relationship Handlers (3 handlers)
- `ProductRelationshipHandler` — Product ↔ Category (updates/removes ProductMeta in categories)
- `OptionSetRelationshipHandler` — OptionSet ↔ Product (updates/removes OptionSetMeta in products)
- `OptionRelationshipHandler` — Option ↔ OptionSet (updates/removes OptionMeta in option sets)
- All execute within the `repository.set()` transaction alongside metadata updates

### How It Differs from Typical Firestore
| Aspect | Typical Firestore | This Codebase |
|---|---|---|
| Data representation | Plain interfaces/objects | Class instances with inheritance |
| Converter mechanism | `withConverter()` on collection ref | Custom `FirestoreRepositoryConfig` |
| Data access | Direct Firestore calls with typed refs | Repository pattern |
| Timestamps | Native Firestore `Timestamp` | ISO strings with manual conversion |
| Constructor mapping | None — spread `snap.data()` | Manual field-by-field assignment |
| Denormalization | Cloud Functions or ad-hoc | In-process transactional via MetadataRegistry |

---

## Proposed Architecture

### 1. Data Layer: Plain Interfaces + `withConverter()`

Replace domain classes with plain TypeScript interfaces. Replace repositories with typed collection helpers using Firestore's built-in `withConverter()`.

**Before:**
```typescript
// Props interface
interface ProductProps extends DomainEntityProps {
  name: string;
  caption: string;
  // ... 12 more fields
}

// Class with constructor mapping
class Product extends DomainEntity {
  constructor(props: ProductProps) {
    super(props);
    this.name = props.name;
    this.caption = props.caption ?? '';
    // ... 12 more assignments
  }
}

// Repository with toFirestore/fromFirestore mapping
class ProductRepository extends FirestoreRepository<Product> {
  protected config(): FirestoreRepositoryConfig<Product> {
    return {
      toFirestore(product) { return { name: product.name, ... }; },
      fromFirestore(data, id) { return new Product({ Id: id, name: data.name, ... }); },
    };
  }
}
```

**After:**
```typescript
// Single interface — no class, no Props, no constructor
interface Product {
  id: string;
  name: string;
  caption: string;
  // ... all fields
  created: Date;
  updated: Date;
  isDeleted: boolean;
}

// Converter — fromFirestore is a one-liner spread
const productConverter: FirestoreDataConverter<Product> = {
  toFirestore: (p) => ({ ...p, id: undefined }),
  fromFirestore: (snap) => ({ id: snap.id, ...snap.data() } as Product),
};

// Typed collection helper
function productsCol(businessId: string) {
  return PathResolver.productsCollection(businessId).withConverter(productConverter);
}

// Usage
const product = (await productsCol('biz-123').doc('abc').get()).data();
```

**Files affected:** ~26 model files, ~26 repository files
**Complexity:** Mechanical refactoring

### 2. Write Path: Plain Writes + Cloud Task Enqueue

Writes go directly to Firestore with no in-process transactions for metadata propagation. After writing, enqueue a Cloud Task to rebuild affected materialized views.

```typescript
// Service layer
async function updateProduct(businessId: string, product: Product): Promise<void> {
  // 1. Write product directly
  await productsCol(businessId).doc(product.id).set(product);

  // 2. Enqueue rebuild task (reuses existing createHttpTask infrastructure)
  await createHttpTask({
    queue: 'meta-propagation',
    url: '/tasks/rebuild-menu-views',
    body: { businessId },
    scheduleTime: Date.now() + 5000, // 5s debounce for bulk operations
  });
}
```

### 3. Read Path: Materialized Menu-View Documents

Pre-built, fully assembled documents optimized for single-fetch reads by kiosks and customer-facing surfaces. Rebuilt asynchronously when underlying data changes — not on kiosk request.

```
menu-views/{menuId} → {
  categories: [
    {
      id: "cat-1",
      name: "Burgers",
      products: [
        { id: "p-1", name: "Cheeseburger", price: 999, options: [...] }
      ]
    }
  ]
}
```

**Rebuild flow:**
```
Admin updates product
  → write to Firestore
  → enqueue Cloud Task with 5s debounce
  → task executes: reads all current products, categories, option sets from source of truth
  → assembles full menu-view document
  → writes to menu-views/{menuId}
  → kiosk reads single pre-built document
```

### 4. Propagation: Cloud Tasks with Debounce

Use Cloud Tasks (not Cloud Functions triggers) for propagation. The codebase already has `createHttpTask()` infrastructure for Square sync.

**Why Cloud Tasks over Cloud Functions triggers:**
- **No cascading** — rebuild reads current state from source of truth, doesn't write documents that trigger further functions
- **Debouncing** — 200 product writes during a bulk import consolidate into 1 rebuild task
- **Controlled concurrency** — Cloud Tasks queue limits prevent fan-out contention on the same document
- **No ordering problem** — last rebuild wins, always reads latest data
- **Explicit retry control** — configurable backoff, max attempts, dead-letter queues

**Why not Cloud Functions triggers:**
The 3-level hierarchy (Option → OptionSet → Product → Category) would cascade through 3 chained function invocations per edit. This causes:
- Infinite loop risk without explicit cascade guards
- Out-of-order execution writing stale data
- Firestore contention when multiple functions update the same parent document
- Silent partial failures with no caller feedback

### 5. Safety Net: Scheduled Reconciliation

Periodic job that recomputes all materialized views from source of truth. Catches anything the task queue missed (failed tasks, bugs, edge cases).

```
Every N minutes (or on-demand after bulk operations):
  For each business:
    Read all products, categories, option sets, menus
    Recompute all menu-view documents
    Write only if changed
```

---

## What Gets Removed

| Component | Files | Purpose |
|---|---|---|
| `DomainEntity`, `TenantEntity` | 2 | Base class hierarchy |
| `*Props` interfaces | ~26 | Constructor parameter types |
| Domain model classes | ~26 | Class instances with constructors |
| `FirestoreRepository<T>` | 1 | Abstract base repository |
| `FirestoreRepositoryConfig<T>` | 1 | Repository config interface |
| Concrete `*Repository` classes | ~26 | Manual field mapping |
| `MetadataRegistry` | 1 | Auto-denormalization registry |
| `MetadataSpec` / `MetadataProjection` | 1 | Metadata interfaces |
| `RelationshipHandlerRegistry` | 1 | Handler dispatch |
| 3 `*RelationshipHandler` classes | 3 | Transactional relationship updates |
| `dateify()` helper | 1 | Timestamp conversion |

## What Gets Added

| Component | Purpose |
|---|---|
| Plain interfaces for each model | Replace domain classes |
| `FirestoreDataConverter` per model | One-liner converters with `withConverter()` |
| Typed collection helper functions | Replace `PathResolver` + repository combo |
| Cloud Task handler: rebuild menu-views | Replaces MetadataRegistry + RelationshipHandlers |
| Materialized view builder | Assembles read-optimized menu-view documents |
| Reconciliation job | Periodic safety net |

---

## Migration Risk

### Breaking Change
This is a published library (`@kiosinc/restaurant-core`). Every downstream consumer uses `new Product(...)`, class methods, and the repository API. This requires:
- Major version bump (semver)
- Coordinated migration across all consuming services
- Parallel operation period where both patterns coexist (or a big-bang cutover)

### Test Impact
- 72 test files, 510+ tests — most will need rewriting
- Repository mocking patterns change entirely
- Domain model construction changes from `new Product({...})` to plain object literals

### Incremental Strategy
1. Introduce plain interfaces alongside existing classes (non-breaking)
2. Add `withConverter()` helpers alongside existing repositories
3. Migrate consumers one service at a time
4. Build Cloud Task propagation and materialized views
5. Remove DDD layer once all consumers have migrated
