# Restaurant-Core

A TypeScript library that provides data models and APIs for managing restaurant business operations. Built on Firebase/Firestore as an NPM package (`@kiosinc/restaurant-core`).

## Features

- **Business Management** - Multi-location restaurant organization with roles and profiles
- **Catalog System** - Products, categories, options, pricing, tax rates, and inventory tracking
- **Order Processing** - Order management and sales workflows
- **Menu & Kiosk Configuration** - Self-service ordering system setup and menu definitions
- **External Integrations** - Connected accounts for POS systems (e.g., Square) with event synchronization
- **Reporting** - Daily metrics and location-specific reports

## Tech Stack

- TypeScript
- Firebase Admin / Firestore
- Google Cloud Functions & Tasks
- Express

## Installation

```bash
npm install @kiosinc/restaurant-core
```

## Project Structure

```
src/
├── restaurant/
│   ├── roots/           # Business & organization management
│   ├── catalog/         # Products, categories, options, pricing
│   ├── orders/          # Order management
│   ├── surfaces/        # Menu and kiosk configuration
│   ├── locations/       # Location management
│   └── connected-accounts/  # External integrations
├── firestore-core/      # Base Firestore data models
├── user/                # User & authentication
├── reports/             # Reporting system
└── utils/               # Helper utilities
```

---

## Future Improvements (V2 Architecture)

The current architecture tightly couples domain models to Firestore persistence. A v2 rewrite should separate concerns and make infrastructure pluggable.

### Current Problems to Solve

1. **Domain-Persistence Coupling** - Every model has Firestore converters baked in
2. **Library Does Too Much** - Mixes domain models, persistence, integrations, and API concerns
3. **Inheritance Over Composition** - Everything extends `FirestoreObject`, forcing Firestore dependency
4. **Code Duplication** - Converter patterns repeated across 50+ files
5. **Inconsistent Patterns** - Mixed exports, async styles, error handling

### V2 Package Architecture

The key principle: **`@kiosinc/restaurant-core` has ZERO infrastructure dependencies.**

Firestore, Square, etc. are all separate packages that depend on core—not the other way around.

```
@kiosinc/restaurant-core        # Pure TypeScript domain models & business logic
@kiosinc/restaurant-firestore   # Firestore adapter (depends on core)
@kiosinc/restaurant-square      # Square integration (depends on core)
@kiosinc/restaurant-api         # Express API layer (depends on core only)
@kiosinc/restaurant-bootstrap   # Wires packages together (depends on all)
```

### V2 Project Structure

```
packages/
├── core/                       # @kiosinc/restaurant-core
│   │                           # ZERO external dependencies (no Firebase, no DB drivers)
│   ├── models/
│   │   ├── business/
│   │   │   ├── Business.ts
│   │   │   ├── Location.ts
│   │   │   └── BusinessProfile.ts
│   │   ├── catalog/
│   │   │   ├── Product.ts
│   │   │   ├── Category.ts
│   │   │   ├── Option.ts
│   │   │   ├── OptionSet.ts
│   │   │   ├── TaxRate.ts
│   │   │   ├── Discount.ts
│   │   │   └── Inventory.ts
│   │   ├── orders/
│   │   │   ├── Order.ts
│   │   │   ├── OrderItem.ts
│   │   │   └── Payment.ts
│   │   ├── surfaces/
│   │   │   ├── Menu.ts
│   │   │   ├── MenuGroup.ts
│   │   │   └── KioskConfig.ts

│   │   └── index.ts
│   ├── repositories/           # Abstract interfaces ONLY (no implementations)
│   │   ├── ProductRepository.ts
│   │   ├── CategoryRepository.ts
│   │   ├── OptionRepository.ts
│   │   ├── OptionSetRepository.ts
│   │   ├── TaxRateRepository.ts
│   │   ├── DiscountRepository.ts
│   │   ├── OrderRepository.ts
│   │   ├── BusinessRepository.ts
│   │   ├── LocationRepository.ts
│   │   ├── MenuRepository.ts
│   │   └── index.ts
│   ├── services/               # Business logic (depends on repository interfaces)
│   │   ├── CatalogService.ts
│   │   ├── OrderService.ts
│   │   ├── InventoryService.ts
│   │   ├── PricingService.ts
│   │   └── index.ts
│   ├── events/                 # Domain events
│   │   ├── OrderCreated.ts
│   │   ├── InventoryUpdated.ts
│   │   ├── EventBus.ts
│   │   └── index.ts
│   ├── errors/                 # Typed error classes
│   │   ├── NotFoundError.ts
│   │   ├── ValidationError.ts
│   │   └── index.ts
│   ├── utils/                  # Pure utility functions
│   │   ├── dates.ts
│   │   ├── money.ts
│   │   └── index.ts
│   └── index.ts
│
├── adapters/
│   ├── firestore/              # @kiosinc/restaurant-firestore
│   │   │                       # depends on: core, firebase-admin
│   │   ├── repositories/
│   │   │   ├── FirestoreProductRepository.ts
│   │   │   ├── FirestoreCategoryRepository.ts
│   │   │   ├── FirestoreOptionRepository.ts
│   │   │   ├── FirestoreOptionSetRepository.ts
│   │   │   ├── FirestoreTaxRateRepository.ts
│   │   │   ├── FirestoreDiscountRepository.ts
│   │   │   ├── FirestoreOrderRepository.ts
│   │   │   ├── FirestoreBusinessRepository.ts
│   │   │   ├── FirestoreLocationRepository.ts
│   │   │   ├── FirestoreMenuRepository.ts
│   │   │   └── index.ts
│   │   ├── converters/         # Explicit per-model (no generic factory)
│   │   │   ├── ProductConverter.ts
│   │   │   ├── CategoryConverter.ts
│   │   │   ├── OptionConverter.ts
│   │   │   ├── OptionSetConverter.ts
│   │   │   ├── TaxRateConverter.ts
│   │   │   ├── DiscountConverter.ts
│   │   │   ├── OrderConverter.ts
│   │   │   ├── BusinessConverter.ts
│   │   │   ├── LocationConverter.ts
│   │   │   ├── MenuConverter.ts
│   │   │   ├── ReportConverter.ts
│   │   │   └── index.ts
│   │   ├── helpers.ts          # Date serialization, null handling
│   │   └── index.ts
│
├── integrations/
│   ├── square/                 # @kiosinc/restaurant-square
│   │   │                       # depends on: core, square SDK
│   │   ├── SquareClient.ts
│   │   ├── SquareSyncService.ts
│   │   ├── SquareWebhookHandler.ts
│   │   ├── converters/
│   │   └── index.ts
│   │
│   └── stripe/                 # @kiosinc/restaurant-stripe [future]
│       └── index.ts
│
├── api/                        # @kiosinc/restaurant-api
│   │                           # depends on: core, express (NOT adapters)
│   ├── middleware/
│   │   ├── auth.ts
│   │   └── errorHandler.ts
│   ├── routes/
│   │   ├── catalog.ts
│   │   ├── orders.ts
│   │   └── business.ts
│   ├── validators/
│   └── index.ts
│
└── bootstrap/                  # @kiosinc/restaurant-bootstrap
    │                           # depends on: core, adapters, api (wires everything)
    ├── createRepositories.ts   # Factory for Firestore
    ├── createServices.ts       # Factory for domain services
    ├── createApp.ts            # Factory for Express app
    └── index.ts
```

### Core Design Principles

1. **Core has ZERO infrastructure dependencies** - No Firebase, no DB drivers, no external SDKs
2. **Domain models are plain data** - Pure TypeScript interfaces, portable anywhere
3. **Repository pattern** - Abstract interfaces in core, implementations in adapter packages
4. **Adapters are separate packages** - Firestore, Square are all opt-in dependencies
5. **Dependency flows one direction** - Adapters depend on core, never the reverse
6. **Testable without infrastructure** - Core is 100% unit-testable with simple mocks

### Example Patterns

**Domain Model (Pure TypeScript, no dependencies)**
```typescript
// packages/core/models/catalog/Product.ts
// NOTE: No imports from firebase, no external dependencies

export interface Product {
  id: string;
  businessId: string;
  name: string;
  description: string;
  price: number;
  categoryId: string;
  optionSetIds: string[];
  inventory: InventoryCount;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryCount {
  state: 'inStock' | 'soldOut' | 'limited';
  quantity?: number;
}
```

**Repository Interface (in core, no implementation)**
```typescript
// packages/core/repositories/ProductRepository.ts
// NOTE: Still no imports from firebase - just the interface contract

import { Product } from '../models';

export interface ProductRepository {
  findById(businessId: string, productId: string): Promise<Product | null>;
  findByCategory(businessId: string, categoryId: string): Promise<Product[]>;
  findAll(businessId: string): Promise<Product[]>;
  save(product: Product): Promise<void>;
  delete(businessId: string, productId: string): Promise<void>;
}
```

**Firestore Implementation (separate package)**
```typescript
// packages/adapters/firestore/repositories/FirestoreProductRepository.ts
// This package depends on @kiosinc/restaurant-core and firebase-admin

import { Product, ProductRepository } from '@kiosinc/restaurant-core';
import { Firestore } from 'firebase-admin/firestore';
import { ProductConverter } from '../converters/ProductConverter';

export class FirestoreProductRepository implements ProductRepository {
  constructor(private db: Firestore) {}

  async findById(businessId: string, productId: string): Promise<Product | null> {
    const doc = await this.db
      .collection('businesses').doc(businessId)
      .collection('products').doc(productId)
      .withConverter(ProductConverter)
      .get();
    return doc.exists ? doc.data() ?? null : null;
  }
  // ...
}
```

---

## Claude Implementation Prompts

Use these prompts to instruct Claude to build out each component of the v2 architecture.

**Build order:** Prompts 1-4 build `@kiosinc/restaurant-core` (pure TypeScript, no dependencies). Prompt 5+ build adapter packages that depend on core.

---

### Prompt 1: Core Package - Domain Models

```
Create the domain models for @kiosinc/restaurant-core.

Requirements:
- Create packages/core/models/ with pure TypeScript interfaces
- CRITICAL: Zero external dependencies - no Firebase, no database drivers, no external SDKs
- Migrate these existing models to clean interfaces:
  - Business, Location, BusinessProfile (from src/restaurant/roots/)
  - Product, Category, Option, OptionSet, TaxRate, Discount, Inventory (from src/restaurant/catalog/)
  - Order, OrderItem, Payment (from src/restaurant/orders/)
  - Menu, MenuGroup, KioskConfig (from src/restaurant/surfaces/)
  - DailyKeyMetricReport, LocationKeyMetricReport (from src/reports/)
- Remove all Firestore references, converters, and Firebase imports
- Use consistent naming: camelCase for properties, PascalCase for types
- Include JSDoc comments for each interface
- Create barrel exports in index.ts files
- Fix existing issues: rename InventoryCountState values to camelCase (inStock, soldOut)

Package.json should have NO dependencies (only devDependencies for TypeScript).

Reference the existing implementations in src/restaurant/ for field definitions but strip out all persistence logic.
```

### Prompt 2: Core Package - Repository Interfaces

```
Create repository interfaces for @kiosinc/restaurant-core.

Requirements:
- Create packages/core/repositories/ with abstract repository interfaces
- CRITICAL: No implementations here - just interface contracts
- CRITICAL: No external dependencies - these are pure TypeScript interfaces
- Create interfaces for: ProductRepository, CategoryRepository, OptionRepository, OptionSetRepository, TaxRateRepository, DiscountRepository, OrderRepository, BusinessRepository, LocationRepository, MenuRepository, ReportRepository
- Each repository should define:
  - findById(businessId, id): Promise<T | null>
  - findAll(businessId): Promise<T[]>
  - save(entity): Promise<void>
  - delete(businessId, id): Promise<void>
  - Domain-specific queries (e.g., findByCategory for products)
- Use generic base interface: Repository<T>
- Include JSDoc comments explaining each method
- Create barrel export in index.ts

These interfaces will be implemented by separate adapter packages (@kiosinc/restaurant-firestore, etc.)
```

### Prompt 3: Core Package - Domain Services

```
Create domain services for @kiosinc/restaurant-core.

Requirements:
- Create packages/core/services/ with business logic
- CRITICAL: No external dependencies - services depend only on repository interfaces
- Services receive repository interfaces via constructor (dependency injection)
- Create these services:
  - CatalogService: product/category CRUD, option management, bulk operations
  - OrderService: order creation, validation, state transitions, pricing calculation
  - InventoryService: stock updates, low-stock alerts, inventory sync
  - PricingService: price calculation with taxes, discounts, modifiers
  - ReportingService: generate daily/location metrics, aggregate order data
- Include input validation
- Emit domain events for significant state changes
- No direct database access - only through repository interfaces
- Include comprehensive JSDoc comments

Example:
class OrderService {
  constructor(
    private orderRepo: OrderRepository,
    private productRepo: ProductRepository,
    private pricingService: PricingService,
    private eventBus: EventBus
  ) {}

  async createOrder(input: CreateOrderInput): Promise<Order> {
    // validate, calculate prices, save, emit event
  }
}

The actual repository implementations (Firestore) are injected at runtime from adapter packages.
```

### Prompt 4: Core Package - Events, Errors & Utilities

```
Complete the @kiosinc/restaurant-core package with events, errors, and utilities.

Requirements:
- CRITICAL: Still no external dependencies - pure TypeScript only

1. Domain Events (packages/core/events/):
   - Define event interfaces:
     - OrderCreated, OrderUpdated, OrderCompleted, OrderCancelled
     - InventoryUpdated, LowStockAlert
     - ProductCreated, ProductUpdated, ProductDeleted
     - CatalogSynced (for external integration sync)
   - Create EventBus interface with:
     - publish(event: DomainEvent): Promise<void>
     - subscribe<T>(eventType: string, handler: (event: T) => Promise<void>): void
   - Create InMemoryEventBus implementation (for testing, works without infrastructure)
   - Events should be serializable (for queue-based processing)

2. Typed Errors (packages/core/errors/):
   - NotFoundError
   - ValidationError
   - ConflictError
   - UnauthorizedError
   - All extend a base DomainError class
   - Include error codes for programmatic handling

3. Utilities (packages/core/utils/):
   - dates.ts: standardizedDate() function (consolidate from duplicated implementations)
   - money.ts: currency formatting, rounding
   - ids.ts: ID generation utilities
   - validation.ts: common validators
   - Result<T, E> type for explicit error handling (optional)

4. Main barrel export (packages/core/index.ts):
   - Export all models, repositories, services, events, errors, utils
   - This is the public API of @kiosinc/restaurant-core

Reference:
- src/reports/DailyKeyMetricReportV2.ts:84-91 and src/reports/LocationKeyMetricReport.ts:56-63 for duplicated standardizedDate()
- src/utils/ for existing utilities
```

---

### Prompt 5: Firestore Adapter Package

```
Create @kiosinc/restaurant-firestore - a separate package that implements repository interfaces for Firestore.

Requirements:
- Create packages/adapters/firestore/
- package.json dependencies:
  - "@kiosinc/restaurant-core": workspace dependency
  - "firebase-admin": peer dependency
- This package IMPORTS from @kiosinc/restaurant-core, never the reverse

1. Helper utilities (helpers.ts):
   - toISOString(date: Date): string
   - fromISOString(str: string): Date
   - withTimestamps(data): adds createdAt/updatedAt serialization
   - handleNull<T>(value: T | null | undefined): T | null
   - Small, focused functions - NOT a generic converter factory

2. Explicit converters per model (converters/):
   - ProductConverter.ts, CategoryConverter.ts, OrderConverter.ts, etc.
   - Each implements FirestoreDataConverter<T> from Firestore SDK
   - Uses helper utilities for common operations
   - Keeps model-specific mapping logic explicit and readable
   - Example:
     import { Product } from '@kiosinc/restaurant-core';

     export const ProductConverter: FirestoreDataConverter<Product> = {
       toFirestore(product) {
         return withTimestamps({
           name: product.name,
           price: product.price,
           categoryId: product.categoryId,
         });
       },
       fromFirestore(snapshot) {
         const data = snapshot.data();
         return {
           id: snapshot.id,
           name: data.name,
           price: data.price,
           createdAt: fromISOString(data.createdAt),
           updatedAt: fromISOString(data.updatedAt),
         };
       },
     };

3. Repository implementations (repositories/):
   - Implement all repository interfaces from @kiosinc/restaurant-core
   - Inject Firestore instance via constructor
   - Use converters with .withConverter() on collection references
   - Handle Firestore-specific concerns: batched writes, transactions
   - Proper error handling - convert Firestore errors to domain errors
   - Support pagination (cursor-based)
   - Create FirestoreUnitOfWork for transactional operations

4. CloudTasksEventBus (optional):
   - Implementation of EventBus that publishes to Google Cloud Tasks
   - Separate from core's InMemoryEventBus

Files to create:
- package.json (with correct dependencies)
- helpers.ts
- converters/*.ts
- repositories/*.ts
- CloudTasksEventBus.ts (optional)
- index.ts (barrel export + factory function)

Reference existing Firestore logic in src/firestore-core/ and src/restaurant/ but keep converters explicit per model.
```

### Prompt 6: Square Integration Package

```
Create @kiosinc/restaurant-square - a separate package for Square POS integration.

Requirements:
- Create packages/integrations/square/
- package.json dependencies:
  - "@kiosinc/restaurant-core": workspace dependency
  - "square": peer dependency (Square SDK)
- Reference existing implementation in src/restaurant/connected-accounts/

Structure:
- SquareClient.ts: API wrapper for Square SDK
- SquareSyncService.ts: bidirectional sync logic
- SquareWebhookHandler.ts: process incoming webhooks
- converters/: map between @kiosinc/restaurant-core models and Square API types
  - ProductConverter.ts (domain <-> Square catalog items)
  - OrderConverter.ts (domain <-> Square orders)
- types.ts: Square-specific types
- index.ts: barrel export

Features:
- Use domain events from core to trigger sync operations
- Handle rate limiting and retries
- Support incremental sync (track last sync timestamp)
- Convert Square errors to domain errors from core
```

### Prompt 7: API Layer Package

```
Create @kiosinc/restaurant-api - Express API layer as a separate package.

Requirements:
- Create packages/api/
- package.json dependencies:
  - "@kiosinc/restaurant-core": workspace dependency
  - "express": dependency
  - "zod": dependency (for validation)
- NOTE: Do NOT depend on @kiosinc/restaurant-firestore or any adapter
  - API receives services via dependency injection at runtime
  - This keeps the API package adapter-agnostic

Structure:
- middleware/
  - auth.ts: JWT/Firebase Auth validation (use async/await, not .then().catch())
  - errorHandler.ts: convert domain errors to HTTP responses
  - requestLogger.ts: structured logging
- routes/
  - catalog.ts: CRUD for products, categories, options
  - orders.ts: order management endpoints
  - business.ts: business/location management
  - webhooks.ts: external service webhooks
- validators/: zod schemas for request validation
- index.ts: Express app factory

Features:
- Dependency injection for services (receive from bootstrap)
- Consistent response format: { data, error, meta }
- OpenAPI/Swagger documentation comments
- Convert domain errors to proper HTTP status codes

Fix existing issues from src/user/:
- Replace .then().catch() with async/await (Authentication.ts pattern)
- Add proper error handling (UserRequest.ts pattern)
```

### Prompt 8: Migration Guide

```
Create a migration guide and compatibility layer for v1 to v2.

Requirements:
- Document breaking changes between v1 and v2:
  - Package split: @kiosinc/restaurant-core now has NO Firestore dependency
  - Consumers must also install @kiosinc/restaurant-firestore (or other adapter)
  - Import paths changed
  - Firestore converters no longer on model classes

- Create packages/compat/ with v1-compatible exports (optional):
  - Re-exports that maintain old import paths
  - Wrapper classes that maintain v1 API signatures
  - Deprecation warnings when v1 patterns are used

- Create migration script (scripts/migrate-v1-to-v2.ts):
  - Identifies v1 imports in consuming code
  - Suggests v2 replacements
  - Can auto-fix simple cases (import path changes)

- MIGRATION.md document covering:
  - Why the split was made (dependency hygiene, testability)
  - Step-by-step upgrade guide
  - Before/after code examples
  - Breaking changes checklist
```

### Prompt 9: Testing Infrastructure

```
Create testing infrastructure for v2 packages.

Requirements:
1. Core package tests (packages/core/__tests__/):
   - Factory functions: createTestProduct(), createTestOrder(), etc.
   - In-memory repository implementations for unit testing
   - InMemoryEventBus already exists in core - use it
   - Unit tests for all services (OrderService, CatalogService, etc.)
   - 100% testable without ANY infrastructure

2. Firestore adapter tests (packages/adapters/firestore/__tests__/):
   - Firestore emulator setup helpers
   - Integration tests for each repository
   - Tests that verify converters round-trip correctly

3. API package tests (packages/api/__tests__/):
   - Supertest helpers
   - Auth mocking utilities
   - Endpoint integration tests

Example test demonstrating the value of separation:

// This test runs instantly, no Firebase needed
describe('OrderService', () => {
  it('creates order with correct total', async () => {
    const productRepo = new InMemoryProductRepository([testProduct]);
    const orderRepo = new InMemoryOrderRepository();
    const eventBus = new InMemoryEventBus();
    const service = new OrderService(orderRepo, productRepo, eventBus);

    const order = await service.createOrder({ items: [...] });

    expect(order.total).toBe(expectedTotal);
    expect(eventBus.published).toContainEqual({ type: 'OrderCreated', ... });
  });
});

Use vitest. Ensure core package has 100% unit test coverage with zero infrastructure.
```

### Prompt 10: Bootstrap & Dependency Injection

```
Create bootstrap utilities for wiring up the v2 packages.

Requirements:
- Create packages/bootstrap/ or include in @kiosinc/restaurant-api
- Simple factory functions (no DI framework required):

  // Production setup
  import { createServices } from '@kiosinc/restaurant-bootstrap';
  import { createFirestoreRepositories } from '@kiosinc/restaurant-firestore';

  const db = admin.firestore();
  const repositories = createFirestoreRepositories(db);
  const services = createServices(repositories);

  // Now use services.catalogService, services.orderService, etc.

- Support different configurations:
  - Production: real Firestore, real Square
  - Development: Firestore emulator, mock Square
  - Testing: in-memory everything

- Optional: tsyringe or inversify integration for larger apps

- Factory functions:
  - createFirestoreRepositories(db: Firestore): Repositories
  - createServices(repos: Repositories, eventBus?: EventBus): Services
  - createTestRepositories(): Repositories (in-memory)
  - createApp(services: Services): Express.Application

Example full bootstrap:

const db = admin.firestore();
const repos = createFirestoreRepositories(db);
const eventBus = new CloudTasksEventBus(cloudTasks);
const services = createServices(repos, eventBus);
const app = createApp(services);

app.listen(3000);
```
