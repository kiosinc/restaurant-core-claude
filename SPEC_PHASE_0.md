# Phase 0 (Foundation) — Detailed Spec

## Overview

New files only. No existing code modified except appending exports to `src/index.ts`. Sets up the domain base classes, persistence interfaces, and test framework for all subsequent phases.

---

## 1. Implementation Spec

### 1.1 `src/domain/IdGenerator.ts`

Pluggable interface replacing `FirestoreObject.autoId()` / `FirestoreObjectV2.autoId()` (both call `getFirestore()`).

```typescript
export interface IdGenerator {
  generate(): string;
}
```

Zero dependencies. Single method. Implementations: `UuidGenerator` (default, in DomainEntity.ts), `FirestoreIdGenerator` (future, in persistence layer).

---

### 1.2 `src/domain/DomainEntity.ts`

Pure base class replacing `FirestoreObject` V1 base fields. Zero Firebase imports.

```typescript
import { IdGenerator } from './IdGenerator';
import { v4 as uuidv4 } from 'uuid';

export interface DomainEntityProps {
  Id?: string;
  created?: Date;
  updated?: Date;
  isDeleted?: boolean;
}

class UuidGenerator implements IdGenerator {
  generate(): string { return uuidv4(); }
}

export abstract class DomainEntity {
  private static _idGenerator: IdGenerator = new UuidGenerator();

  static setIdGenerator(generator: IdGenerator): void;
  static getIdGenerator(): IdGenerator;

  readonly Id: string;
  readonly created: Date;
  updated: Date;
  readonly isDeleted: boolean;

  protected constructor(props: DomainEntityProps) {
    const now = new Date();
    this.Id = props.Id ?? DomainEntity._idGenerator.generate();
    this.created = props.created ?? now;
    this.updated = props.updated ?? now;
    this.isDeleted = props.isDeleted ?? false;
  }
}
```

**Key decisions:**
- **Static setter for IdGenerator** (not constructor injection). Mirrors current `autoId()` usage. Called once at app bootstrap. Avoids invasive constructor changes across all subclasses.
- **UUID v4 default**. `uuid` already in devDeps. Entities instantiate in tests without Firebase.
- **`isDeleted` is readonly** (matches V2). Mutation via dedicated methods in future phases.
- **`metadata()` and `metaLinks()` are NOT on this class.** Not all entities need them. Those move to `MetadataSpec` interface.
- **`collectionRef()` is NOT on this class.** That's a persistence concern, moves to repositories.

**Replaces:** `FirestoreObject` fields/constructor (not the abstract methods).

---

### 1.3 `src/domain/TenantEntity.ts`

Extends DomainEntity with `businessId`. Replaces `FirestoreObjectV2` base fields.

```typescript
import { DomainEntity, DomainEntityProps } from './DomainEntity';

export interface TenantEntityProps extends DomainEntityProps {
  businessId: string;
}

export abstract class TenantEntity extends DomainEntity {
  readonly businessId: string;

  protected constructor(props: TenantEntityProps) {
    super(props);
    this.businessId = props.businessId;
  }
}
```

Minimal. All V2 CRUD helpers (`setGeneric`, `getGeneric`, etc.) move to `Repository`/`FirestoreRepository`.

---

### 1.4 `src/domain/MetadataSpec.ts`

Pure interfaces separating "what metadata exists" (domain) from "where to write it" (persistence).

```typescript
/** Optional interface for entities that produce metadata projections */
export interface MetadataProjection<T = Record<string, unknown>> {
  metadata(): T;
}

/** A single denormalization target: which document, which field */
export interface MetaLinkDeclaration {
  documentPath: string;  // e.g. "businesses/abc/locations"
  fieldPath: string;     // e.g. "locations.loc123"
}

/** Bridge between domain entity and its metadata denormalization rules */
export interface MetadataSpec<TEntity, TMeta> {
  getMetadata(entity: TEntity): TMeta;
  getMetaLinks(entity: TEntity, businessId: string): MetaLinkDeclaration[];
}
```

**How it maps to current code:**

| Current | New |
|---------|-----|
| `product.metadata()` -> `ProductMeta` | Entity keeps `metadata()`. Spec delegates to it. |
| `location.metaLinks(businessId)` -> `{docPath: fieldPath}` | `LocationMetadataSpec.getMetaLinks()` -> `MetaLinkDeclaration[]` |
| Empty `metaLinks()` on Product/Category | No spec registered -> registry returns `[]` |

**Why `MetaLinkDeclaration` instead of the current `{[docPath]: fieldPath}` map:** Structured type is clearer, typeable, and supports future features (conditional writes, batch grouping).

---

### 1.5 `src/persistence/Repository.ts`

Generic CRUD + linked-object lookup interface.

```typescript
import { DomainEntity } from '../domain/DomainEntity';

export interface Repository<T extends DomainEntity> {
  get(businessId: string, id: string): Promise<T | null>;
  set(entity: T, businessId: string): Promise<void>;
  update(entity: T, businessId: string): Promise<void>;
  delete(businessId: string, id: string): Promise<void>;
  findByLinkedObject(
    businessId: string,
    linkedObjectId: string,
    provider: string,
  ): Promise<T | null>;
}
```

**Key decisions:**
- `businessId` is an explicit param everywhere (needed for `get`/`delete` where no entity instance exists).
- `provider` is `string`, not the `const enum Provider` from Constants.ts -- keeps interface decoupled.
- No `list()`/`query()` yet -- current codebase has no generic query pattern. Added in later phases.
- Returns `Promise<void>` for writes -- no leaked Firestore types.

**Replaces:** `FirestoreObjectV2` static/instance CRUD methods + `FirestoreWriter.setObject`/`deleteObject`.

---

### 1.6 `src/persistence/MetadataRegistry.ts`

Registry collecting `MetadataSpec` registrations, used by `FirestoreRepository` at write time.

```typescript
import { MetadataSpec, MetaLinkDeclaration } from '../domain/MetadataSpec';
import { DomainEntity } from '../domain/DomainEntity';

export class MetadataRegistry {
  private specs = new Map<Function, MetadataSpec<any, any>>();

  register<T extends DomainEntity, TMeta>(
    entityClass: new (...args: any[]) => T,
    spec: MetadataSpec<T, TMeta>,
  ): void;

  resolve<T extends DomainEntity>(entity: T): MetadataSpec<T, unknown> | null;
  // Walks prototype chain -- handles inheritance

  getMetaLinks<T extends DomainEntity>(entity: T, businessId: string): MetaLinkDeclaration[];
  // Returns [] if no spec registered

  getMetadata<T extends DomainEntity>(entity: T): unknown | null;
  // Returns null if no spec registered

  has(entityClass: new (...args: any[]) => DomainEntity): boolean;
  clear(): void;
}
```

**Key decisions:**
- **Instance-based, not singleton.** Tests create isolated registries. App bootstrap configures one instance.
- **Prototype chain walking** in `resolve()` -- if `SpecialLocation extends Location` and only `Location` has a spec, lookup still works. Replaces `instanceof` chains in `FirestoreWriter`.
- **`Map<Function, MetadataSpec>`** keyed by constructor -- standard TS type-to-instance pattern.

---

### 1.7 `src/persistence/firestore/FirestoreRepository.ts`

Abstract base Firestore repository. Absorbs CRUD logic from `FirestoreObjectV2` + transaction pattern from `FirestoreWriter`.

```typescript
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { DomainEntity } from '../../domain/DomainEntity';
import { Repository } from '../Repository';
import { MetadataRegistry } from '../MetadataRegistry';

export interface FirestoreRepositoryConfig<T extends DomainEntity> {
  collectionRef(businessId: string): FirebaseFirestore.CollectionReference;
  toFirestore(entity: T): FirebaseFirestore.DocumentData;
  fromFirestore(data: FirebaseFirestore.DocumentData, id: string, businessId: string): T;
}

export abstract class FirestoreRepository<T extends DomainEntity>
  implements Repository<T>
{
  constructor(protected readonly metadataRegistry: MetadataRegistry) {}

  protected abstract config(): FirestoreRepositoryConfig<T>;

  async get(businessId, id): Promise<T | null>;
  // Fetches doc, calls dateify(), returns fromFirestore() or null

  async set(entity, businessId): Promise<void>;
  // Transaction: sets doc + denormalizes metadata via registry

  async update(entity, businessId): Promise<void>;
  // Direct update, no metadata

  async delete(businessId, id): Promise<void>;
  // Fetches entity, transaction: deletes doc + FieldValue.delete() on metadata links

  async findByLinkedObject(businessId, linkedObjectId, provider): Promise<T | null>;
  // where('linkedObjects.${provider}.linkedObjectId', '==', linkedObjectId)
  // Throws if multiple matches

  protected dateify(object: Record<string, any>): Record<string, any>;
  // Recursive Timestamp -> Date (duck-typed: typeof value.toDate === 'function')
}
```

**Key decisions:**
- **Config pattern** -- subclasses implement one `config()` method returning collectionRef factory + converters. Keeps subclasses concise.
- **`set()` runs metadata in a transaction** -- matches current `FirestoreObjectV2.setGeneric()`.
- **`delete()` fetches-then-deletes** -- needs entity to resolve metadata links.
- **Does NOT include cross-entity relationship updates** -- the `instanceof` chains from `FirestoreWriter.setT()` become `RelationshipHandler` in Phase 4.

---

### 1.8 Barrel Exports

**`src/domain/index.ts`:**
```typescript
export { IdGenerator } from './IdGenerator';
export { DomainEntity, DomainEntityProps } from './DomainEntity';
export { TenantEntity, TenantEntityProps } from './TenantEntity';
export { MetadataProjection, MetaLinkDeclaration, MetadataSpec } from './MetadataSpec';
```

**`src/persistence/index.ts`:**
```typescript
export { Repository } from './Repository';
export { MetadataRegistry } from './MetadataRegistry';
export { FirestoreRepository, FirestoreRepositoryConfig } from './firestore/FirestoreRepository';
```

**Append to `src/index.ts`:**
```typescript
export * as Domain from './domain';
export * as Persistence from './persistence';
```

---

## 2. Testing Spec

### 2.1 Framework: Vitest

- Native TypeScript support, no `ts-jest` config
- Compatible with CommonJS output
- API-compatible with Jest (describe/it/expect)
- `uuid` already in devDeps

### 2.2 Setup

```bash
npm install --save-dev vitest
```

**`vitest.config.ts`** (project root):
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/__tests__/**/*.test.ts'],
    environment: 'node',
  },
});
```

**`package.json` script additions:**
```json
"test": "vitest run",
"test:watch": "vitest"
```

No `tsconfig.json` changes -- it already excludes `**/__tests__/*`.

### 2.3 "Zero Infrastructure" Requirement

All Phase 0 tests must pass **without**:
- `admin.initializeApp()` called
- Firestore emulator running
- Network access
- Environment variables

This works because:
- `DomainEntity` defaults to UUID (no `getFirestore()`)
- `MetadataRegistry` is pure in-memory Map operations
- `FirestoreRepository` tests use `vi.mock('firebase-admin/firestore')` with in-memory stubs

### 2.4 Test Cases by File

#### `src/domain/__tests__/IdGenerator.test.ts`
| # | Test | Assertion |
|---|------|-----------|
| 1 | UuidGenerator produces valid UUID v4 | Matches `/^[0-9a-f]{8}-...-[0-9a-f]{12}$/i` |
| 2 | UuidGenerator produces unique IDs | 1000 IDs -> Set size 1000 |
| 3 | Custom IdGenerator works | Counter-based impl produces sequential IDs |

#### `src/domain/__tests__/DomainEntity.test.ts`

Uses a concrete `TestEntity extends DomainEntity` subclass.

| # | Test | Assertion |
|---|------|-----------|
| 1 | Auto-generates UUID when no Id provided | `entity.Id` matches UUID pattern |
| 2 | Uses provided Id | `entity.Id === 'custom-id'` |
| 3 | Defaults created/updated to now | Both within +/-1ms of `new Date()` |
| 4 | Uses provided dates | Exact match on getTime() |
| 5 | Defaults isDeleted to false | `=== false` |
| 6 | Uses provided isDeleted | `=== true` |
| 7 | setIdGenerator replaces generator | Mock returning 'fixed-id' -> entity.Id === 'fixed-id' |
| 8 | getIdGenerator returns current | Has `generate` method |
| 9 | updated is mutable | Assign new Date, verify changed |
| 10 | Id is readonly | `@ts-expect-error` on assignment |
| 11 | Instantiates without Firebase | Test passing = proof |

Reset IdGenerator in `afterEach` to avoid test pollution.

#### `src/domain/__tests__/TenantEntity.test.ts`

Uses a concrete `TestTenantEntity extends TenantEntity` subclass.

| # | Test | Assertion |
|---|------|-----------|
| 1 | Stores businessId | `entity.businessId === 'biz-1'` |
| 2 | Inherits DomainEntity fields | Has Id, created, updated, isDeleted |
| 3 | businessId is readonly | `@ts-expect-error` on assignment |

#### `src/domain/__tests__/MetadataSpec.test.ts`
| # | Test | Assertion |
|---|------|-----------|
| 1 | MetaLinkDeclaration shape | Literal `{ documentPath, fieldPath }` compiles and accessors work |
| 2 | MetadataSpec implementation | Test impl's getMetadata/getMetaLinks return correct values |
| 3 | MetadataProjection implementation | Class with metadata() returns expected projection |

#### `src/persistence/__tests__/MetadataRegistry.test.ts`
| # | Test | Assertion |
|---|------|-----------|
| 1 | Register and resolve | `resolve(entity) === spec` |
| 2 | Null for unregistered | `resolve(entity) === null` |
| 3 | Prototype chain walking | Child class resolves parent's spec |
| 4 | getMetaLinks with spec | Returns expected MetaLinkDeclaration[] |
| 5 | getMetaLinks without spec | Returns `[]` |
| 6 | getMetadata with spec | Returns expected projection |
| 7 | getMetadata without spec | Returns `null` |
| 8 | has() true/false | Correct after register |
| 9 | clear() removes all | has() returns false after clear |
| 10 | No Firebase dependency | Test passing = proof |

#### `src/persistence/__tests__/Repository.test.ts`
| # | Test | Assertion |
|---|------|-----------|
| 1 | Interface compiles | Dummy implementing class compiles (type-level only) |

#### `src/persistence/firestore/__tests__/FirestoreRepository.test.ts`

Uses `vi.mock('firebase-admin/firestore')` + concrete `TestRepository extends FirestoreRepository`.

| # | Test | Assertion |
|---|------|-----------|
| 1 | get() returns entity when exists | fromFirestore called, entity returned |
| 2 | get() returns null when missing | `null` returned |
| 3 | set() writes doc + metadata in transaction | transaction.set + transaction.update called |
| 4 | set() works without metadata spec | Only transaction.set called |
| 5 | update() writes without metadata | ref.update called, no transaction |
| 6 | delete() removes doc + cleans metadata | transaction.delete + FieldValue.delete() |
| 7 | delete() no-op when missing | No transaction started |
| 8 | findByLinkedObject() returns entity | Correct where() query, entity returned |
| 9 | findByLinkedObject() returns null | Empty snapshot -> null |
| 10 | findByLinkedObject() throws on multiple | `snapshot.docs.length > 1` -> Error |
| 11 | dateify() converts Timestamps | `{ toDate() }` -> Date |
| 12 | dateify() handles nesting | Nested objects converted recursively |
| 13 | dateify() leaves primitives alone | Strings, numbers unchanged |

---

## 3. Implementation & Testing Tracker

### Infrastructure
- [ ] Install Vitest (`npm install --save-dev vitest`)
- [ ] Create `vitest.config.ts`
- [ ] Add test scripts to `package.json`
- [ ] Verify `npm run test` executes

### Domain Layer -- Code
- [ ] `src/domain/IdGenerator.ts` -- `IdGenerator` interface
- [ ] `src/domain/DomainEntity.ts` -- `DomainEntityProps`, `UuidGenerator`, `DomainEntity` class
- [ ] `src/domain/TenantEntity.ts` -- `TenantEntityProps`, `TenantEntity` class
- [ ] `src/domain/MetadataSpec.ts` -- `MetadataProjection`, `MetaLinkDeclaration`, `MetadataSpec`
- [ ] `src/domain/index.ts` -- barrel export

### Domain Layer -- Tests
- [ ] `src/domain/__tests__/IdGenerator.test.ts` (3 tests)
- [ ] `src/domain/__tests__/DomainEntity.test.ts` (11 tests)
- [ ] `src/domain/__tests__/TenantEntity.test.ts` (3 tests)
- [ ] `src/domain/__tests__/MetadataSpec.test.ts` (3 tests)

### Persistence Layer -- Code
- [ ] `src/persistence/Repository.ts` -- `Repository<T>` interface
- [ ] `src/persistence/MetadataRegistry.ts` -- `MetadataRegistry` class
- [ ] `src/persistence/firestore/FirestoreRepository.ts` -- `FirestoreRepositoryConfig`, `FirestoreRepository` class
- [ ] `src/persistence/index.ts` -- barrel export

### Persistence Layer -- Tests
- [ ] `src/persistence/__tests__/MetadataRegistry.test.ts` (10 tests)
- [ ] `src/persistence/__tests__/Repository.test.ts` (1 type-level test)
- [ ] `src/persistence/firestore/__tests__/FirestoreRepository.test.ts` (13 tests)

### Integration
- [ ] Append `Domain` and `Persistence` exports to `src/index.ts`
- [ ] `npm run tsc` passes
- [ ] `npx eslint src/` passes
- [ ] `npm run test` -- all 44 tests pass
- [ ] Existing code still compiles (no breaking changes)

---

## Critical Files Reference

| File | Why |
|------|-----|
| `src/firestore-core/core/FirestoreObject.ts` | V1 base -- contract DomainEntity replaces |
| `src/firestore-core/core/FirestoreObjectV2.ts` | V2 base -- CRUD extracted to FirestoreRepository |
| `src/firestore-core/core/FirestoreWriter.ts` | instanceof chains -> MetadataRegistry pattern |
| `src/firestore-core/core/LinkedObject.ts` | findQuery pattern -> Repository.findByLinkedObject |
| `src/restaurant/locations/Location.ts` | V2 model reference for metadata/metaLinks patterns |
| `src/index.ts` | Append new exports |
