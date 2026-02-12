# Migration Guide: restaurant-core to restaurant-core-claude

This guide covers migrating from the legacy `@kiosinc/restaurant-core` (models with embedded persistence) to `@kiosinc/restaurant-core-claude` (domain/persistence separation).

## 1. Update Package Reference

```bash
# .npmrc — point @kiosinc scope at Artifact Registry
@kiosinc:registry=https://us-central1-npm.pkg.dev/<PROJECT_ID>/npm-packages/

# package.json
- "@kiosinc/restaurant-core": "^x.x.x"
+ "@kiosinc/restaurant-core-claude": "^0.0.1"
```

## 2. Update Imports

All public types are now exported under `Domain` and `Persistence` namespaces.

```typescript
// OLD — flat imports from barrel
import { Product, Category, Order, Business } from '@kiosinc/restaurant-core';
import { LinkedObject } from '@kiosinc/restaurant-core';

// NEW — namespaced imports
import { Domain, Persistence } from '@kiosinc/restaurant-core-claude';

const product: Domain.Catalog.Product = ...;
const order: Domain.Orders.Order = ...;
const business: Domain.Roots.Business = ...;

// Or destructure
const { Product, Category } = Domain.Catalog;
const { Order, OrderSymbols } = Domain.Orders;
const { ProductRepository, OrderRepository } = Persistence;
```

Available domain subnamespaces:

| Namespace | Contents |
|---|---|
| `Domain.Roots` | Aggregate roots: `Business`, `BusinessProps`, `BusinessType`, `Role`, `Catalog`, `CatalogProps`, `OrderSettings`, `OrderSettingsProps`, `SurfacesRoot`, `SurfacesProps`, `LocationsRoot`, `LocationsRootProps`, `ConnectedAccountsRoot`, `ConnectedAccountsProps`, `Services`, `ServicesProps`, `Onboarding`, `OnboardingProps`, `OnboardingStage`, `OnboardingStageStatus`, `LocationMeta` |
| `Domain.Catalog` | `Product`, `ProductProps`, `ProductMeta`, `Category`, `CategoryProps`, `CategoryMeta`, `OptionSet`, `OptionSetProps`, `OptionSetMeta`, `ProductOptionSetSetting`, `Option`, `OptionProps`, `OptionMeta`, `TaxRate`, `TaxRateProps`, `Discount`, `DiscountProps`, `DiscountType`, `ServiceCharge`, `ServiceChargeProps`, `ServiceChargeType`, `InventoryCount`, `InventoryCountState`, `LocationInventoryMap`, `defaultInventoryCount` |
| `Domain.Orders` | `Order`, `OrderProps`, `OrderItem`, `OrderLineItem`, `OrderFulfillment`, `OrderFulfillmentContact`, `OrderPayment`, `OrderPriceAdjustmentMeta`, `OptionSetSelected`, `SelectedValue`, `OrderType`, `OrderTypeMeta`, `OrderState`, `PaymentState` |
| `Domain.Surfaces` | `Menu`, `MenuProps`, `MenuMeta`, `MenuGroup`, `MenuGroupProps`, `MenuGroupMeta`, `SurfaceConfiguration`, `SurfaceConfigurationProps`, `CoverConfiguration`, `CheckoutFlowConfiguration`, `TipConfiguration`, `KioskConfiguration`, `KioskConfigurationProps`, `CheckoutOptions`, `CheckoutOptionsProps`, `CheckoutOptionType`, `TipOptions`, `DiscountOptions`, `GiftCardOptions`, `ReferralCodeOptions`, `ScheduleOptions`, `ContactOptions`, `ManualIdOptions`, `ManualIdConfig`, `OptionConfig`, `FulfillmentOption` |
| `Domain.Locations` | `Location`, `LocationProps`, `LocationMeta` |
| `Domain.ConnectedAccounts` | `Event`, `EventProps`, `Token`, `TokenProps` (abstract) |
| `Domain.Onboarding` | `OnboardingOrder`, `OnboardingOrderProps`, `InvoiceStatus` |
| `Domain.Misc` | `Address`, `emptyAddress`, `BusinessProfile` (value objects) |

Top-level domain exports (no subnamespace required):
- `Domain.DomainEntity`, `Domain.TenantEntity` — base classes
- `Domain.LinkedObjectRef`, `Domain.LinkedObjectMap` — linked object types
- `Domain.MetadataProjection`, `Domain.MetadataSpec`, `Domain.MetaLinkDeclaration` — metadata interfaces
- `Domain.IdGenerator` — ID generation interface

> **Naming note:** Some aggregate root classes are re-exported with a `Root` suffix to avoid collision with their child collection namespaces. The actual class names are: `SurfacesRoot` (not `Surfaces`), `LocationsRoot` (not `Locations`), `ConnectedAccountsRoot` (not `ConnectedAccounts`), and `OrderSettings` (not `Orders`).

Unchanged modules keep their original import style:

```typescript
import { Authentication, Claims, User, Utils, Reports } from '@kiosinc/restaurant-core-claude';
import { Paths, Constants } from '@kiosinc/restaurant-core-claude';
import { EventNotification, SemaphoreV2 } from '@kiosinc/restaurant-core-claude';
```

## 3. Replace Static Data Access with Repositories

The biggest change: models no longer have `get()`, `find()`, `collectionRef()`, or `firestoreConverter`. All data access goes through repository instances.

### Setup (once per application)

```typescript
import { Domain, Persistence } from '@kiosinc/restaurant-core-claude';

const {
  MetadataRegistry,
  LocationMetadataSpec, MenuMetadataSpec, MenuGroupMetadataSpec,
} = Persistence;
const { Location } = Domain.Locations;
const { Menu, MenuGroup } = Domain.Surfaces;

// 1. Create and populate the metadata registry
const metadataRegistry = new MetadataRegistry();
metadataRegistry.register(Location, new LocationMetadataSpec());
metadataRegistry.register(Menu, new MenuMetadataSpec());
metadataRegistry.register(MenuGroup, new MenuGroupMetadataSpec());

// 2. Create repository instances — pass the registry to each
const productRepo = new Persistence.ProductRepository(metadataRegistry);
const categoryRepo = new Persistence.CategoryRepository(metadataRegistry);
const orderRepo = new Persistence.OrderRepository(metadataRegistry);
const businessRepo = new Persistence.BusinessRepository(metadataRegistry);
const menuRepo = new Persistence.MenuRepository(metadataRegistry);
// ... etc. for any repositories your code needs
```

### Complete repository list

**Aggregate root repositories:**

| Repository | Entity |
|---|---|
| `BusinessRepository` | `Business` |
| `CatalogRootRepository` | `Catalog` |
| `SurfacesRootRepository` | `SurfacesRoot` |
| `OrderSettingsRepository` | `OrderSettings` |
| `LocationsRootRepository` | `LocationsRoot` |
| `ConnectedAccountsRootRepository` | `ConnectedAccountsRoot` |
| `ServicesRepository` | `Services` |
| `OnboardingRepository` | `Onboarding` |

**Catalog entity repositories:**

| Repository | Entity |
|---|---|
| `ProductRepository` | `Product` |
| `CategoryRepository` | `Category` |
| `OptionSetRepository` | `OptionSet` |
| `OptionRepository` | `Option` |
| `TaxRateRepository` | `TaxRate` |
| `DiscountRepository` | `Discount` |
| `ServiceChargeRepository` | `ServiceCharge` |

**Surfaces entity repositories:**

| Repository | Entity |
|---|---|
| `MenuRepository` | `Menu` |
| `MenuGroupRepository` | `MenuGroup` |
| `SurfaceConfigurationRepository` | `SurfaceConfiguration` |
| `KioskConfigurationRepository` | `KioskConfiguration` |
| `CheckoutOptionsRepository` | `CheckoutOptions` |

**Other entity repositories:**

| Repository | Entity | Notes |
|---|---|---|
| `LocationRepository` | `Location` | |
| `OrderRepository` | `Order` | |
| `EventRepository` | `Event` | Extra method: `findByProviderAndType(businessId, provider, type)` |
| `TokenRepository` | `Token` | |
| `OnboardingOrderRepository` | `OnboardingOrder` | |

All repositories implement the `Repository<T>` interface:

```typescript
interface Repository<T extends DomainEntity> {
  get(businessId: string, id: string): Promise<T | null>;
  set(entity: T, businessId: string): Promise<void>;
  update(entity: T, businessId: string): Promise<void>;
  delete(businessId: string, id: string): Promise<void>;
  findByLinkedObject(businessId: string, linkedObjectId: string, provider: string): Promise<T | null>;
}
```

### Reading entities

```typescript
// OLD
const snapshot = await Product.collectionRef(businessId)
  .doc(productId)
  .withConverter(Product.firestoreConverter)
  .get();
const product = snapshot.data();

// NEW
const product = await productRepo.get(businessId, productId);
```

### Reading aggregate root documents

Aggregate roots are singleton documents per business. Use the same `get()` pattern, but the document ID is determined by the root's collection path (typically the businessId itself or a fixed key):

```typescript
// OLD
const snapshot = await Surfaces.docRef(businessId)
  .withConverter(Surfaces.firestoreConverter)
  .get();
const surfaces = snapshot.data();

// NEW
const surfacesRepo = new Persistence.SurfacesRootRepository(metadataRegistry);
const surfaces = await surfacesRepo.get(businessId, businessId);
```

### Writing entities

```typescript
// OLD
const ref = Product.collectionRef(businessId).doc(product.Id);
await ref.withConverter(Product.firestoreConverter).set(product);

// NEW
await productRepo.set(product, businessId);    // full write (transactional, includes metadata writes)
await productRepo.update(product, businessId); // lightweight partial update (no metadata)
```

> **`set()` vs `update()` — important behavioral differences:**
>
> - **`set()`** runs inside a Firestore transaction. It writes the entity document *and* automatically writes metadata denormalization to parent documents (via `MetadataRegistry`). Use `set()` when creating entities or when the change should propagate metadata to parent documents (e.g., updating a Location should update `LocationMeta` in the `LocationsRoot`).
> - **`update()`** is a bare `docRef.update()` — no transaction, no metadata writes. Use it for lightweight field updates where metadata propagation is not needed (e.g., toggling a flag that isn't part of any metadata projection).
>
> If you use `update()` on an entity whose fields are included in a `MetadataProjection`, the parent document's denormalized copy will become stale until the next `set()` call.

### Deleting entities

```typescript
// OLD
await Product.collectionRef(businessId).doc(productId).delete();

// NEW
await productRepo.delete(businessId, productId); // also cleans up metadata links
```

### Listing all entities in a collection

The `Repository<T>` interface does not include a `list()` or `getAll()` method. To fetch all entities in a collection, use `PathResolver` to get the collection reference and query Firestore directly:

```typescript
// OLD
const snapshot = await Product.collectionRef(businessId)
  .withConverter(Product.firestoreConverter)
  .get();
const products = snapshot.docs.map(d => d.data());

// NEW — use PathResolver for the collection reference
const { PathResolver } = Persistence;
const snapshot = await PathResolver.productsCollection(businessId).get();
const products = snapshot.docs.map(d => d.data());

// For filtered queries, chain .where() / .orderBy() as before:
const activeProducts = await PathResolver.productsCollection(businessId)
  .where('isActive', '==', true)
  .get();
```

> **Note:** Collection-level reads bypass the repository layer entirely — no `fromFirestore` conversion or `dateify` is applied. You'll receive raw Firestore `DocumentData`. If you need typed domain objects, apply the conversion yourself or add a custom query method to the relevant repository subclass.

### Querying by linked object (Square sync)

```typescript
// OLD
import { LinkedObject } from '@kiosinc/restaurant-core';
const product = await LinkedObject.find(
  squareItemId, 'square', Product.collectionRef(businessId), Product.firestoreConverter
);

// NEW
const product = await productRepo.findByLinkedObject(businessId, squareItemId, 'square');
```

For custom linked-object queries beyond the standard repository method, standalone helpers are also available:

```typescript
const { linkedObjectQuery, findByLinkedObjectId } = Persistence;

// Build a query
const query = linkedObjectQuery(squareItemId, 'square', collectionRef);

// Or find directly
const entity = await findByLinkedObjectId(squareItemId, 'square', collectionRef, converter);
```

### EventRepository: extra query method

`EventRepository` has an additional method not on the base `Repository<T>` interface:

```typescript
const eventRepo = new Persistence.EventRepository(metadataRegistry);
const event = await eventRepo.findByProviderAndType(businessId, 'square', 'catalog');
```

## 4. Replace Collection Path References with PathResolver

```typescript
// OLD — static methods on model classes
const ref = Business.docRef(businessId);
const productsRef = Catalog.docRef(businessId).collection('products');
const ordersRef = Orders.docRef(businessId).collection('orders');

// NEW — centralized PathResolver
import { Persistence } from '@kiosinc/restaurant-core-claude';
const { PathResolver } = Persistence;

const ref = PathResolver.businessDoc(businessId);
const productsRef = PathResolver.productsCollection(businessId);
const ordersRef = PathResolver.ordersCollection(businessId);
```

Complete PathResolver methods:

**Business & environment collections:**

| Old | New |
|-----|-----|
| `Business.collectionRef()` | `PathResolver.businessCollection()` |
| `Business.docRef(id)` | `PathResolver.businessDoc(id)` |
| *(direct sub-collection access)* | `PathResolver.publicCollection(id)` |
| *(direct sub-collection access)* | `PathResolver.privateCollection(id)` |
| *(direct sub-collection access)* | `PathResolver.featurelistCollection(id)` |
| *(direct sub-collection access)* | `PathResolver.sandboxCollection(id)` |

**Aggregate root documents:**

| Old | New |
|-----|-----|
| `Catalog.docRef(id)` | `PathResolver.catalogDoc(id)` |
| `Surfaces.docRef(id)` | `PathResolver.surfacesDoc(id)` |
| `Orders.docRef(id)` | `PathResolver.ordersDoc(id)` |
| `Locations.docRef(id)` | `PathResolver.locationsDoc(id)` |
| `ConnectedAccounts.docRef(id)` | `PathResolver.connectedAccountsDoc(id)` |
| `Services.docRef(id)` | `PathResolver.servicesDoc(id)` |
| `Onboarding.docRef(id)` | `PathResolver.onboardingDoc(id)` |

**Catalog child collections:**

| Old | New |
|-----|-----|
| `Product.collectionRef(id)` | `PathResolver.productsCollection(id)` |
| `Category.collectionRef(id)` | `PathResolver.categoriesCollection(id)` |
| `OptionSet.collectionRef(id)` | `PathResolver.optionSetsCollection(id)` |
| `Option.collectionRef(id)` | `PathResolver.optionsCollection(id)` |
| `TaxRate.collectionRef(id)` | `PathResolver.taxRatesCollection(id)` |
| `Discount.collectionRef(id)` | `PathResolver.discountsCollection(id)` |
| `ServiceCharge.collectionRef(id)` | `PathResolver.serviceChargesCollection(id)` |

**Surfaces child collections:**

| Old | New |
|-----|-----|
| `Menu.collectionRef(id)` | `PathResolver.menusCollection(id)` |
| `MenuGroup.collectionRef(id)` | `PathResolver.menuGroupsCollection(id)` |
| `SurfaceConfiguration.collectionRef(id)` | `PathResolver.surfaceConfigurationsCollection(id)` |
| `KioskConfiguration.collectionRef(id)` | `PathResolver.kioskConfigurationsCollection(id)` |
| `CheckoutOptions.collectionRef(id)` | `PathResolver.checkoutOptionsCollection(id)` |

**Locations, orders, connected-accounts & onboarding child collections:**

| Old | New |
|-----|-----|
| `Location.collectionRef(id)` | `PathResolver.locationsCollection(id)` |
| `Order.collectionRef(id)` | `PathResolver.ordersCollection(id)` |
| `Event.collectionRef(id)` | `PathResolver.eventsCollection(id)` |
| `Token.collectionRef(id)` | `PathResolver.tokensCollection(id)` |
| `OnboardingOrder.collectionRef(id)` | `PathResolver.onboardingOrdersCollection(id)` |

## 5. Update Model Construction

Models now use props interfaces instead of positional constructor parameters.

```typescript
// OLD — positional parameters
const product = new Product(
  'Widget',           // name
  'A fine widget',    // caption
  '',                 // description
  [],                 // imageUrls
  [],                 // imageGsls
  {},                 // optionSets
  {},                 // optionSetsSelection
  0,                  // minPrice
  0,                  // maxPrice
  0,                  // variationCount
  {},                 // locationInventory
  true,               // isActive
  {},                 // linkedObjects
);

// NEW — props interface
const product = new Product({
  name: 'Widget',
  caption: 'A fine widget',
  description: '',
  imageUrls: [],
  imageGsls: [],
  optionSets: {},
  optionSetsSelection: {},
  minPrice: 0,
  maxPrice: 0,
  variationCount: 0,
  locationInventory: {},
  isActive: true,
  linkedObjects: {},
});
```

This applies to **all** entity classes. Each class has a corresponding `*Props` interface exported alongside it (e.g., `ProductProps`, `CategoryProps`, `OrderProps`, `BusinessProps`). All props interfaces extend `DomainEntityProps`, which provides optional `Id`, `created`, `updated`, and `isDeleted` fields.

## 6. Update Metadata Denormalization

The old `metaLinks()` and `metadata()` instance methods on models are now split across two layers:

- **`MetadataProjection<T>`** (domain layer) — entities implement a `metadata()` method returning a denormalized snapshot of their key fields. This is a pure data concern with no persistence logic.
- **`MetadataSpec<TEntity, TMeta>`** (persistence layer) — determines *where* metadata gets written (via `MetaLinkDeclaration`). Registered in a `MetadataRegistry` and invoked automatically by repositories on `set()` and `delete()`.

```typescript
// OLD — embedded in model
class Product extends FirestoreObject {
  metadata(): ProductMeta { return { name: this.name, ... }; }
  metaLinks(businessId: string): Record<string, string> { return { ... }; }
}

// NEW — domain model only declares its metadata shape
class Product extends DomainEntity implements MetadataProjection<ProductMeta> {
  metadata(): ProductMeta { return { name: this.name, ... }; }
  // No metaLinks — that's now in the persistence layer
}

// NEW — separate spec in persistence layer
const metadataRegistry = new MetadataRegistry();
metadataRegistry.register(Location, new LocationMetadataSpec());
metadataRegistry.register(Menu, new MenuMetadataSpec());
metadataRegistry.register(MenuGroup, new MenuGroupMetadataSpec());
// Pass registry to repositories — they handle denormalization automatically on set/delete
```

Three `MetadataSpec` implementations are provided out of the box:

| Spec | Entity | Writes metadata to |
|---|---|---|
| `LocationMetadataSpec` | `Location` | `LocationsRoot.locations` map |
| `MenuMetadataSpec` | `Menu` | `SurfacesRoot.menus` map |
| `MenuGroupMetadataSpec` | `MenuGroup` | `SurfacesRoot.menuGroups` map |

Other entities that implement `MetadataProjection` (Product, Category, Option, OptionSet) have their metadata cascaded through `RelationshipHandler`s instead (see section 7).

> **Important:** If you forget to register a spec, metadata writes are silently skipped — the entity itself will still save correctly, but parent documents won't receive denormalized updates.

## 7. Relationship Handlers (Cascading Updates)

In the legacy library, cascading metadata updates (e.g., updating `ProductMeta` inside a Category when a Product changes) were handled by embedded logic in model classes. These are now handled by `RelationshipHandler` implementations registered in a `RelationshipHandlerRegistry`.

```typescript
import { Persistence } from '@kiosinc/restaurant-core-claude';

const {
  RelationshipHandlerRegistry,
  ProductRelationshipHandler,
  OptionSetRelationshipHandler,
  OptionRelationshipHandler,
} = Persistence;
```

Three handlers are provided:

| Handler | Trigger entity | Cascading effect |
|---|---|---|
| `ProductRelationshipHandler` | `Product` | Updates `ProductMeta` in parent `Category.products` map |
| `OptionSetRelationshipHandler` | `OptionSet` | Updates `OptionSetMeta` in parent `Product.optionSets` map |
| `OptionRelationshipHandler` | `Option` | Updates `OptionMeta` in parent `OptionSet.options` map |

Setup:

```typescript
import { Domain, Persistence } from '@kiosinc/restaurant-core-claude';

const {
  RelationshipHandlerRegistry,
  ProductRelationshipHandler,
  OptionSetRelationshipHandler,
  OptionRelationshipHandler,
} = Persistence;
const { Product } = Domain.Catalog;
const { OptionSet } = Domain.Catalog;
const { Option } = Domain.Catalog;

const relationshipRegistry = new RelationshipHandlerRegistry();
relationshipRegistry.register(Product, new ProductRelationshipHandler());
relationshipRegistry.register(OptionSet, new OptionSetRelationshipHandler());
relationshipRegistry.register(Option, new OptionRelationshipHandler());
```

`FirestoreRepository` accepts a `RelationshipHandlerRegistry` as an optional second constructor parameter. When provided, `set()` and `delete()` automatically invoke the registered handler inside the existing Firestore transaction, before the entity write and metadata writes. This ensures cascading metadata updates happen atomically with the primary entity operation.

Pass the registry to the three catalog repositories that have handlers:

```typescript
const productRepo = new ProductRepository(metadataRegistry, relationshipRegistry);
const optionSetRepo = new OptionSetRepository(metadataRegistry, relationshipRegistry);
const optionRepo = new OptionRepository(metadataRegistry, relationshipRegistry);
```

The other 22 repositories do not need a handler registry — omit the second argument and they continue to work as before.

> **Behavioral note:** Because handlers run inside the same transaction as the entity write and metadata writes, a handler failure (e.g., a queried parent document doesn't exist) will roll back the entire transaction, including the primary entity write. This is intentional — it ensures atomic consistency — but it is a change from the pre-handler behavior where `set()` could only fail on the entity write or metadata denormalization.

## 8. Replace LinkedObject with LinkedObjectRef

```typescript
// OLD — class with mixed data + query logic
import { LinkedObject } from '@kiosinc/restaurant-core';
const linked = new LinkedObject('square-item-123');
product.linkedObjects = { square: linked };

// NEW — pure data interface
import { Domain } from '@kiosinc/restaurant-core-claude';

// LinkedObjectRef is the single-entry type
const linked: Domain.LinkedObjectRef = { linkedObjectId: 'square-item-123' };

// LinkedObjectMap is the provider-keyed map used on entity properties
const linkedObjects: Domain.LinkedObjectMap = { square: linked };
product.linkedObjects = linkedObjects;
```

`LinkedObjectMap` is typed as `{ [provider: string]: LinkedObjectRef }` and is the type used for `linkedObjects` properties on Product, Category, Option, OptionSet, TaxRate, Discount, ServiceCharge, and Location.

## 9. Replace BusinessUtilities.createBusiness

```typescript
// OLD
import { createBusiness } from '@kiosinc/restaurant-core';
const docRef = await createBusiness(user, BusinessType.restaurant, 'device1', 'My Restaurant');
const businessId = docRef.id;

// NEW
import { Persistence } from '@kiosinc/restaurant-core-claude';
const businessId = await Persistence.createBusiness({
  uid: user.token.uid,
  device: 'device1',
  type: BusinessType.restaurant,
  name: 'My Restaurant',  // optional — omit for unnamed businesses
});
```

Key differences:
- Takes a `CreateBusinessInput` object instead of positional args
- Accepts `uid` string directly instead of a `User` object
- `name` is optional
- Returns `string` (businessId) instead of a `DocumentReference`
- Creates all 8 aggregate root documents (Business, Catalog, Surfaces, LocationsRoot, OrderSettings, ConnectedAccounts, Services, Onboarding) in a single transaction

## 10. Update Base Class References

```typescript
// OLD — type guards / instanceof checks
import { FirestoreObject, FirestoreObjectV2 } from '@kiosinc/restaurant-core';
if (entity instanceof FirestoreObjectV2) { ... }

// NEW
import { Domain } from '@kiosinc/restaurant-core-claude';
if (entity instanceof Domain.TenantEntity) { ... }   // has businessId
if (entity instanceof Domain.DomainEntity) { ... }    // base type
```

`FirestoreObject` and `FirestoreObjectV2` no longer exist. Use `DomainEntity` (all entities) or `TenantEntity` (entities scoped to a business) instead.

> **Caveat:** `Order` extends `DomainEntity` (not `TenantEntity`) even though it has a `businessId` property. An `instanceof TenantEntity` check will **not** match Orders. Currently only `Location` extends `TenantEntity` among non-root entities.

## 11. Configure ID Generation (if needed)

The old `FirestoreObject.autoId()` used Firebase's auto-ID. The new default is UUID v4. To restore the Firebase behavior:

```typescript
import { Domain } from '@kiosinc/restaurant-core-claude';
import { getFirestore } from 'firebase-admin/firestore';

Domain.DomainEntity.setIdGenerator({
  generate: () => getFirestore().collection('_').doc().id,
});
```

> **Exception:** `Event` entities auto-generate their ID as `${provider}.${type}` regardless of the configured `IdGenerator`. This matches the legacy behavior where events are identified by their provider+type composite key.

## 12. Entity-Specific Migration Notes

### Token is abstract

`Domain.ConnectedAccounts.Token` is an abstract class and cannot be instantiated directly. Consumers must subclass it for their specific token types (e.g., Square tokens). `TokenRepository` handles persistence but its `fromFirestore` is a stub — you may need to provide a custom implementation if you're reading tokens directly.

### Event composite ID

`Event` IDs are auto-generated as `${provider}.${type}`, not UUID. Use `Event.identifier(provider, type)` to compute the ID when doing lookups:

```typescript
const { Event } = Domain.ConnectedAccounts;
const eventId = Event.identifier('square', 'catalog'); // "square.catalog"
const event = await eventRepo.get(businessId, eventId);
```

### InventoryCount is a plain interface

`Domain.Catalog.InventoryCount` is not a class — it's an interface with a factory function `defaultInventoryCount()`. The related type `LocationInventoryMap` (`{ [locationId: string]: InventoryCount }`) is used on Product, Option, and OptionSet.

### Address and BusinessProfile are value objects

`Domain.Misc.Address` and `Domain.Misc.BusinessProfile` are plain interfaces, not entity classes. Use them directly:

```typescript
const { emptyAddress } = Domain.Misc;
const address: Domain.Misc.Address = { ...emptyAddress, city: 'Austin', state: 'TX' };
```

## Summary of Breaking Changes

| What Changed | Old | New |
|---|---|---|
| Package name | `@kiosinc/restaurant-core` | `@kiosinc/restaurant-core-claude` |
| Registry | npm | Google Artifact Registry |
| Import style | Flat barrel exports | `Domain.*` / `Persistence.*` namespaces |
| Base classes | `FirestoreObject` / `FirestoreObjectV2` | `DomainEntity` / `TenantEntity` |
| Data access | Static methods on models | Repository instances (25 repositories) |
| Converters | `Model.firestoreConverter` | `FirestoreRepositoryConfig` in repository |
| Collection paths | `Model.collectionRef()` / `Model.docRef()` | `PathResolver.*` (30 methods) |
| Metadata: shape | `metadata()` on models | `MetadataProjection<T>` interface (unchanged usage) |
| Metadata: links | `metaLinks()` on models | `MetadataSpec` + `MetadataRegistry` (3 specs) |
| Metadata: cascading | Manual updates in application code | `RelationshipHandler` + `RelationshipHandlerRegistry` (3 handlers, auto-invoked by `FirestoreRepository` — see section 7) |
| Linked objects | `LinkedObject` class | `LinkedObjectRef` / `LinkedObjectMap` interfaces |
| Business creation | `createBusiness(user, type, device, name)` | `createBusiness({ uid, device, type, name? })` |
| Constructors | Positional parameters | Props interfaces (`*Props`) |
| ID generation | Firebase auto-ID | UUID v4 (configurable via `IdGenerator`) |
| Root class names | `Surfaces`, `Locations`, `Orders`, `ConnectedAccounts` | `SurfacesRoot`, `LocationsRoot`, `OrderSettings`, `ConnectedAccountsRoot` |

## Unchanged Modules

These modules have the same API and import paths:
- `Authentication`, `Claims`, `User` (Express auth middleware)
- `Utils` (Cloud Tasks, scheduling, geo)
- `Reports` (daily metrics)
- `Paths`, `Constants` (Firestore collection names/enums)
- `EventNotification`, `SemaphoreV2` (RTDB modules)
