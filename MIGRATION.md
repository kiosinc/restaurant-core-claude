# Migration Guide: restaurant-core to restaurant-core-claude

This guide covers migrating from the legacy `@kiosinc/restaurant-core` (models with embedded persistence) to `@kiosinc/restaurant-core-claude` (domain/persistence separation with plain interfaces and factory functions).

## 1. Update Package Reference

```bash
# .npmrc — point @kiosinc scope at Artifact Registry
@kiosinc:registry=https://us-central1-npm.pkg.dev/<PROJECT_ID>/npm-packages/

# package.json
- "@kiosinc/restaurant-core": "^x.x.x"
+ "@kiosinc/restaurant-core-claude": "^1.0.0"
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
const { Product, createProduct } = Domain.Catalog;
const { Order, createOrder } = Domain.Orders;
const { FirestoreRepository, productConverter } = Persistence;
```

Available domain subnamespaces:

| Namespace | Contents |
|---|---|
| `Domain.Roots` | Aggregate roots: `Business`, `createBusinessRoot`, `BusinessType`, `Role`, `Catalog`, `createCatalog`, `OrderSettings`, `createOrderSettings`, `SurfacesRoot`, `createSurfaces`, `LocationsRoot`, `createLocationsRoot`, `LocationMeta`, `ConnectedAccountsRoot`, `createConnectedAccounts`, `Services`, `createServices`, `Onboarding`, `OnboardingInput`, `createOnboarding`, `OnboardingStage`, `OnboardingStageStatus`, `DEFAULT_ONBOARDING_STATUS` |
| `Domain.Catalog` | `Product`, `ProductInput`, `ProductMeta`, `createProduct`, `productMeta`, `Category`, `CategoryInput`, `CategoryMeta`, `createCategory`, `categoryMeta`, `OptionSet`, `OptionSetInput`, `OptionSetMeta`, `createOptionSet`, `optionSetMeta`, `ProductOptionSetSetting`, `Option`, `OptionInput`, `OptionMeta`, `createOption`, `optionMeta`, `TaxRate`, `TaxRateInput`, `createTaxRate`, `Discount`, `DiscountInput`, `DiscountType`, `createDiscount`, `ServiceCharge`, `ServiceChargeInput`, `ServiceChargeType`, `createServiceCharge`, `InventoryCount`, `InventoryCountState`, `LocationInventoryMap`, `defaultInventoryCount` |
| `Domain.Orders` | `Order`, `OrderInput`, `createOrder`, `OrderItem`, `OrderLineItem`, `OrderFulfillment`, `OrderFulfillmentContact`, `OrderPayment`, `OrderPriceAdjustmentMeta`, `OptionSetSelected`, `SelectedValue`, `OrderType`, `OrderTypeMeta`, `OrderState`, `PaymentState` |
| `Domain.Surfaces` | `Menu`, `MenuInput`, `MenuMeta`, `createMenu`, `menuMeta`, `MenuGroup`, `MenuGroupInput`, `MenuGroupMeta`, `createMenuGroup`, `menuGroupMeta`, `SurfaceConfiguration`, `createSurfaceConfiguration`, `CoverConfiguration`, `CheckoutFlowConfiguration`, `TipConfiguration`, `KioskConfiguration`, `createKioskConfiguration`, `CheckoutOptions`, `createCheckoutOptions`, `CheckoutOptionType`, `TipOptions`, `DiscountOptions`, `GiftCardOptions`, `ReferralCodeOptions`, `ScheduleOptions`, `ContactOptions`, `ManualIdOptions`, `ManualIdConfig`, `OptionConfig`, `FulfillmentOption` |
| `Domain.Locations` | `Location`, `LocationInput`, `LocationMeta`, `createLocation`, `locationMeta` |
| `Domain.ConnectedAccounts` | `Event`, `createEvent`, `eventIdentifier`, `Token`, `createToken` |
| `Domain.Onboarding` | `OnboardingOrder`, `OnboardingOrderInput`, `InvoiceStatus`, `createOnboardingOrder` |
| `Domain.Misc` | `Address`, `emptyAddress`, `BusinessProfile` (value objects) |
| `Domain.Repositories` | Base `Repository<T>` interface + typed aliases for all 25 entities (e.g., `ProductRepository`, `OrderRepository`, `BusinessRepository`). `Repository<T>` is intentionally CRUD-only (get/set/update/delete). For linked-object queries, use `FirestoreRepository<T>.findByLinkedObject()` or the standalone `Persistence.linkedObjectQuery()` / `Persistence.findByLinkedObjectId()` helpers. |
| `Domain.Services` | `CatalogCascadeService`, `FieldUpdate`, `ParentUpdate` |

Top-level domain exports (no subnamespace required):
- `Domain.BaseEntity` — base interface for all entities (`Id`, `created`, `updated`, `isDeleted`)
- `Domain.IdGenerator` — ID generation interface
- `Domain.generateId`, `Domain.setIdGenerator`, `Domain.getIdGenerator` — ID generation functions
- `Domain.baseEntityDefaults` — factory for base entity fields
- `Domain.LinkedObjectRef`, `Domain.LinkedObjectMap` — linked object types
- `Domain.MetadataSpec`, `Domain.MetaLinkDeclaration`, `Domain.createMetadataSpec` — metadata interfaces

> **Naming note:** Some aggregate root interfaces are re-exported with a `Root` suffix to avoid collision with their child collection namespaces: `SurfacesRoot` (not `Surfaces`), `LocationsRoot` (not `Locations`), `ConnectedAccountsRoot` (not `ConnectedAccounts`), and `OrderSettings` (not `Orders`).

Unchanged modules keep their original import style:

```typescript
import { Authentication, Claims, User, Utils, Reports } from '@kiosinc/restaurant-core-claude';
import { Paths, Constants } from '@kiosinc/restaurant-core-claude';
import { EventNotification, SemaphoreV2 } from '@kiosinc/restaurant-core-claude';
```

## 3. Replace Static Data Access with Repositories

The biggest change: models no longer have `get()`, `find()`, `collectionRef()`, or `firestoreConverter`. All data access goes through `FirestoreRepository<T>` instances configured with converter configs.

### Setup (once per application)

```typescript
import { Domain, Persistence } from '@kiosinc/restaurant-core-claude';

const {
  MetadataRegistry, FirestoreRepository,
  locationMetadataSpec, menuMetadataSpec, menuGroupMetadataSpec,
  productConverter, categoryConverter, optionSetConverter, optionConverter,
  orderConverter, businessConverter, menuConverter,
  // ... import any other converters you need
} = Persistence;

// 1. Create and populate the metadata registry (string-keyed)
const metadataRegistry = new MetadataRegistry();
metadataRegistry.register('location', locationMetadataSpec);
metadataRegistry.register('menu', menuMetadataSpec);
metadataRegistry.register('menuGroup', menuGroupMetadataSpec);

// 2. Create and populate the relationship handler registry (string-keyed, see section 7)
const {
  RelationshipHandlerRegistry,
  ProductRelationshipHandler,
  OptionSetRelationshipHandler,
  OptionRelationshipHandler,
} = Persistence;
const { CatalogCascadeService } = Domain.Services;

const cascadeService = new CatalogCascadeService();
const relationshipRegistry = new RelationshipHandlerRegistry();
relationshipRegistry.register('product', new ProductRelationshipHandler(cascadeService));
relationshipRegistry.register('optionSet', new OptionSetRelationshipHandler(cascadeService));
relationshipRegistry.register('option', new OptionRelationshipHandler(cascadeService));

// 3. Create repository instances — pass converter config + metadata registry
const orderRepo = new FirestoreRepository(orderConverter, metadataRegistry);
const businessRepo = new FirestoreRepository(businessConverter, metadataRegistry);
const menuRepo = new FirestoreRepository(menuConverter, metadataRegistry);
// ... etc. for any entity your code needs

// 4. Catalog repos that cascade metadata also need the relationship registry (see section 7)
const productRepo = new FirestoreRepository(productConverter, metadataRegistry, relationshipRegistry);
const categoryRepo = new FirestoreRepository(categoryConverter, metadataRegistry);
const optionSetRepo = new FirestoreRepository(optionSetConverter, metadataRegistry, relationshipRegistry);
const optionRepo = new FirestoreRepository(optionConverter, metadataRegistry, relationshipRegistry);
```

### Complete converter list

Each converter is a `FirestoreRepositoryConfig<T>` object that provides `modelKey`, `collectionRef`, `toFirestore`, and `fromFirestore`. Use them with `new FirestoreRepository(converter, metadataRegistry)`.

**Aggregate root converters:**

| Converter | Entity |
|---|---|
| `businessConverter` | `Business` |
| `catalogConverter` | `Catalog` |
| `surfacesRootConverter` | `SurfacesRoot` |
| `orderSettingsConverter` | `OrderSettings` |
| `locationsRootConverter` | `LocationsRoot` |
| `connectedAccountsConverter` | `ConnectedAccountsRoot` |
| `servicesConverter` | `Services` |
| `onboardingConverter` | `Onboarding` |

**Catalog entity converters:**

| Converter | Entity |
|---|---|
| `productConverter` | `Product` |
| `categoryConverter` | `Category` |
| `optionSetConverter` | `OptionSet` |
| `optionConverter` | `Option` |
| `taxRateConverter` | `TaxRate` |
| `discountConverter` | `Discount` |
| `serviceChargeConverter` | `ServiceCharge` |

**Surfaces entity converters:**

| Converter | Entity |
|---|---|
| `menuConverter` | `Menu` |
| `menuGroupConverter` | `MenuGroup` |
| `surfaceConfigurationConverter` | `SurfaceConfiguration` |
| `kioskConfigurationConverter` | `KioskConfiguration` |
| `checkoutOptionsConverter` | `CheckoutOptions` |

**Other entity converters:**

| Converter | Entity |
|---|---|
| `locationConverter` | `Location` |
| `orderConverter` | `Order` |
| `eventConverter` | `Event` |
| `tokenConverter` | `Token` |
| `onboardingOrderConverter` | `OnboardingOrder` |

All `FirestoreRepository<T>` instances share the same interface:

```typescript
class FirestoreRepository<T extends BaseEntity> implements Repository<T> {
  constructor(
    cfg: FirestoreRepositoryConfig<T>,
    metadataRegistry: MetadataRegistry,
    relationshipHandlerRegistry?: RelationshipHandlerRegistry,
  );

  // Repository<T> interface (CRUD)
  get(businessId: string, id: string): Promise<T | null>;
  set(entity: T, businessId: string): Promise<void>;
  update(entity: T, businessId: string): Promise<void>;
  delete(businessId: string, id: string): Promise<void>;

  // Concrete-only — not part of Repository<T> (only entities with linkedObjects support this)
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

Aggregate roots are singleton documents per business. Use the same `get()` pattern, but the document ID is the root's **fixed collection name** (e.g., `'surfaces'`, `'catalog'`), not the businessId. The `businessId` is only used to resolve the parent collection path.

```typescript
// OLD
const snapshot = await Surfaces.docRef(businessId)
  .withConverter(Surfaces.firestoreConverter)
  .get();
const surfaces = snapshot.data();

// NEW
const surfacesRepo = new FirestoreRepository(surfacesRootConverter, metadataRegistry);
const surfaces = await surfacesRepo.get(businessId, 'surfaces');
```

The fixed document IDs for each aggregate root are:

| Root | Document ID | Firestore path |
|------|-------------|----------------|
| `Business` | `businessId` | `businesses/{businessId}` |
| `Catalog` | `'catalog'` | `businesses/{bid}/public/catalog` |
| `SurfacesRoot` | `'surfaces'` | `businesses/{bid}/public/surfaces` |
| `LocationsRoot` | `'locations'` | `businesses/{bid}/public/locations` |
| `OrderSettings` | `'orders'` | `businesses/{bid}/private/orders` |
| `ConnectedAccountsRoot` | `'connectedAccounts'` | `businesses/{bid}/private/connectedAccounts` |
| `Services` | `'services'` | `businesses/{bid}/private/services` |
| `Onboarding` | `'onboarding'` | `businesses/{bid}/private/onboarding` |

> **Note:** `Business` is the only root where the document ID equals the `businessId`. All other roots use fixed string keys matching `Paths.CollectionNames.*`.

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
> If you use `update()` on an entity whose fields are included in a metadata spec, the parent document's denormalized copy will become stale until the next `set()` call.

### Deleting entities

```typescript
// OLD
await Product.collectionRef(businessId).doc(productId).delete();

// NEW
await productRepo.delete(businessId, productId); // also cleans up metadata links
```

### Listing all entities in a collection

`FirestoreRepository<T>` does not include a `list()` or `getAll()` method. To fetch all entities in a collection, use `PathResolver` to get the collection reference and query Firestore directly:

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

> **Note:** Collection-level reads bypass the repository layer entirely — no `fromFirestore` conversion or `dateify` is applied. You'll receive raw Firestore `DocumentData`. If you need typed domain objects, apply the converter yourself:
> ```typescript
> const snapshot = await PathResolver.productsCollection(businessId).get();
> const products = snapshot.docs.map(doc => productConverter.fromFirestore(doc.data(), doc.id, businessId));
> ```

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

### Event lookup by provider and type

In the legacy library, `EventRepository` had a `findByProviderAndType()` method. Since there are no longer named repository subclasses, use the `eventIdentifier()` function with a standard `get()` call instead:

```typescript
// OLD
const eventRepo = new Persistence.EventRepository(metadataRegistry);
const event = await eventRepo.findByProviderAndType(businessId, 'square', 'catalog');

// NEW
import { Domain, Persistence } from '@kiosinc/restaurant-core-claude';
const { eventIdentifier } = Domain.ConnectedAccounts;

const eventRepo = new Persistence.FirestoreRepository(Persistence.eventConverter, metadataRegistry);
const event = await eventRepo.get(businessId, eventIdentifier('square', 'catalog'));
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

Models are now plain interfaces with factory functions instead of classes with constructors. Each model has a `create*()` function and an `*Input` interface for required construction fields.

```typescript
// OLD — class constructor with positional parameters
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

// NEW — factory function with input interface
import { Domain } from '@kiosinc/restaurant-core-claude';
const { createProduct } = Domain.Catalog;

const product = createProduct({
  name: 'Widget',
  caption: 'A fine widget',
  minPrice: 0,
  maxPrice: 0,
  variationCount: 0,
  isActive: true,
});
```

Factory functions accept `*Input & Partial<BaseEntity>`. Optional fields have sensible defaults (empty strings, empty arrays/objects, `null`). Base entity fields (`Id`, `created`, `updated`, `isDeleted`) are auto-generated if not provided.

Complete factory function list:

| Old | New | Input Type |
|---|---|---|
| `new Product(...)` | `createProduct(input)` | `ProductInput & Partial<BaseEntity>` |
| `new Category(...)` | `createCategory(input)` | `CategoryInput & Partial<BaseEntity>` |
| `new OptionSet(...)` | `createOptionSet(input)` | `OptionSetInput & Partial<BaseEntity>` |
| `new Option(...)` | `createOption(input)` | `OptionInput & Partial<BaseEntity>` |
| `new TaxRate(...)` | `createTaxRate(input)` | `TaxRateInput & Partial<BaseEntity>` |
| `new Discount(...)` | `createDiscount(input)` | `DiscountInput & Partial<BaseEntity>` |
| `new ServiceCharge(...)` | `createServiceCharge(input)` | `ServiceChargeInput & Partial<BaseEntity>` |
| `new Order(...)` | `createOrder(input)` | `OrderInput & Partial<BaseEntity>` |
| `new Location(...)` | `createLocation(input)` | `LocationInput & Partial<BaseEntity>` |
| `new Menu(...)` | `createMenu(input)` | `MenuInput & Partial<BaseEntity>` |
| `new MenuGroup(...)` | `createMenuGroup(input)` | `MenuGroupInput & Partial<BaseEntity>` |
| `new SurfaceConfiguration(...)` | `createSurfaceConfiguration(input)` | `SurfaceConfigurationInput & Partial<BaseEntity>` |
| `new KioskConfiguration(...)` | `createKioskConfiguration(input)` | `Partial<KioskConfiguration>` |
| `new CheckoutOptions(...)` | `createCheckoutOptions(input)` | `CheckoutOptionsInput & Partial<BaseEntity>` |
| `new Event(...)` | `createEvent(input)` | `Partial<Event> & { provider, type, isSync }` |
| `new Token(...)` | `createToken(input)` | `Partial<Token> & { createdBy, businessId, provider }` |
| `new OnboardingOrder(...)` | `createOnboardingOrder(input)` | `OnboardingOrderInput & Partial<BaseEntity>` |
| `new Business(...)` | `createBusinessRoot(input)` | `Partial<Business>` |
| `new Catalog(...)` | `createCatalog(input)` | `Partial<Catalog>` |
| `new Surfaces(...)` | `createSurfaces(input)` | `Partial<SurfacesRoot>` |
| `new OrderSettings(...)` | `createOrderSettings(input)` | `OrderSettingsInput & Partial<BaseEntity>` |
| `new Locations(...)` | `createLocationsRoot(input)` | `Partial<LocationsRoot>` |
| `new ConnectedAccounts(...)` | `createConnectedAccounts(input)` | `Partial<ConnectedAccountsRoot>` |
| `new Services(...)` | `createServices(input)` | `Partial<Services>` |
| `new Onboarding(...)` | `createOnboarding(input)` | `OnboardingInput & Partial<BaseEntity>` |

## 6. Update Metadata Denormalization

The old `metaLinks()` and `metadata()` instance methods on models are now split into standalone functions and a persistence-layer spec:

- **Standalone `*Meta()` functions** (domain layer) — pure functions that extract a denormalized snapshot from an entity. No persistence logic.
- **`MetadataSpec<TEntity, TMeta>`** (persistence layer) — determines *where* metadata gets written (via `MetaLinkDeclaration`). Registered in a `MetadataRegistry` and invoked automatically by `FirestoreRepository` on `set()` and `delete()`.

```typescript
// OLD — embedded in model class
class Product extends FirestoreObject {
  metadata(): ProductMeta { return { name: this.name, ... }; }
  metaLinks(businessId: string): Record<string, string> { return { ... }; }
}

// NEW — standalone function in domain layer
import { Domain } from '@kiosinc/restaurant-core-claude';
const { productMeta } = Domain.Catalog;
const meta = productMeta(product);  // returns ProductMeta

// NEW — metadata spec in persistence layer (string-keyed registry)
const metadataRegistry = new MetadataRegistry();
metadataRegistry.register('location', locationMetadataSpec);
metadataRegistry.register('menu', menuMetadataSpec);
metadataRegistry.register('menuGroup', menuGroupMetadataSpec);
// Pass registry to repositories — they handle denormalization automatically on set/delete
```

Available standalone metadata functions:

| Old | New | Returns |
|---|---|---|
| `product.metadata()` | `productMeta(product)` | `ProductMeta` |
| `category.metadata()` | `categoryMeta(category)` | `CategoryMeta` |
| `optionSet.metadata()` | `optionSetMeta(optionSet)` | `OptionSetMeta` |
| `option.metadata()` | `optionMeta(option)` | `OptionMeta` |
| `location.metadata()` | `locationMeta(location)` | `LocationMeta` |
| `menu.metadata()` | `menuMeta(menu)` | `MenuMeta` |
| `menuGroup.metadata()` | `menuGroupMeta(menuGroup)` | `MenuGroupMeta` |

Three `MetadataSpec` instances are provided out of the box:

| Spec | Model key | Entity | Writes metadata to |
|---|---|---|---|
| `locationMetadataSpec` | `'location'` | `Location` | `LocationsRoot.locations` map |
| `menuMetadataSpec` | `'menu'` | `Menu` | `SurfacesRoot.menus` map |
| `menuGroupMetadataSpec` | `'menuGroup'` | `MenuGroup` | `SurfacesRoot.menuGroups` map |

Other entities with metadata (Product, Category, Option, OptionSet) have their metadata cascaded through `RelationshipHandler`s instead (see section 7).

> **Important:** If you forget to register a spec, metadata writes are silently skipped — the entity itself will still save correctly, but parent documents won't receive denormalized updates.

## 7. Relationship Handlers (Cascading Updates)

In the legacy library, cascading metadata updates (e.g., updating `ProductMeta` inside a Category when a Product changes) were handled by embedded logic in model classes. These are now handled by `RelationshipHandler` implementations registered in a `RelationshipHandlerRegistry`, with business logic delegated to `CatalogCascadeService`.

```typescript
import { Domain, Persistence } from '@kiosinc/restaurant-core-claude';

const {
  RelationshipHandlerRegistry,
  ProductRelationshipHandler,
  OptionSetRelationshipHandler,
  OptionRelationshipHandler,
} = Persistence;
const { CatalogCascadeService } = Domain.Services;
```

Three handlers are provided:

| Handler | Trigger entity | Cascading effect |
|---|---|---|
| `ProductRelationshipHandler` | `Product` | Updates `ProductMeta` in parent `Category.products` map |
| `OptionSetRelationshipHandler` | `OptionSet` | Updates `OptionSetMeta` in parent `Product.optionSets` map |
| `OptionRelationshipHandler` | `Option` | Updates `OptionMeta` in parent `OptionSet.options` map |

Setup (string-keyed registration — keys must match the converter's `modelKey`):

```typescript
import { Domain, Persistence } from '@kiosinc/restaurant-core-claude';

const {
  RelationshipHandlerRegistry,
  ProductRelationshipHandler,
  OptionSetRelationshipHandler,
  OptionRelationshipHandler,
} = Persistence;
const { CatalogCascadeService } = Domain.Services;

const cascadeService = new CatalogCascadeService();
const relationshipRegistry = new RelationshipHandlerRegistry();
relationshipRegistry.register('product', new ProductRelationshipHandler(cascadeService));
relationshipRegistry.register('optionSet', new OptionSetRelationshipHandler(cascadeService));
relationshipRegistry.register('option', new OptionRelationshipHandler(cascadeService));
```

`FirestoreRepository` accepts a `RelationshipHandlerRegistry` as an optional third constructor parameter. When provided, `set()` and `delete()` automatically invoke the registered handler inside the existing Firestore transaction, before the entity write and metadata writes. This ensures cascading metadata updates happen atomically with the primary entity operation.

Pass the registry to the three catalog repositories that have handlers:

```typescript
const productRepo = new FirestoreRepository(productConverter, metadataRegistry, relationshipRegistry);
const optionSetRepo = new FirestoreRepository(optionSetConverter, metadataRegistry, relationshipRegistry);
const optionRepo = new FirestoreRepository(optionConverter, metadataRegistry, relationshipRegistry);
```

The other 22 converters do not need a handler registry — omit the third argument and they continue to work as before.

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

### LinkedObjectSync is removed

The legacy `LinkedObjectSync` export (an alias for `LinkedObjectUtilities`) has been removed. Its query/sync utility functions are replaced by:

- **`repo.findByLinkedObject()`** — the standard way to look up an entity by linked object ID (see section 3, "Querying by linked object")
- **`Persistence.linkedObjectQuery()` / `Persistence.findByLinkedObjectId()`** — standalone helpers for custom queries beyond the repository method

```typescript
// OLD
import { LinkedObjectSync } from '@kiosinc/restaurant-core';

// NEW — use the repository method
const product = await productRepo.findByLinkedObject(businessId, squareItemId, 'square');

// NEW — or standalone helpers for custom queries
const { linkedObjectQuery, findByLinkedObjectId } = Persistence;
```

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

## 10. Update Base Type References

All entity models are now plain interfaces extending `BaseEntity`, not classes. `instanceof` checks are no longer possible.

```typescript
// OLD — class-based type guards
import { FirestoreObject, FirestoreObjectV2 } from '@kiosinc/restaurant-core';
if (entity instanceof FirestoreObjectV2) { ... }

// NEW — use structural type checking or discriminant properties
import { Domain } from '@kiosinc/restaurant-core-claude';

// Check if something has the BaseEntity shape
function isBaseEntity(obj: unknown): obj is Domain.BaseEntity {
  return typeof obj === 'object' && obj !== null && 'Id' in obj && 'created' in obj;
}

// Check if an entity has a businessId (replaces instanceof TenantEntity)
function hasBusiness(entity: Domain.BaseEntity): entity is Domain.BaseEntity & { businessId: string } {
  return 'businessId' in entity;
}
```

`BaseEntity` provides four fields on all entities:
- `Id: string` — unique identifier
- `created: Date` — creation timestamp
- `updated: Date` — last update timestamp
- `isDeleted: boolean` — soft-delete flag

> **Note:** `DomainEntity`, `TenantEntity`, and `DomainEntityProps` no longer exist. Use `BaseEntity` and structural checks instead.

## 11. Configure ID Generation (if needed)

The old `FirestoreObject.autoId()` used Firebase's auto-ID. The new default is UUID v4. To restore the Firebase behavior:

```typescript
import { Domain } from '@kiosinc/restaurant-core-claude';
import { getFirestore } from 'firebase-admin/firestore';

Domain.setIdGenerator({
  generate: () => getFirestore().collection('_').doc().id,
});
```

> **Exception:** `Event` entities auto-generate their ID as `${provider}.${type}` regardless of the configured `IdGenerator`. This matches the legacy behavior where events are identified by their provider+type composite key.

## 12. Entity-Specific Migration Notes

### Token is a plain interface

`Domain.ConnectedAccounts.Token` is a plain interface (not an abstract class). Create tokens with `createToken({ createdBy, businessId, provider })`. The `tokenConverter`'s `fromFirestore` is a stub — you may need to provide a custom converter if you're reading tokens directly from Firestore.

### Event composite ID

`Event` IDs are auto-generated as `${provider}.${type}`, not UUID. Use the standalone `eventIdentifier()` function to compute the ID when doing lookups:

```typescript
import { Domain } from '@kiosinc/restaurant-core-claude';
const { eventIdentifier } = Domain.ConnectedAccounts;

const eventId = eventIdentifier('square', 'catalog'); // "square.catalog"
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
| Package version | `0.x` | `1.0.0` |
| Registry | npm | Google Artifact Registry |
| Import style | Flat barrel exports | `Domain.*` / `Persistence.*` namespaces |
| Base types | `FirestoreObject` / `FirestoreObjectV2` classes | `BaseEntity` interface |
| Entity models | Classes with constructors | Interfaces with `create*()` factory functions |
| Construction input | `*Props` interfaces | `*Input` interfaces (or `Partial<Model>`) |
| Data access | Static methods on models | `FirestoreRepository<T>` + converter configs (25 converters) |
| Repository pattern | 25 named repository subclasses | `Domain.Repositories.Repository<T>` interface + `FirestoreRepository<T>` implementation |
| Converters | `Model.firestoreConverter` | Exported `*Converter` config objects |
| Collection paths | `Model.collectionRef()` / `Model.docRef()` | `PathResolver.*` (30 methods) |
| Metadata: shape | `entity.metadata()` instance method | Standalone `*Meta()` functions |
| Metadata: links | `metaLinks()` on models | `MetadataSpec` + `MetadataRegistry` (3 specs) |
| Metadata: cascading | Manual updates in application code | `RelationshipHandler` + `RelationshipHandlerRegistry` (3 handlers) |
| Registry keys | Class constructor keys | String keys (e.g., `'product'`, `'location'`) |
| Linked objects | `LinkedObject` class | `LinkedObjectRef` / `LinkedObjectMap` interfaces |
| Linked object queries | `LinkedObjectSync` utilities | `repo.findByLinkedObject()` / `Persistence.linkedObjectQuery()` |
| Business creation | `createBusiness(user, type, device, name)` | `createBusiness({ uid, device, type, name? })` |
| ID generation | Firebase auto-ID, `DomainEntity.setIdGenerator()` | UUID v4 default, module-level `setIdGenerator()` |
| Type guards | `instanceof DomainEntity` / `instanceof TenantEntity` | Structural checks (`'Id' in obj`, `'businessId' in entity`) |
| Root type names | `Surfaces`, `Locations`, `Orders`, `ConnectedAccounts` | `SurfacesRoot`, `LocationsRoot`, `OrderSettings`, `ConnectedAccountsRoot` |

## Removed Exports

These types/classes no longer exist:

| Removed | Replacement |
|---|---|
| `DomainEntity` (class) | `BaseEntity` (interface) |
| `DomainEntityProps` | `Partial<BaseEntity>` |
| `TenantEntity` (class) | `businessId` field directly on model interface |
| `TenantEntityProps` | N/A |
| `MetadataProjection<T>` | Standalone `*Meta()` functions |
| `IdGenerator` (class with static methods) | `IdGenerator` (interface) + `generateId()`, `setIdGenerator()`, `getIdGenerator()` module functions |
| All `*Props` interfaces | `*Input` interfaces |
| All 25 `*Repository` classes | `FirestoreRepository<T>` + `*Converter` configs |
| `Repository` abstract interface | `Domain.Repositories.Repository<T>` (domain-layer interface, implemented by `FirestoreRepository<T>`) |

## Unchanged Modules

These modules have the same API and import paths:
- `Authentication`, `Claims`, `User` (Express auth middleware)
- `Utils` (Cloud Tasks, scheduling, geo)
- `Reports` (daily metrics)
- `Paths`, `Constants` (Firestore collection names/enums)
- `EventNotification`, `SemaphoreV2` (RTDB modules)
