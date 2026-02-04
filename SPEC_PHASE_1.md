# Phase 1 (Migrate Leaf Models: Event & Order) — Detailed Spec

## Overview

Migrate the two simplest domain models — `Event` and `Order` — from `FirestoreObject` to the new `DomainEntity`/`TenantEntity` base classes. Both have empty `metaLinks()`/`metadata()`, making them ideal first migrations with zero denormalization complexity.

**Scope:** New pure domain classes, new repository implementations, move `OrderSymbols` to domain layer, deprecate old classes, unit tests for all new code.

**Prerequisite:** Phase 0 complete (DomainEntity, TenantEntity, Repository, FirestoreRepository, MetadataRegistry all exist and tested).

---

## 1. Implementation Spec

### 1.1 `src/domain/connected-accounts/Event.ts`

Pure domain class replacing `src/restaurant/connected-accounts/Event.ts`. Zero Firebase imports.

```typescript
import { DomainEntity, DomainEntityProps } from '../DomainEntity';

export interface EventProps extends DomainEntityProps {
  provider: string;
  type: string;
  isSync: boolean;
  queueCap?: number;
  queueCount?: number;
  timestamp?: Date;
}

export class Event extends DomainEntity {
  readonly provider: string;
  readonly type: string;
  isSync: boolean;
  queueCap: number;
  queueCount: number;
  timestamp?: Date;

  constructor(props: EventProps) {
    super({
      ...props,
      Id: props.Id ?? Event.identifier(props.provider, props.type),
    });
    this.provider = props.provider;
    this.type = props.type;
    this.isSync = props.isSync;
    this.queueCap = props.queueCap ?? -1;
    this.queueCount = props.queueCount ?? 0;
    this.timestamp = props.timestamp;
  }

  static identifier(provider: string, type: string): string {
    return `${provider}.${type}`;
  }
}
```

**Migration mapping from old Event:**

| Old (FirestoreObject) | New (DomainEntity) |
|---|---|
| `extends FirestoreObject` | `extends DomainEntity` |
| Positional constructor (10 params) | Props object (`EventProps`) |
| `collectionRef(businessId)` | Removed — persistence concern, moves to `EventRepository` |
| `metaLinks(businessId)` → `{}` | Removed — no metadata to denormalize |
| `metadata()` → `{}` | Removed — no metadata projection |
| `static collectionRef(businessId)` | Moves to `EventRepository.config().collectionRef` |
| `static find(businessId, provider, type)` | Moves to `EventRepository.findByProviderAndType()` |
| `static firestoreConverter` | Moves to `EventRepository.config().toFirestore/fromFirestore` |
| `static identifier(provider, type)` | Stays on domain class — pure string concatenation |
| `Id` defaults to `autoId()` (Firestore) | `Id` defaults to `Event.identifier(provider, type)` (matches old behavior) |
| `queueCap` defaults to `-1` | Same |
| `queueCount` defaults to `0` | Same |

**Key decisions:**
- **`Event` extends `DomainEntity`, not `TenantEntity`.** The old Event has no `businessId` field. It is accessed via `ConnectedAccounts.docRef(businessId)` path, meaning `businessId` is a path parameter only — not stored on the entity. Repository methods accept `businessId` as a parameter.
- **Props pattern** replaces 10-param positional constructor. Matches Phase 0 convention.
- **`identifier()` stays on domain class.** It's pure string logic with no Firebase dependency.

---

### 1.2 `src/domain/orders/OrderSymbols.ts`

Move `src/restaurant/orders/OrderSymbols.ts` to domain layer. File is already pure enums — no code changes needed, just relocate.

```typescript
// Exact copy of src/restaurant/orders/OrderSymbols.ts
export enum OrderType {
  none = 'none',
  toGo = 'toGo',
  dineIn = 'dineIn',
}

export interface OrderTypeMeta {
  table?: string;
}

export const enum OrderState {
  open = 'open',
  new = 'new',
  inProgress = 'inProgress',
  ready = 'ready',
  completed = 'completed',
  cancelled = 'cancelled',
}

export const enum PaymentState {
  none = 'none',
  approved = 'approved',
  pending = 'pending',
  completed = 'completed',
  cancelled = 'cancelled',
  failed = 'failed',
}
```

**Note:** `const enum` values are inlined at compile time. Old file will re-export from new location for backward compatibility.

---

### 1.3 `src/domain/orders/Order.ts`

Pure domain class replacing `src/restaurant/orders/OrderV3.ts`. Zero Firebase imports.

```typescript
import { DomainEntity, DomainEntityProps } from '../DomainEntity';
import { OrderState, OrderType, OrderTypeMeta, PaymentState } from './OrderSymbols';

// --- Sub-interfaces (migrated from OrderV3.ts, unchanged) ---

export interface SelectedValue {
  optionId: string;
  name: string;
  price: number;
  ordinal: number;
}

export interface OptionSetSelected {
  optionSetId: string;
  name: string;
  selectedValues: SelectedValue[];
  ordinal: number;
}

export interface OrderItem {
  readonly productId: string;
  readonly productName: string;
  readonly optionSetsSelected: OptionSetSelected[];
  readonly price: number;
}

export interface OrderPriceAdjustmentMeta {
  Id: string;
  name: string;
  value: number;
}

export interface OrderLineItem {
  readonly Id: string;
  item: OrderItem;
  quantity: number;
  taxes: OrderPriceAdjustmentMeta[];
  discounts: OrderPriceAdjustmentMeta[];
  surcharges: OrderPriceAdjustmentMeta[];
  note: string | null;
}

export interface OrderFulfillmentContact {
  phoneNumber: string | null;
  email: string | null;
  name: string | null;
}

export interface OrderFulfillment {
  type: OrderType;
  typeMetaData: OrderTypeMeta | null;
  scheduledTime: Date | null;
  contact: OrderFulfillmentContact | null;
  displayId: string | null;
}

export interface OrderPayment {
  paymentState: PaymentState;
  paymentTimestamp: Date;
  receiptUrl: string | null;
}

// --- LinkedObject reference (pure data, no Firestore query methods) ---

export interface LinkedObjectRef {
  linkedObjectId: string;
}

// --- Order props & class ---

export interface OrderProps extends DomainEntityProps {
  businessId: string;
  locationId: string;
  menuId: string;
  timestamp?: Date;
  channel: string;
  agent: string;
  deviceId: string | null;
  posProvider: string;
  totalAmount: number;
  totalDiscountAmount: number;
  totalTaxAmount: number;
  totalSurchargeAmount: number;
  totalTipAmount: number;
  customerId: string | null;
  fulfillment: OrderFulfillment;
  lineItems: OrderLineItem[];
  currency: string;
  taxes: OrderPriceAdjustmentMeta[];
  discounts: OrderPriceAdjustmentMeta[];
  surcharges: OrderPriceAdjustmentMeta[];
  note: string | null;
  payment: OrderPayment | null;
  linkedObjects: { [Id: string]: LinkedObjectRef } | null;
  state?: OrderState;
  referralCode: string | null;
  source: string | null;
  tags: string[] | null;
  version?: string;
  isAvailable?: boolean;
}

export class Order extends DomainEntity {
  readonly version: string;
  businessId: string;
  locationId: string;
  menuId: string;
  timestamp: Date;
  channel: string;
  agent: string;
  deviceId: string | null;
  posProvider: string;
  totalAmount: number;
  totalDiscountAmount: number;
  totalTaxAmount: number;
  totalSurchargeAmount: number;
  totalTipAmount: number;
  customerId: string | null;
  fulfillment: OrderFulfillment;
  lineItems: OrderLineItem[];
  currency: string;
  taxes: OrderPriceAdjustmentMeta[];
  discounts: OrderPriceAdjustmentMeta[];
  surcharges: OrderPriceAdjustmentMeta[];
  state: OrderState;
  referralCode: string | null;
  source: string | null;
  note: string | null;
  payment: OrderPayment | null;
  linkedObjects: { [Id: string]: LinkedObjectRef } | null;
  isAvailable: boolean;
  tags: string[] | null;

  constructor(props: OrderProps) {
    super(props);
    this.version = props.version ?? '3';
    this.businessId = props.businessId;
    this.locationId = props.locationId;
    this.menuId = props.menuId;
    this.timestamp = props.timestamp ?? new Date();
    this.channel = props.channel;
    this.agent = props.agent;
    this.deviceId = props.deviceId;
    this.posProvider = props.posProvider ?? 'system';
    this.totalAmount = props.totalAmount;
    this.totalDiscountAmount = props.totalDiscountAmount;
    this.totalTaxAmount = props.totalTaxAmount;
    this.totalSurchargeAmount = props.totalSurchargeAmount;
    this.totalTipAmount = props.totalTipAmount;
    this.customerId = props.customerId;
    this.fulfillment = props.fulfillment;
    this.lineItems = props.lineItems;
    this.currency = props.currency;
    this.taxes = props.taxes;
    this.discounts = props.discounts;
    this.surcharges = props.surcharges;
    this.state = props.state ?? OrderState.new;
    this.referralCode = props.referralCode;
    this.source = props.source;
    this.note = props.note;
    this.payment = props.payment;
    this.linkedObjects = props.linkedObjects;
    this.isAvailable = props.isAvailable ?? true;
    this.tags = props.tags;
  }
}
```

**Migration mapping from old Order:**

| Old (FirestoreObject) | New (DomainEntity) |
|---|---|
| `extends FirestoreObject` | `extends DomainEntity` |
| Positional constructor (32 params) | Props object (`OrderProps`) |
| `posProvider: Constants.Provider` | `posProvider: string` — decoupled from `const enum` import |
| `linkedObjects: { [Id: string]: LinkedObject }` | `linkedObjects: { [Id: string]: LinkedObjectRef }` — pure data interface, no query methods |
| `collectionRef(businessId)` | Removed — moves to `OrderRepository` |
| `docRef(businessId)` | Removed — moves to `OrderRepository` |
| `metaLinks(businessId)` → `{}` | Removed |
| `metadata()` → `{}` | Removed |
| `static collectionRef(businessId)` | Moves to `OrderRepository.config().collectionRef` |
| `static firestoreConverter` | Moves to `OrderRepository.config().toFirestore/fromFirestore` |

**Key decisions:**
- **`Order` extends `DomainEntity`, not `TenantEntity`.** Although Order has a `businessId` field, it is NOT stored in a `businesses/{businessId}/...` path via `TenantEntity` convention — it uses `Orders.docRef(businessId)` which resolves to a different root. `businessId` is a regular field.
- **`posProvider` is `string`, not `Constants.Provider`.** Decouples from `const enum` in persistence layer. Values are still `'square'` / `'system'` at runtime.
- **`LinkedObjectRef` replaces `LinkedObject` class.** The old `LinkedObject` class has Firestore query methods (`find`, `findQuery`). The domain layer only needs the data shape — a single `linkedObjectId` field. Full `LinkedObject` migration is Phase 2.
- **`version` defaults to `'3'`** matching the `VERSION` constant in old OrderV3.

---

### 1.4 `src/persistence/firestore/EventRepository.ts`

Concrete Firestore repository for Event. Absorbs `collectionRef`, `find`, and `firestoreConverter` from the old Event class.

```typescript
import { FirestoreRepository, FirestoreRepositoryConfig } from './FirestoreRepository';
import { Event } from '../../domain/connected-accounts/Event';
import { MetadataRegistry } from '../MetadataRegistry';
import ConnectedAccounts from '../../restaurant/roots/ConnectedAccounts';
import * as Paths from '../../firestore-core/Paths';

export class EventRepository extends FirestoreRepository<Event> {
  constructor(metadataRegistry: MetadataRegistry) {
    super(metadataRegistry);
  }

  protected config(): FirestoreRepositoryConfig<Event> {
    return {
      collectionRef(businessId: string) {
        return ConnectedAccounts.docRef(businessId)
          .collection(Paths.CollectionNames.events);
      },
      toFirestore(event: Event): FirebaseFirestore.DocumentData {
        return {
          provider: event.provider,
          type: event.type,
          isSync: event.isSync,
          queueCap: event.queueCap,
          queueCount: event.queueCount,
          timestamp: event.timestamp?.toISOString() ?? '',
          created: event.created.toISOString(),
          updated: event.updated.toISOString(),
          isDeleted: event.isDeleted,
        };
      },
      fromFirestore(data: FirebaseFirestore.DocumentData, id: string): Event {
        return new Event({
          provider: data.provider,
          type: data.type,
          isSync: data.isSync,
          queueCap: data.queueCap ?? -1,
          queueCount: data.queueCount ?? 0,
          timestamp: data.timestamp === '' ? undefined : new Date(data.timestamp),
          created: new Date(data.created),
          updated: new Date(data.updated),
          isDeleted: data.isDeleted,
          Id: id,
        });
      },
    };
  }

  /** Domain-specific query: find event by provider + type composite key */
  async findByProviderAndType(
    businessId: string,
    provider: string,
    type: string,
  ): Promise<Event | null> {
    const id = Event.identifier(provider, type);
    return this.get(businessId, id);
  }
}
```

**Key decisions:**
- **`findByProviderAndType()`** replaces old `Event.find()`. Uses the composite `identifier()` as a direct `get()` — same strategy as old code (doc ID = `provider.type`).
- **Converter logic is identical** to old `firestoreConverter` — field names, serialization format, and defaults preserved for data compatibility.
- **Imports `ConnectedAccounts` and `Paths`** for collection path resolution. These are still Firestore-coupled (acceptable in persistence layer).

---

### 1.5 `src/persistence/firestore/OrderRepository.ts`

Concrete Firestore repository for Order.

```typescript
import { FirestoreRepository, FirestoreRepositoryConfig } from './FirestoreRepository';
import { Order, LinkedObjectRef } from '../../domain/orders/Order';
import { MetadataRegistry } from '../MetadataRegistry';
import Orders from '../../restaurant/roots/Orders';
import * as Paths from '../../firestore-core/Paths';

export class OrderRepository extends FirestoreRepository<Order> {
  constructor(metadataRegistry: MetadataRegistry) {
    super(metadataRegistry);
  }

  protected config(): FirestoreRepositoryConfig<Order> {
    return {
      collectionRef(businessId: string) {
        return Orders.docRef(businessId)
          .collection(Paths.CollectionNames.orders);
      },
      toFirestore(order: Order): FirebaseFirestore.DocumentData {
        return {
          businessId: order.businessId,
          locationId: order.locationId,
          menuId: order.menuId,
          timestamp: order.timestamp.toISOString(),
          channel: order.channel,
          agent: order.agent,
          deviceId: order.deviceId ?? null,
          posProvider: order.posProvider,
          totalAmount: order.totalAmount,
          totalDiscountAmount: order.totalDiscountAmount,
          totalTaxAmount: order.totalTaxAmount,
          totalSurchargeAmount: order.totalSurchargeAmount,
          totalTipAmount: order.totalTipAmount ?? 0,
          customerId: order.customerId,
          fulfillment: JSON.parse(JSON.stringify(order.fulfillment)),
          lineItems: JSON.parse(JSON.stringify(order.lineItems)),
          currency: order.currency,
          taxes: JSON.parse(JSON.stringify(order.taxes)),
          discounts: JSON.parse(JSON.stringify(order.discounts)),
          surcharges: JSON.parse(JSON.stringify(order.surcharges)),
          note: order.note,
          payment: JSON.parse(JSON.stringify(order.payment)),
          linkedObjects: JSON.parse(JSON.stringify(order.linkedObjects)),
          state: order.state,
          referralCode: order.referralCode,
          source: order.source,
          tags: order.tags ?? null,
          version: order.version,
          isAvailable: order.isAvailable,
          created: order.created.toISOString(),
          updated: order.updated.toISOString(),
          isDeleted: order.isDeleted,
        };
      },
      fromFirestore(data: FirebaseFirestore.DocumentData, id: string): Order {
        return new Order({
          businessId: data.businessId,
          locationId: data.locationId,
          menuId: data.menuId,
          timestamp: new Date(data.timestamp),
          channel: data.channel,
          agent: data.agent,
          deviceId: data.deviceId ?? null,
          posProvider: data.posProvider,
          totalAmount: data.totalAmount,
          totalDiscountAmount: data.totalDiscountAmount,
          totalTaxAmount: data.totalTaxAmount,
          totalSurchargeAmount: data.totalSurchargeAmount,
          totalTipAmount: data.totalTipAmount ?? 0,
          customerId: data.customerId,
          fulfillment: data.fulfillment,
          lineItems: data.lineItems,
          currency: data.currency,
          taxes: data.taxes,
          discounts: data.discounts,
          surcharges: data.surcharges,
          note: data.note,
          payment: data.payment,
          linkedObjects: data.linkedObjects,
          state: data.state,
          referralCode: data.referralCode ?? null,
          source: data.source ?? null,
          tags: data.tags ?? null,
          version: data.version,
          isAvailable: data.isAvailable,
          created: new Date(data.created),
          updated: new Date(data.updated),
          isDeleted: data.isDeleted,
          Id: id,
        });
      },
    };
  }
}
```

**Key decisions:**
- **`JSON.parse(JSON.stringify(...))` preserved** in `toFirestore` for nested objects. Matches old converter exactly — strips class instances and Date prototypes for Firestore compatibility.
- **`totalTipAmount` defaults to `0`** in both directions — matches old converter's null-safety.
- **No `findByProviderAndType`** equivalent — orders don't have a composite key pattern.

---

### 1.6 Deprecation of Old Classes

Mark old classes `@deprecated` — no functional changes, no deletions.

**`src/restaurant/connected-accounts/Event.ts`:**
```typescript
/** @deprecated Use `Domain.Event` from `src/domain/connected-accounts/Event` instead. */
export default class Event extends FirestoreObject { ... }
```

**`src/restaurant/orders/OrderV3.ts`:**
```typescript
/** @deprecated Use `Domain.Order` from `src/domain/orders/Order` instead. */
export class Order extends FirestoreObject { ... }
```

**`src/restaurant/orders/OrderSymbols.ts`:**
```typescript
/** @deprecated Use `Domain.OrderSymbols` from `src/domain/orders/OrderSymbols` instead. */
// Re-export from new location for backward compatibility
```
Re-export approach: old `OrderSymbols.ts` re-exports everything from `src/domain/orders/OrderSymbols.ts` so existing consumers don't break.

---

### 1.7 Barrel Exports

**`src/domain/connected-accounts/index.ts`:**
```typescript
export { Event, EventProps } from './Event';
```

**`src/domain/orders/index.ts`:**
```typescript
export { Order, OrderProps, OrderItem, OrderLineItem, OrderFulfillment,
  OrderFulfillmentContact, OrderPayment, OrderPriceAdjustmentMeta,
  OptionSetSelected, SelectedValue, LinkedObjectRef } from './Order';
export { OrderType, OrderTypeMeta, OrderState, PaymentState } from './OrderSymbols';
```

**Update `src/domain/index.ts`** — append:
```typescript
export * as ConnectedAccounts from './connected-accounts';
export * as Orders from './orders';
```

**`src/persistence/firestore/index.ts`** — append:
```typescript
export { EventRepository } from './EventRepository';
export { OrderRepository } from './OrderRepository';
```

**`src/index.ts`** — no changes needed. `Domain` and `Persistence` namespace exports already cover the new files via barrel re-exports.

---

## 2. Testing Spec

### 2.1 "Zero Infrastructure" Requirement

All domain-layer tests must pass **without**:
- `admin.initializeApp()` called
- Firestore emulator running
- Network access
- Environment variables

Repository tests use `vi.mock('firebase-admin/firestore')` with in-memory stubs, same pattern as Phase 0's `FirestoreRepository.test.ts`.

### 2.2 Test Helpers

**`src/domain/__tests__/helpers/OrderFixtures.ts`** — factory functions for test data:

```typescript
import { OrderProps, OrderFulfillment } from '../../orders/Order';
import { OrderType, OrderState } from '../../orders/OrderSymbols';

export function createTestOrderProps(overrides?: Partial<OrderProps>): OrderProps {
  return {
    businessId: 'biz-1',
    locationId: 'loc-1',
    menuId: 'menu-1',
    channel: 'kiosk',
    agent: 'mobile-app',
    deviceId: null,
    posProvider: 'system',
    totalAmount: 1099,
    totalDiscountAmount: 0,
    totalTaxAmount: 100,
    totalSurchargeAmount: 0,
    totalTipAmount: 0,
    customerId: null,
    fulfillment: createTestFulfillment(),
    lineItems: [],
    currency: 'USD',
    taxes: [],
    discounts: [],
    surcharges: [],
    note: null,
    payment: null,
    linkedObjects: null,
    referralCode: null,
    source: null,
    tags: null,
    ...overrides,
  };
}

export function createTestFulfillment(overrides?: Partial<OrderFulfillment>): OrderFulfillment {
  return {
    type: OrderType.toGo,
    typeMetaData: null,
    scheduledTime: null,
    contact: null,
    displayId: null,
    ...overrides,
  };
}
```

**`src/domain/__tests__/helpers/EventFixtures.ts`:**

```typescript
import { EventProps } from '../../connected-accounts/Event';

export function createTestEventProps(overrides?: Partial<EventProps>): EventProps {
  return {
    provider: 'square',
    type: 'catalog',
    isSync: true,
    ...overrides,
  };
}
```

---

### 2.3 Test Cases — Domain Layer

#### `src/domain/connected-accounts/__tests__/Event.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | Constructs with all props | All fields match input values |
| 2 | Defaults Id to `provider.type` composite | `event.Id === 'square.catalog'` |
| 3 | Uses provided Id when given | `event.Id === 'custom-id'` |
| 4 | Defaults queueCap to -1 | `event.queueCap === -1` |
| 5 | Defaults queueCount to 0 | `event.queueCount === 0` |
| 6 | Uses provided queueCap/queueCount | Exact match on given values |
| 7 | timestamp is optional (undefined) | `event.timestamp === undefined` |
| 8 | timestamp accepts Date | `event.timestamp` is same Date instance |
| 9 | Inherits DomainEntity fields | Has `created`, `updated`, `isDeleted` |
| 10 | Defaults created/updated to now | Within +/-50ms of `new Date()` |
| 11 | Defaults isDeleted to false | `=== false` |
| 12 | `identifier()` returns `provider.type` | `Event.identifier('square', 'catalog') === 'square.catalog'` |
| 13 | Instantiates without Firebase | Test passing = proof |
| 14 | isSync is mutable | Assign `false`, verify changed |
| 15 | queueCap is mutable | Assign `10`, verify changed |
| 16 | queueCount is mutable | Assign `5`, verify changed |

#### `src/domain/orders/__tests__/OrderSymbols.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | OrderType has expected values | `none`, `toGo`, `dineIn` all accessible |
| 2 | OrderState has expected values | `open`, `new`, `inProgress`, `ready`, `completed`, `cancelled` |
| 3 | PaymentState has expected values | `none`, `approved`, `pending`, `completed`, `cancelled`, `failed` |
| 4 | OrderTypeMeta shape | `{ table?: string }` compiles and works |

**Note:** `const enum` values are inlined at compile time and cannot be iterated. Tests verify individual named values exist.

#### `src/domain/orders/__tests__/Order.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | Constructs with all props | All 27+ fields match input |
| 2 | Auto-generates UUID when no Id | `order.Id` matches UUID pattern |
| 3 | Uses provided Id | `order.Id === 'order-123'` |
| 4 | Defaults state to `OrderState.new` | `order.state === 'new'` |
| 5 | Uses provided state | `order.state === OrderState.completed` |
| 6 | Defaults version to `'3'` | `order.version === '3'` |
| 7 | Uses provided version | `order.version === '2'` |
| 8 | Defaults isAvailable to true | `order.isAvailable === true` |
| 9 | Defaults timestamp to now | Within +/-50ms of `new Date()` |
| 10 | Uses provided timestamp | Exact Date match |
| 11 | Defaults posProvider to `'system'` | `order.posProvider === 'system'` |
| 12 | Uses provided posProvider | `order.posProvider === 'square'` |
| 13 | Inherits DomainEntity fields | Has `created`, `updated`, `isDeleted` |
| 14 | Nullable fields accept null | `deviceId`, `customerId`, `note`, `payment`, `linkedObjects`, `referralCode`, `source`, `tags` all `null` |
| 15 | linkedObjects stores LinkedObjectRef | `order.linkedObjects['square'].linkedObjectId === 'sq-123'` |
| 16 | Fulfillment sub-interface works | All fulfillment fields accessible and correct |
| 17 | LineItems sub-interface works | OrderLineItem with nested OrderItem, taxes, discounts, surcharges |
| 18 | Payment sub-interface works | OrderPayment with paymentState, paymentTimestamp, receiptUrl |
| 19 | Instantiates without Firebase | Test passing = proof |
| 20 | state is mutable | Assign `OrderState.completed`, verify |
| 21 | totalAmount is mutable | Assign `2000`, verify |

---

### 2.4 Test Cases — Repository Layer

#### `src/persistence/firestore/__tests__/EventRepository.test.ts`

Uses `vi.mock('firebase-admin/firestore')` with mock Firestore stubs. Pattern mirrors Phase 0 `FirestoreRepository.test.ts`.

| # | Test | Assertion |
|---|------|-----------|
| 1 | `get()` returns Event when doc exists | `fromFirestore` produces correct Event, all fields match |
| 2 | `get()` returns null when doc missing | `null` returned |
| 3 | `set()` calls toFirestore with correct data | Serialized data matches expected shape |
| 4 | `set()` serializes timestamp as ISO string | `timestamp` field is ISO string or `''` |
| 5 | `set()` serializes empty timestamp as `''` | When `timestamp` is `undefined` |
| 6 | `set()` runs transaction (no metadata) | `transaction.set` called, no `transaction.update` (empty metaLinks) |
| 7 | `findByProviderAndType()` delegates to get | Calls `get(businessId, 'square.catalog')` |
| 8 | `findByProviderAndType()` returns null when not found | `null` returned |
| 9 | Round-trip: toFirestore -> fromFirestore preserves data | All fields match after serialization cycle |
| 10 | Handles undefined queueCap in fromFirestore | Defaults to `-1` |
| 11 | Handles undefined queueCount in fromFirestore | Defaults to `0` |

#### `src/persistence/firestore/__tests__/OrderRepository.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | `get()` returns Order when doc exists | All fields populated correctly |
| 2 | `get()` returns null when doc missing | `null` returned |
| 3 | `set()` serializes all fields correctly | DocumentData matches expected shape |
| 4 | `set()` deep-clones nested objects | `fulfillment`, `lineItems`, `taxes`, `discounts`, `surcharges`, `payment`, `linkedObjects` all JSON-round-tripped |
| 5 | `set()` handles null deviceId | `deviceId` is `null` in output |
| 6 | `set()` defaults totalTipAmount to 0 | When `totalTipAmount` is nullish |
| 7 | `set()` runs transaction (no metadata) | `transaction.set` called, no `transaction.update` |
| 8 | Round-trip: toFirestore -> fromFirestore preserves data | All fields match after cycle |
| 9 | fromFirestore handles null referralCode | Defaults to `null` |
| 10 | fromFirestore handles null source | Defaults to `null` |
| 11 | fromFirestore handles null tags | Defaults to `null` |
| 12 | fromFirestore handles missing totalTipAmount | Defaults to `0` |
| 13 | `findByLinkedObject()` queries correct field path | `where('linkedObjects.square.linkedObjectId', '==', 'sq-123')` |

---

### 2.5 Test Cases — Backward Compatibility

#### `src/restaurant/orders/__tests__/OrderSymbolsCompat.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | Old import path re-exports OrderType | `import { OrderType } from '../OrderSymbols'` still works |
| 2 | Old import path re-exports OrderState | Values match domain layer |
| 3 | Old import path re-exports PaymentState | Values match domain layer |

---

## 3. Implementation & Testing Tracker

### Domain Layer — Code
- [ ] Create `src/domain/connected-accounts/` directory
- [ ] `src/domain/connected-accounts/Event.ts` — `EventProps` interface, `Event` class
- [ ] `src/domain/connected-accounts/index.ts` — barrel export
- [ ] `src/domain/orders/` directory
- [ ] `src/domain/orders/OrderSymbols.ts` — copy enums + interfaces from old location
- [ ] `src/domain/orders/Order.ts` — all sub-interfaces, `OrderProps`, `LinkedObjectRef`, `Order` class
- [ ] `src/domain/orders/index.ts` — barrel export
- [ ] Update `src/domain/index.ts` — add `ConnectedAccounts` and `Orders` namespace exports

### Persistence Layer — Code
- [ ] `src/persistence/firestore/EventRepository.ts` — `EventRepository` class with `findByProviderAndType()`
- [ ] `src/persistence/firestore/OrderRepository.ts` — `OrderRepository` class
- [ ] Update `src/persistence/firestore/index.ts` — export new repositories
- [ ] Update `src/persistence/index.ts` — re-export if needed

### Deprecation & Compatibility
- [ ] Add `@deprecated` JSDoc to `src/restaurant/connected-accounts/Event.ts` class
- [ ] Add `@deprecated` JSDoc to `src/restaurant/orders/OrderV3.ts` `Order` class
- [ ] Modify `src/restaurant/orders/OrderSymbols.ts` to re-export from `src/domain/orders/OrderSymbols.ts`
- [ ] Add `@deprecated` JSDoc to `src/restaurant/orders/OrderSymbols.ts`

### Domain Layer — Tests
- [ ] `src/domain/__tests__/helpers/EventFixtures.ts` — `createTestEventProps()`
- [ ] `src/domain/__tests__/helpers/OrderFixtures.ts` — `createTestOrderProps()`, `createTestFulfillment()`
- [ ] `src/domain/connected-accounts/__tests__/Event.test.ts` (16 tests)
- [ ] `src/domain/orders/__tests__/OrderSymbols.test.ts` (4 tests)
- [ ] `src/domain/orders/__tests__/Order.test.ts` (21 tests)

### Persistence Layer — Tests
- [ ] `src/persistence/firestore/__tests__/EventRepository.test.ts` (11 tests)
- [ ] `src/persistence/firestore/__tests__/OrderRepository.test.ts` (13 tests)

### Backward Compatibility — Tests
- [ ] `src/restaurant/orders/__tests__/OrderSymbolsCompat.test.ts` (3 tests)

### Verification
- [ ] `npm run tsc` passes with no errors
- [ ] `npx eslint src/` passes
- [ ] `npm run test` — all new tests pass (68 tests across 8 test files)
- [ ] All Phase 0 tests still pass (no regressions)
- [ ] Old imports (`import Event from '@kiosinc/restaurant-core'`) still compile
- [ ] Old imports (`import { Order } from '@kiosinc/restaurant-core'`) still compile
- [ ] Domain classes instantiate without Firebase initialized

---

## Critical Files Reference

| File | Role |
|------|------|
| `src/restaurant/connected-accounts/Event.ts` | Old Event — deprecate, keep functional |
| `src/restaurant/orders/OrderV3.ts` | Old Order — deprecate, keep functional |
| `src/restaurant/orders/OrderSymbols.ts` | Old enums — becomes re-export shim |
| `src/restaurant/roots/ConnectedAccounts.ts` | Provides `docRef(businessId)` for EventRepository path |
| `src/restaurant/roots/Orders.ts` | Provides `docRef(businessId)` for OrderRepository path |
| `src/firestore-core/Paths.ts` | Collection name constants used by repositories |
| `src/firestore-core/Constants.ts` | `Provider` enum — Order decouples to plain `string` |
| `src/firestore-core/core/LinkedObject.ts` | Old class — replaced by `LinkedObjectRef` interface in domain |
| `src/domain/DomainEntity.ts` | Phase 0 base class — Event and Order extend this |
| `src/persistence/firestore/FirestoreRepository.ts` | Phase 0 base repo — EventRepository and OrderRepository extend this |
| `src/index.ts` | Barrel exports — no changes needed (Domain/Persistence namespaces cover it) |
