# Phase 3 (Migrate Catalog Models) — Detailed Spec

## Overview

Phase 3 migrates all catalog models from `FirestoreObject` (V1) to the new `DomainEntity` base class with separated persistence. This is the most complex phase — it involves 7 domain models, 4 metadata types, a shared value type, cross-entity relationship handlers (replacing `instanceof` chains in `FirestoreWriter`), and 7 repository implementations.

**Migration order:** Bottom-up by dependency: **InventoryCount → Option → OptionSet → Product → Category → TaxRate → Discount → ServiceCharge**

Option/OptionSet/Product/Category must be migrated in dependency order because of cross-entity metadata denormalization. TaxRate, Discount, and ServiceCharge are standalone — no cross-references.

**Scope:** 20+ new files, 7 deprecated classes, 0 existing code broken.

**Prerequisite:** Phases 0–2 complete (DomainEntity, TenantEntity, Repository, FirestoreRepository, MetadataRegistry, LinkedObjectRef, Location all exist and tested).

---

## Current State

### What exists today

| File | Responsibility |
|------|---------------|
| `src/restaurant/catalog/Product.ts` | V1 class — 14 fields, `metadata()` → `ProductMeta`, `metaLinks()` → `{}` |
| `src/restaurant/catalog/Category.ts` | V1 class — 7 fields, `metadata()` → `CategoryMeta`, `metaLinks()` → `{}` |
| `src/restaurant/catalog/Option.ts` | V1 class — 13 fields, `metadata()` → `OptionMeta`, `metaLinks()` → `{}` |
| `src/restaurant/catalog/OptionSet.ts` | V1 class — 14 fields, `metadata()` → `OptionSetMeta`, `metaLinks()` → `{}` |
| `src/restaurant/catalog/TaxRate.ts` | V1 class — 4 fields, `metadata()` → `{}`, `metaLinks()` → `{}` |
| `src/restaurant/catalog/Discount.ts` | V1 class — 7 fields, `metadata()` → `{}`, `metaLinks()` → `{}` |
| `src/restaurant/catalog/ServiceCharge.ts` | V1 class — 5 fields, `metadata()` → `{}`, `metaLinks()` → `{}` |
| `src/restaurant/catalog/InventoryCount.ts` | Value type + Firestore helpers |
| `src/restaurant/catalog/ProductMeta.ts` | Interface for Product metadata projection |
| `src/restaurant/catalog/CategoryMeta.ts` | Interface for Category metadata projection |
| `src/restaurant/catalog/OptionMeta.ts` | Interface for Option metadata projection |
| `src/restaurant/catalog/OptionSetMeta.ts` | Interface for OptionSet metadata projection |
| `src/restaurant/roots/Catalog.ts` | Root aggregate — `docRef(businessId)` for collection paths |
| `src/firestore-core/core/FirestoreWriter.ts` | `instanceof` chains for cross-entity updates on set/delete |
| `src/firestore-core/core/LinkedObject.ts` | Deprecated — replaced by `LinkedObjectRef` |

### Cross-Entity Relationships (FirestoreWriter)

These `instanceof` chains in `FirestoreWriter.setT()` and `deleteT()` must be replaced with `RelationshipHandler` implementations:

| Trigger | Action on Set | Action on Delete |
|---------|--------------|-----------------|
| Option saved | Update `options.{id}` in all OptionSets containing it | Remove from OptionSet `options`, `optionDisplayOrder`, `preselectedOptionIds` |
| OptionSet saved | Update `optionSets.{id}` in all Products containing it | Remove from Product `optionSets`, `optionSetsSelection` |
| Product saved | Update `products.{id}` in all Categories containing it | Remove from Category `products`, `productDisplayOrder` |
| Category deleted | Stub only — no cleanup logic | (none) |

### Known Bugs in Current Code

1. **ServiceCharge `collectionRef()`** returns `'taxRates'` instead of `'serviceCharges'`
2. **ServiceCharge `toFirestore()`** serializes as `rate` but constructor field is `value`
3. **OptionSetSelection `isActive`** conflates "enabled on item" with presence — noted as TODO to delete

---

## 1. Implementation Spec

### 1.1 `src/domain/catalog/InventoryCount.ts` — Shared value type

Pure data type. No class, no Firestore helpers. The Firestore serialization helpers move to the persistence layer.

```typescript
/**
 * Stock state for a product/option at a location.
 */
export enum InventoryCountState {
  inStock = 'inStock',
  soldOut = 'soldOut',
}

/**
 * Inventory tracking for a single location.
 */
export interface InventoryCount {
  timestamp?: Date;
  count: number;
  state: InventoryCountState;
  isAvailable: boolean;
}

/**
 * Map of locationId to inventory data.
 * Used by Product, Option, and OptionSet.
 */
export type LocationInventoryMap = { [locationId: string]: InventoryCount };

/**
 * Returns a default InventoryCount (available, unlimited stock).
 */
export function defaultInventoryCount(): InventoryCount {
  return { count: -1, state: InventoryCountState.inStock, isAvailable: true };
}
```

**Key decisions:**
- **Enum values use camelCase** (`inStock`, `soldOut`) — fixes old `instock`/`soldout` inconsistency. Firestore converter handles mapping old values.
- **`defaultInventoryCount()` helper** replaces inline defaults scattered across `fromFirestore` calls.
- **`LocationInventoryMap` convenience type** — same pattern as `LinkedObjectMap`.

---

### 1.2 Meta Interfaces — `src/domain/catalog/`

Pure interfaces. Identical shapes to the old `*Meta.ts` files — no changes needed except moving to the domain layer.

**`src/domain/catalog/ProductMeta.ts`:**
```typescript
export interface ProductMeta {
  name: string;
  isActive: boolean;
  imageUrls: string[];
  imageGsls: string[];
  minPrice: number;
  maxPrice: number;
  variationCount: number;
}
```

**`src/domain/catalog/CategoryMeta.ts`:**
```typescript
export interface CategoryMeta {
  name: string;
}
```

**`src/domain/catalog/OptionMeta.ts`:**
```typescript
export interface OptionMeta {
  name: string;
  isActive: boolean;
}
```

**`src/domain/catalog/OptionSetMeta.ts`:**
```typescript
export interface OptionSetMeta {
  name: string;
  displayOrder: number;
  displayTier: number;
}
```

**Key decisions:**
- **`imageUrls` typed as `string[]`** not `URL[]` — the old code uses `URL` but stores plain strings. `string[]` is the actual runtime type.
- **Interfaces, not classes.** These are pure data projections — no methods, no state.

---

### 1.3 `src/domain/catalog/Option.ts` — Domain model

```typescript
import { DomainEntity, DomainEntityProps } from '../DomainEntity';
import { MetadataProjection } from '../MetadataSpec';
import { LinkedObjectMap } from '../LinkedObjectRef';
import { OptionMeta } from './OptionMeta';
import { InventoryCount, LocationInventoryMap } from './InventoryCount';

export interface OptionProps extends DomainEntityProps {
  name: string;
  price: number;
  sku: string | null;
  gtin: string | null;
  imageUrls: string[];
  imageGsls: string[];
  locationPrices: { [locationId: string]: number };
  locationInventory: LocationInventoryMap;
  isActive: boolean;
  linkedObjects: LinkedObjectMap;
}

export class Option extends DomainEntity implements MetadataProjection<OptionMeta> {
  name: string;
  price: number;
  sku: string | null;
  gtin: string | null;
  imageUrls: string[];
  imageGsls: string[];
  locationPrices: { [locationId: string]: number };
  locationInventory: LocationInventoryMap;
  isActive: boolean;
  linkedObjects: LinkedObjectMap;

  constructor(props: OptionProps) {
    super(props);
    this.name = props.name;
    this.price = props.price;
    this.sku = props.sku ?? null;
    this.gtin = props.gtin ?? null;
    this.imageUrls = props.imageUrls ?? [];
    this.imageGsls = props.imageGsls ?? [];
    this.locationPrices = props.locationPrices ?? {};
    this.locationInventory = props.locationInventory ?? {};
    this.isActive = props.isActive;
    this.linkedObjects = props.linkedObjects ?? {};
  }

  metadata(): OptionMeta {
    return {
      name: this.name,
      isActive: this.isActive,
    };
  }
}
```

**Migration mapping:**

| Old (`FirestoreObject`) | New (`DomainEntity`) |
|---|---|
| Positional constructor (14 params) | Props object (`OptionProps`) |
| `linkedObjects: { [id: string]: LinkedObject }` | `linkedObjects: LinkedObjectMap` |
| `collectionRef(businessId)` | Removed — moves to `OptionRepository` |
| `metaLinks()` → `{}` | Removed — no metadata denormalization |
| `metadata()` → `OptionMeta` | Stays on domain class (`MetadataProjection<OptionMeta>`) |
| `static collectionRef/firestoreConverter` | Moves to `OptionRepository` |
| `locationInventory: { [id: string]: InventoryCount }` | `locationInventory: LocationInventoryMap` |

**Key decisions:**
- **`Option` extends `DomainEntity`, not `TenantEntity`.** Like Event/Order, the old Option has no `businessId` field — it's accessed via `Catalog.docRef(businessId)` path parameter.
- **All catalog models extend `DomainEntity`** for the same reason — `businessId` is a path parameter, not a stored field.

---

### 1.4 `src/domain/catalog/OptionSet.ts` — Domain model

```typescript
import { DomainEntity, DomainEntityProps } from '../DomainEntity';
import { MetadataProjection } from '../MetadataSpec';
import { LinkedObjectMap } from '../LinkedObjectRef';
import { OptionSetMeta } from './OptionSetMeta';
import { OptionMeta } from './OptionMeta';
import { LocationInventoryMap } from './InventoryCount';

export interface ProductOptionSetSetting {
  minSelection: number;
  maxSelection: number;
  preSelected: string[];
  isActive: boolean;
}

export interface OptionSetProps extends DomainEntityProps {
  name: string;
  options: { [id: string]: OptionMeta };
  minSelection: number;
  maxSelection: number;
  displayOrder: number;
  displayTier: number;
  optionDisplayOrder: string[];
  preselectedOptionIds: string[];
  imageUrls: string[];
  imageGsls: string[];
  locationInventory: LocationInventoryMap;
  isActive: boolean;
  linkedObjects: LinkedObjectMap;
}

export class OptionSet extends DomainEntity implements MetadataProjection<OptionSetMeta> {
  name: string;
  options: { [id: string]: OptionMeta };
  minSelection: number;
  maxSelection: number;
  displayOrder: number;
  displayTier: number;
  optionDisplayOrder: string[];
  preselectedOptionIds: string[];
  imageUrls: string[];
  imageGsls: string[];
  locationInventory: LocationInventoryMap;
  isActive: boolean;
  linkedObjects: LinkedObjectMap;

  constructor(props: OptionSetProps) {
    super(props);
    this.name = props.name;
    this.options = props.options ?? {};
    this.minSelection = props.minSelection;
    this.maxSelection = props.maxSelection;
    this.displayOrder = props.displayOrder;
    this.displayTier = props.displayTier;
    this.optionDisplayOrder = props.optionDisplayOrder ?? [];
    this.preselectedOptionIds = props.preselectedOptionIds ?? [];
    this.imageUrls = props.imageUrls ?? [];
    this.imageGsls = props.imageGsls ?? [];
    this.locationInventory = props.locationInventory ?? {};
    this.isActive = props.isActive;
    this.linkedObjects = props.linkedObjects ?? {};
  }

  metadata(): OptionSetMeta {
    return {
      name: this.name,
      displayOrder: this.displayOrder,
      displayTier: this.displayTier,
    };
  }
}
```

**Key decisions:**
- **`ProductOptionSetSetting` stays with OptionSet** — it describes how an OptionSet is configured on a Product. It's an OptionSet-domain concern.
- **`options` map stores `OptionMeta`** — denormalized metadata from Option entities.

---

### 1.5 `src/domain/catalog/Product.ts` — Domain model

```typescript
import { DomainEntity, DomainEntityProps } from '../DomainEntity';
import { MetadataProjection } from '../MetadataSpec';
import { LinkedObjectMap } from '../LinkedObjectRef';
import { ProductMeta } from './ProductMeta';
import { OptionSetMeta } from './OptionSetMeta';
import { ProductOptionSetSetting } from './OptionSet';
import { LocationInventoryMap } from './InventoryCount';

export interface ProductProps extends DomainEntityProps {
  name: string;
  caption: string;
  description: string;
  imageUrls: string[];
  imageGsls: string[];
  optionSets: { [id: string]: OptionSetMeta };
  optionSetsSelection: { [id: string]: ProductOptionSetSetting };
  minPrice: number;
  maxPrice: number;
  variationCount: number;
  locationInventory: LocationInventoryMap;
  isActive: boolean;
  linkedObjects: LinkedObjectMap;
}

export class Product extends DomainEntity implements MetadataProjection<ProductMeta> {
  name: string;
  caption: string;
  description: string;
  imageUrls: string[];
  imageGsls: string[];
  optionSets: { [id: string]: OptionSetMeta };
  optionSetsSelection: { [id: string]: ProductOptionSetSetting };
  minPrice: number;
  maxPrice: number;
  variationCount: number;
  locationInventory: LocationInventoryMap;
  isActive: boolean;
  linkedObjects: LinkedObjectMap;

  constructor(props: ProductProps) {
    super(props);
    this.name = props.name;
    this.caption = props.caption ?? '';
    this.description = props.description ?? '';
    this.imageUrls = props.imageUrls ?? [];
    this.imageGsls = props.imageGsls ?? [];
    this.optionSets = props.optionSets ?? {};
    this.optionSetsSelection = props.optionSetsSelection ?? {};
    this.minPrice = props.minPrice;
    this.maxPrice = props.maxPrice;
    this.variationCount = props.variationCount;
    this.locationInventory = props.locationInventory ?? {};
    this.isActive = props.isActive;
    this.linkedObjects = props.linkedObjects ?? {};
  }

  metadata(): ProductMeta {
    return {
      name: this.name,
      isActive: this.isActive,
      imageUrls: this.imageUrls,
      imageGsls: this.imageGsls,
      minPrice: this.minPrice,
      maxPrice: this.maxPrice,
      variationCount: this.variationCount,
    };
  }
}
```

---

### 1.6 `src/domain/catalog/Category.ts` — Domain model

```typescript
import { DomainEntity, DomainEntityProps } from '../DomainEntity';
import { MetadataProjection } from '../MetadataSpec';
import { LinkedObjectMap } from '../LinkedObjectRef';
import { CategoryMeta } from './CategoryMeta';
import { ProductMeta } from './ProductMeta';

export interface CategoryProps extends DomainEntityProps {
  name: string;
  products: { [id: string]: ProductMeta };
  productDisplayOrder: string[];
  imageUrls: string[];
  imageGsls: string[];
  linkedObjects: LinkedObjectMap;
}

export class Category extends DomainEntity implements MetadataProjection<CategoryMeta> {
  name: string;
  products: { [id: string]: ProductMeta };
  productDisplayOrder: string[];
  imageUrls: string[];
  imageGsls: string[];
  linkedObjects: LinkedObjectMap;

  constructor(props: CategoryProps) {
    super(props);
    this.name = props.name;
    this.products = props.products ?? {};
    this.productDisplayOrder = props.productDisplayOrder ?? [];
    this.imageUrls = props.imageUrls ?? [];
    this.imageGsls = props.imageGsls ?? [];
    this.linkedObjects = props.linkedObjects ?? {};
  }

  metadata(): CategoryMeta {
    return {
      name: this.name,
    };
  }
}
```

---

### 1.7 `src/domain/catalog/TaxRate.ts` — Domain model

```typescript
import { DomainEntity, DomainEntityProps } from '../DomainEntity';
import { LinkedObjectMap } from '../LinkedObjectRef';

export interface TaxRateProps extends DomainEntityProps {
  name: string;
  rate: number;
  isCalculatedSubTotalPhase: boolean;
  isInclusive: boolean;
  linkedObjects: LinkedObjectMap;
}

export class TaxRate extends DomainEntity {
  name: string;
  rate: number;
  isCalculatedSubTotalPhase: boolean;
  isInclusive: boolean;
  linkedObjects: LinkedObjectMap;

  constructor(props: TaxRateProps) {
    super(props);
    this.name = props.name;
    this.rate = props.rate;
    this.isCalculatedSubTotalPhase = props.isCalculatedSubTotalPhase;
    this.isInclusive = props.isInclusive;
    this.linkedObjects = props.linkedObjects ?? {};
  }
}
```

**Key decision:** No `MetadataProjection` — TaxRate's `metadata()` returns `{}`. No metadata to project.

---

### 1.8 `src/domain/catalog/Discount.ts` — Domain model

```typescript
import { DomainEntity, DomainEntityProps } from '../DomainEntity';
import { LinkedObjectMap } from '../LinkedObjectRef';

export enum DiscountType {
  percentage = 'percentage',
  amount = 'amount',
  unknown = 'unknown',
}

export interface DiscountProps extends DomainEntityProps {
  name: string;
  description: string;
  couponCode: string;
  type: DiscountType;
  value: number;
  isActive: boolean;
  linkedObjects: LinkedObjectMap;
}

export class Discount extends DomainEntity {
  name: string;
  description: string;
  couponCode: string;
  type: DiscountType;
  value: number;
  isActive: boolean;
  linkedObjects: LinkedObjectMap;

  constructor(props: DiscountProps) {
    super(props);
    this.name = props.name;
    this.description = props.description ?? '';
    this.couponCode = props.couponCode ?? '';
    this.type = props.type;
    this.value = props.value;
    this.isActive = props.isActive;
    this.linkedObjects = props.linkedObjects ?? {};
  }
}
```

---

### 1.9 `src/domain/catalog/ServiceCharge.ts` — Domain model

```typescript
import { DomainEntity, DomainEntityProps } from '../DomainEntity';
import { LinkedObjectMap } from '../LinkedObjectRef';

export enum ServiceChargeType {
  percentage = 'percentage',
  amount = 'amount',
}

export interface ServiceChargeProps extends DomainEntityProps {
  name: string;
  value: number;
  type: ServiceChargeType;
  isCalculatedSubTotalPhase: boolean;
  isTaxable: boolean;
  linkedObjects: LinkedObjectMap;
}

export class ServiceCharge extends DomainEntity {
  name: string;
  value: number;
  type: ServiceChargeType;
  isCalculatedSubTotalPhase: boolean;
  isTaxable: boolean;
  linkedObjects: LinkedObjectMap;

  constructor(props: ServiceChargeProps) {
    super(props);
    this.name = props.name;
    this.value = props.value;
    this.type = props.type;
    this.isCalculatedSubTotalPhase = props.isCalculatedSubTotalPhase;
    this.isTaxable = props.isTaxable;
    this.linkedObjects = props.linkedObjects ?? {};
  }
}
```

**Key decisions:**
- **`ServiceChargeType.number` renamed to `ServiceChargeType.amount`** — `number` is a reserved word in many contexts and inconsistent with `DiscountType`. The repository converter maps old `'number'` values to `'amount'`.
- **Field is `value`, not `rate`** — fixes the old serialization mismatch. The converter handles the `rate`↔`value` mapping for backward-compatible Firestore data.

---

### 1.10 Barrel Export — `src/domain/catalog/index.ts`

```typescript
export { InventoryCount, InventoryCountState, LocationInventoryMap, defaultInventoryCount } from './InventoryCount';
export { ProductMeta } from './ProductMeta';
export { CategoryMeta } from './CategoryMeta';
export { OptionMeta } from './OptionMeta';
export { OptionSetMeta } from './OptionSetMeta';
export { Option, OptionProps } from './Option';
export { OptionSet, OptionSetProps, ProductOptionSetSetting } from './OptionSet';
export { Product, ProductProps } from './Product';
export { Category, CategoryProps } from './Category';
export { TaxRate, TaxRateProps } from './TaxRate';
export { Discount, DiscountProps, DiscountType } from './Discount';
export { ServiceCharge, ServiceChargeProps, ServiceChargeType } from './ServiceCharge';
```

**Update `src/domain/index.ts`** — append:
```typescript
export * as Catalog from './catalog';
```

---

### 1.11 Persistence — Inventory Helpers

**`src/persistence/firestore/helpers/InventoryCountConverter.ts`:**

Moves the old `InventoryCountToFirestore`/`InventoryCountFromFirestore` helpers to the persistence layer.

```typescript
import { InventoryCount, InventoryCountState, LocationInventoryMap, defaultInventoryCount }
  from '../../../domain/catalog/InventoryCount';

export function inventoryCountToFirestore(inventory: InventoryCount): FirebaseFirestore.DocumentData {
  const data: Record<string, unknown> = {
    count: inventory.count,
    state: inventory.state === InventoryCountState.inStock ? 'instock' : 'soldout',
    isAvailable: inventory.isAvailable,
  };
  if (inventory.timestamp) {
    data.timestamp = inventory.timestamp.toISOString();
  }
  return data;
}

export function inventoryCountFromFirestore(data: any): InventoryCount {
  if (!data) return defaultInventoryCount();
  return {
    count: data.count ?? -1,
    state: data.state === 'soldout' ? InventoryCountState.soldOut : InventoryCountState.inStock,
    isAvailable: data.isAvailable ?? true,
    timestamp: data.timestamp ? new Date(data.timestamp) : undefined,
  };
}

export function locationInventoryToFirestore(
  locationInventory: LocationInventoryMap,
): FirebaseFirestore.DocumentData {
  const result: Record<string, unknown> = {};
  for (const [locationId, inventory] of Object.entries(locationInventory)) {
    result[locationId] = inventoryCountToFirestore(inventory);
  }
  return result;
}

export function locationInventoryFromFirestore(
  data: any,
): LocationInventoryMap {
  if (!data) return {};
  const result: LocationInventoryMap = {};
  for (const [locationId, inventoryData] of Object.entries(data)) {
    result[locationId] = inventoryCountFromFirestore(inventoryData);
  }
  return result;
}
```

**Key decision:** Maps camelCase enum values (`inStock`/`soldOut`) to old Firestore values (`instock`/`soldout`) for backward compatibility.

---

### 1.12 Persistence — Catalog Repositories

Each repository follows the same `FirestoreRepository<T>` config pattern established in Phases 1–2.

**`src/persistence/firestore/OptionRepository.ts`:**
```typescript
export class OptionRepository extends FirestoreRepository<Option> {
  protected config(): FirestoreRepositoryConfig<Option> {
    return {
      collectionRef(businessId: string) {
        return Catalog.docRef(businessId).collection(Paths.CollectionNames.options);
      },
      toFirestore(option: Option): FirebaseFirestore.DocumentData {
        return {
          name: option.name,
          price: option.price,
          sku: option.sku,
          gtin: option.gtin,
          imageUrls: option.imageUrls,
          imageGsls: option.imageGsls,
          locationPrices: JSON.parse(JSON.stringify(option.locationPrices)),
          locationInventory: locationInventoryToFirestore(option.locationInventory),
          isActive: option.isActive,
          linkedObjects: JSON.parse(JSON.stringify(option.linkedObjects)),
          created: option.created.toISOString(),
          updated: option.updated.toISOString(),
          isDeleted: option.isDeleted,
        };
      },
      fromFirestore(data: FirebaseFirestore.DocumentData, id: string): Option {
        return new Option({
          Id: id,
          name: data.name,
          price: data.price,
          sku: data.sku ?? null,
          gtin: data.gtin ?? null,
          imageUrls: data.imageUrls ?? [],
          imageGsls: data.imageGsls ?? [],
          locationPrices: data.locationPrices ?? {},
          locationInventory: locationInventoryFromFirestore(data.locationInventory),
          isActive: data.isActive,
          linkedObjects: data.linkedObjects ?? {},
          created: new Date(data.created),
          updated: new Date(data.updated),
          isDeleted: data.isDeleted,
        });
      },
    };
  }
}
```

**`src/persistence/firestore/OptionSetRepository.ts`:**
```typescript
export class OptionSetRepository extends FirestoreRepository<OptionSet> {
  protected config(): FirestoreRepositoryConfig<OptionSet> {
    return {
      collectionRef(businessId: string) {
        return Catalog.docRef(businessId).collection(Paths.CollectionNames.optionSets);
      },
      toFirestore(os: OptionSet): FirebaseFirestore.DocumentData {
        return {
          name: os.name,
          options: JSON.parse(JSON.stringify(os.options)),
          minSelection: os.minSelection,
          maxSelection: os.maxSelection,
          displayOrder: os.displayOrder,
          displayTier: os.displayTier,
          optionDisplayOrder: os.optionDisplayOrder,
          preselectedOptionIds: os.preselectedOptionIds,
          imageUrls: os.imageUrls,
          imageGsls: os.imageGsls,
          locationInventory: locationInventoryToFirestore(os.locationInventory),
          isActive: os.isActive,
          linkedObjects: JSON.parse(JSON.stringify(os.linkedObjects)),
          created: os.created.toISOString(),
          updated: os.updated.toISOString(),
          isDeleted: os.isDeleted,
        };
      },
      fromFirestore(data: FirebaseFirestore.DocumentData, id: string): OptionSet {
        return new OptionSet({
          Id: id,
          name: data.name,
          options: data.options ?? {},
          minSelection: data.minSelection,
          maxSelection: data.maxSelection,
          displayOrder: data.displayOrder,
          displayTier: data.displayTier,
          optionDisplayOrder: data.optionDisplayOrder ?? [],
          preselectedOptionIds: data.preselectedOptionIds ?? [],
          imageUrls: data.imageUrls ?? [],
          imageGsls: data.imageGsls ?? [],
          locationInventory: locationInventoryFromFirestore(data.locationInventory),
          isActive: data.isActive,
          linkedObjects: data.linkedObjects ?? {},
          created: new Date(data.created),
          updated: new Date(data.updated),
          isDeleted: data.isDeleted,
        });
      },
    };
  }
}
```

**`src/persistence/firestore/ProductRepository.ts`:**
```typescript
export class ProductRepository extends FirestoreRepository<Product> {
  protected config(): FirestoreRepositoryConfig<Product> {
    return {
      collectionRef(businessId: string) {
        return Catalog.docRef(businessId).collection(Paths.CollectionNames.products);
      },
      toFirestore(product: Product): FirebaseFirestore.DocumentData {
        return {
          name: product.name,
          caption: product.caption,
          description: product.description,
          imageUrls: product.imageUrls,
          imageGsls: product.imageGsls,
          optionSets: JSON.parse(JSON.stringify(product.optionSets)),
          optionSetsSelection: JSON.parse(JSON.stringify(product.optionSetsSelection)),
          minPrice: product.minPrice,
          maxPrice: product.maxPrice,
          variationCount: product.variationCount,
          locationInventory: locationInventoryToFirestore(product.locationInventory),
          isActive: product.isActive,
          linkedObjects: JSON.parse(JSON.stringify(product.linkedObjects)),
          created: product.created.toISOString(),
          updated: product.updated.toISOString(),
          isDeleted: product.isDeleted,
        };
      },
      fromFirestore(data: FirebaseFirestore.DocumentData, id: string): Product {
        return new Product({
          Id: id,
          name: data.name,
          caption: data.caption ?? '',
          description: data.description ?? '',
          imageUrls: data.imageUrls ?? [],
          imageGsls: data.imageGsls ?? [],
          optionSets: data.optionSets ?? {},
          optionSetsSelection: data.optionSetsSelection ?? {},
          minPrice: data.minPrice,
          maxPrice: data.maxPrice,
          variationCount: data.variationCount,
          locationInventory: locationInventoryFromFirestore(data.locationInventory),
          isActive: data.isActive,
          linkedObjects: data.linkedObjects ?? {},
          created: new Date(data.created),
          updated: new Date(data.updated),
          isDeleted: data.isDeleted,
        });
      },
    };
  }
}
```

**`src/persistence/firestore/CategoryRepository.ts`:**
```typescript
export class CategoryRepository extends FirestoreRepository<Category> {
  protected config(): FirestoreRepositoryConfig<Category> {
    return {
      collectionRef(businessId: string) {
        return Catalog.docRef(businessId).collection(Paths.CollectionNames.categories);
      },
      toFirestore(category: Category): FirebaseFirestore.DocumentData {
        return {
          name: category.name,
          products: JSON.parse(JSON.stringify(category.products)),
          productDisplayOrder: category.productDisplayOrder,
          imageUrls: category.imageUrls,
          imageGsls: category.imageGsls,
          linkedObjects: JSON.parse(JSON.stringify(category.linkedObjects)),
          created: category.created.toISOString(),
          updated: category.updated.toISOString(),
          isDeleted: category.isDeleted,
        };
      },
      fromFirestore(data: FirebaseFirestore.DocumentData, id: string): Category {
        return new Category({
          Id: id,
          name: data.name,
          products: data.products ?? {},
          productDisplayOrder: data.productDisplayOrder ?? [],
          imageUrls: data.imageUrls ?? [],
          imageGsls: data.imageGsls ?? [],
          linkedObjects: data.linkedObjects ?? {},
          created: new Date(data.created),
          updated: new Date(data.updated),
          isDeleted: data.isDeleted,
        });
      },
    };
  }
}
```

**`src/persistence/firestore/TaxRateRepository.ts`:**
```typescript
export class TaxRateRepository extends FirestoreRepository<TaxRate> {
  protected config(): FirestoreRepositoryConfig<TaxRate> {
    return {
      collectionRef(businessId: string) {
        return Catalog.docRef(businessId).collection(Paths.CollectionNames.taxRates);
      },
      toFirestore(taxRate: TaxRate): FirebaseFirestore.DocumentData {
        return {
          name: taxRate.name,
          rate: taxRate.rate,
          isCalculatedSubTotalPhase: taxRate.isCalculatedSubTotalPhase,
          isInclusive: taxRate.isInclusive,
          linkedObjects: JSON.parse(JSON.stringify(taxRate.linkedObjects)),
          created: taxRate.created.toISOString(),
          updated: taxRate.updated.toISOString(),
          isDeleted: taxRate.isDeleted,
        };
      },
      fromFirestore(data: FirebaseFirestore.DocumentData, id: string): TaxRate {
        return new TaxRate({
          Id: id,
          name: data.name,
          rate: data.rate,
          isCalculatedSubTotalPhase: data.isCalculatedSubTotalPhase,
          isInclusive: data.isInclusive,
          linkedObjects: data.linkedObjects ?? {},
          created: new Date(data.created),
          updated: new Date(data.updated),
          isDeleted: data.isDeleted,
        });
      },
    };
  }
}
```

**`src/persistence/firestore/DiscountRepository.ts`:**
```typescript
export class DiscountRepository extends FirestoreRepository<Discount> {
  protected config(): FirestoreRepositoryConfig<Discount> {
    return {
      collectionRef(businessId: string) {
        return Catalog.docRef(businessId).collection(Paths.CollectionNames.discounts);
      },
      toFirestore(discount: Discount): FirebaseFirestore.DocumentData {
        return {
          name: discount.name,
          description: discount.description,
          couponCode: discount.couponCode,
          type: discount.type,
          value: discount.value,
          isActive: discount.isActive,
          linkedObjects: JSON.parse(JSON.stringify(discount.linkedObjects)),
          created: discount.created.toISOString(),
          updated: discount.updated.toISOString(),
          isDeleted: discount.isDeleted,
        };
      },
      fromFirestore(data: FirebaseFirestore.DocumentData, id: string): Discount {
        return new Discount({
          Id: id,
          name: data.name,
          description: data.description ?? '',
          couponCode: data.couponCode ?? '',
          type: data.type as DiscountType,
          value: data.value,
          isActive: data.isActive,
          linkedObjects: data.linkedObjects ?? {},
          created: new Date(data.created),
          updated: new Date(data.updated),
          isDeleted: data.isDeleted,
        });
      },
    };
  }
}
```

**`src/persistence/firestore/ServiceChargeRepository.ts`:**
```typescript
export class ServiceChargeRepository extends FirestoreRepository<ServiceCharge> {
  protected config(): FirestoreRepositoryConfig<ServiceCharge> {
    return {
      collectionRef(businessId: string) {
        // FIX: Old code incorrectly used 'taxRates' collection.
        return Catalog.docRef(businessId).collection(Paths.CollectionNames.serviceCharges);
      },
      toFirestore(charge: ServiceCharge): FirebaseFirestore.DocumentData {
        return {
          name: charge.name,
          value: charge.value,
          type: charge.type === ServiceChargeType.amount ? 'number' : charge.type,
          isCalculatedSubTotalPhase: charge.isCalculatedSubTotalPhase,
          isTaxable: charge.isTaxable,
          linkedObjects: JSON.parse(JSON.stringify(charge.linkedObjects)),
          created: charge.created.toISOString(),
          updated: charge.updated.toISOString(),
          isDeleted: charge.isDeleted,
        };
      },
      fromFirestore(data: FirebaseFirestore.DocumentData, id: string): ServiceCharge {
        return new ServiceCharge({
          Id: id,
          name: data.name,
          value: data.value ?? data.rate,  // Handles old 'rate' field name
          type: data.type === 'number'
            ? ServiceChargeType.amount
            : data.type as ServiceChargeType,
          isCalculatedSubTotalPhase: data.isCalculatedSubTotalPhase,
          isTaxable: data.isTaxable,
          linkedObjects: data.linkedObjects ?? {},
          created: new Date(data.created),
          updated: new Date(data.updated),
          isDeleted: data.isDeleted,
        });
      },
    };
  }
}
```

**Key decisions for ServiceChargeRepository:**
- **`collectionRef` uses `serviceCharges`** — fixes the old bug that used `taxRates`.
- **`toFirestore` writes `type: 'number'`** when domain value is `ServiceChargeType.amount` — backward compatible with existing Firestore data.
- **`fromFirestore` reads `data.value ?? data.rate`** — handles both old (`rate`) and new (`value`) field names.

---

### 1.13 Persistence — Relationship Handlers

**`src/persistence/firestore/handlers/RelationshipHandler.ts`** — Interface:

```typescript
import { DomainEntity } from '../../../domain/DomainEntity';

/**
 * Handles cross-entity relationship updates when an entity is saved or deleted.
 * Replaces the instanceof chains in FirestoreWriter.setT()/deleteT().
 */
export interface RelationshipHandler<T extends DomainEntity> {
  /** Update related entities when this entity is saved */
  onSet(
    entity: T,
    businessId: string,
    transaction: FirebaseFirestore.Transaction,
  ): Promise<void>;

  /** Clean up related entities when this entity is deleted */
  onDelete(
    entity: T,
    businessId: string,
    transaction: FirebaseFirestore.Transaction,
  ): Promise<void>;
}
```

**`src/persistence/firestore/handlers/RelationshipHandlerRegistry.ts`:**

```typescript
import { DomainEntity } from '../../../domain/DomainEntity';
import { RelationshipHandler } from './RelationshipHandler';

export class RelationshipHandlerRegistry {
  private handlers = new Map<Function, RelationshipHandler<any>>();

  register<T extends DomainEntity>(
    entityClass: new (...args: any[]) => T,
    handler: RelationshipHandler<T>,
  ): void {
    this.handlers.set(entityClass, handler);
  }

  resolve<T extends DomainEntity>(entity: T): RelationshipHandler<T> | null {
    // Walk prototype chain, same pattern as MetadataRegistry
    let proto = Object.getPrototypeOf(entity);
    while (proto) {
      const handler = this.handlers.get(proto.constructor);
      if (handler) return handler;
      proto = Object.getPrototypeOf(proto);
    }
    return null;
  }

  clear(): void {
    this.handlers.clear();
  }
}
```

**Concrete handlers:**

**`src/persistence/firestore/handlers/OptionRelationshipHandler.ts`:**

```typescript
/**
 * When an Option is saved: update OptionMeta in all OptionSets that contain it.
 * When an Option is deleted: remove from OptionSet options map, optionDisplayOrder,
 * and preselectedOptionIds.
 *
 * Replaces the Option instanceof branch in FirestoreWriter.setT()/deleteT().
 */
export class OptionRelationshipHandler implements RelationshipHandler<Option> {
  async onSet(option: Option, businessId: string, t: Transaction): Promise<void> {
    const optionSetRef = Catalog.docRef(businessId).collection(CollectionNames.optionSets);
    const snapshot = await t.get(
      optionSetRef.where(`options.${option.Id}.name`, '>=', ''),
    );
    for (const doc of snapshot.docs) {
      t.update(doc.ref, { [`options.${option.Id}`]: option.metadata() });
    }
  }

  async onDelete(option: Option, businessId: string, t: Transaction): Promise<void> {
    const optionSetRef = Catalog.docRef(businessId).collection(CollectionNames.optionSets);
    const snapshot = await t.get(
      optionSetRef.where(`options.${option.Id}.name`, '>=', ''),
    );
    for (const doc of snapshot.docs) {
      t.update(doc.ref, {
        [`options.${option.Id}`]: FieldValue.delete(),
        optionDisplayOrder: FieldValue.arrayRemove(option.Id),
        preselectedOptionIds: FieldValue.arrayRemove(option.Id),
      });
    }
  }
}
```

**`src/persistence/firestore/handlers/OptionSetRelationshipHandler.ts`:**

```typescript
/**
 * When an OptionSet is saved: update OptionSetMeta in all Products that contain it.
 * When an OptionSet is deleted: remove from Product optionSets and optionSetsSelection.
 */
export class OptionSetRelationshipHandler implements RelationshipHandler<OptionSet> {
  async onSet(optionSet: OptionSet, businessId: string, t: Transaction): Promise<void> {
    const productRef = Catalog.docRef(businessId).collection(CollectionNames.products);
    const snapshot = await t.get(
      productRef.where(`optionSets.${optionSet.Id}.name`, '>=', ''),
    );
    for (const doc of snapshot.docs) {
      t.update(doc.ref, { [`optionSets.${optionSet.Id}`]: optionSet.metadata() });
    }
  }

  async onDelete(optionSet: OptionSet, businessId: string, t: Transaction): Promise<void> {
    const productRef = Catalog.docRef(businessId).collection(CollectionNames.products);
    const snapshot = await t.get(
      productRef.where(`optionSets.${optionSet.Id}.name`, '>=', ''),
    );
    for (const doc of snapshot.docs) {
      t.update(doc.ref, {
        [`optionSets.${optionSet.Id}`]: FieldValue.delete(),
        [`optionSetsSelection.${optionSet.Id}`]: FieldValue.delete(),
      });
    }
  }
}
```

**`src/persistence/firestore/handlers/ProductRelationshipHandler.ts`:**

```typescript
/**
 * When a Product is saved: update ProductMeta in all Categories that contain it.
 * When a Product is deleted: remove from Category products map and productDisplayOrder.
 */
export class ProductRelationshipHandler implements RelationshipHandler<Product> {
  async onSet(product: Product, businessId: string, t: Transaction): Promise<void> {
    const categoryRef = Catalog.docRef(businessId).collection(CollectionNames.categories);
    const snapshot = await t.get(
      categoryRef.where('productDisplayOrder', 'array-contains', product.Id),
    );
    for (const doc of snapshot.docs) {
      t.update(doc.ref, { [`products.${product.Id}`]: product.metadata() });
    }
  }

  async onDelete(product: Product, businessId: string, t: Transaction): Promise<void> {
    const categoryRef = Catalog.docRef(businessId).collection(CollectionNames.categories);
    const snapshot = await t.get(
      categoryRef.where('productDisplayOrder', 'array-contains', product.Id),
    );
    for (const doc of snapshot.docs) {
      t.update(doc.ref, {
        [`products.${product.Id}`]: FieldValue.delete(),
        productDisplayOrder: FieldValue.arrayRemove(product.Id),
      });
    }
  }
}
```

**Key decisions:**
- **Handlers operate within transactions** passed from the repository's `set()`/`delete()` methods.
- **Query patterns are identical** to the old `FirestoreWriter` logic — verified field-by-field.
- **Category has no handler** — old code has only a stub with no cleanup logic. No handler registered.
- **Handlers are decoupled from repositories** — registered at bootstrap time, resolved dynamically.

---

### 1.14 Barrel Export Updates

**`src/persistence/firestore/handlers/index.ts`:**
```typescript
export { RelationshipHandler } from './RelationshipHandler';
export { RelationshipHandlerRegistry } from './RelationshipHandlerRegistry';
export { OptionRelationshipHandler } from './OptionRelationshipHandler';
export { OptionSetRelationshipHandler } from './OptionSetRelationshipHandler';
export { ProductRelationshipHandler } from './ProductRelationshipHandler';
```

**Update `src/persistence/firestore/index.ts`** — append:
```typescript
export { OptionRepository } from './OptionRepository';
export { OptionSetRepository } from './OptionSetRepository';
export { ProductRepository } from './ProductRepository';
export { CategoryRepository } from './CategoryRepository';
export { TaxRateRepository } from './TaxRateRepository';
export { DiscountRepository } from './DiscountRepository';
export { ServiceChargeRepository } from './ServiceChargeRepository';
export * from './handlers';
```

---

### 1.15 Deprecation Markers

Add `@deprecated` JSDoc to each old class — no functional changes:

| File | Deprecation target |
|------|-------------------|
| `src/restaurant/catalog/Product.ts` | Class + all static methods |
| `src/restaurant/catalog/Category.ts` | Class + all static methods |
| `src/restaurant/catalog/Option.ts` | Class + all static methods |
| `src/restaurant/catalog/OptionSet.ts` | Class + all static methods |
| `src/restaurant/catalog/TaxRate.ts` | Class + all static methods |
| `src/restaurant/catalog/Discount.ts` | Class + all static methods |
| `src/restaurant/catalog/ServiceCharge.ts` | Class + all static methods |
| `src/restaurant/catalog/InventoryCount.ts` | All exports — `@deprecated Use Domain.Catalog.InventoryCount` |
| `src/restaurant/catalog/ProductMeta.ts` | Interface — `@deprecated Use Domain.Catalog.ProductMeta` |
| `src/restaurant/catalog/CategoryMeta.ts` | Interface — `@deprecated Use Domain.Catalog.CategoryMeta` |
| `src/restaurant/catalog/OptionMeta.ts` | Interface — `@deprecated Use Domain.Catalog.OptionMeta` |
| `src/restaurant/catalog/OptionSetMeta.ts` | Interface — `@deprecated Use Domain.Catalog.OptionSetMeta` |

Old `src/index.ts` exports remain unchanged — backward compatible.

---

## 2. Testing Spec

### 2.1 "Zero Infrastructure" Requirement

All domain-layer tests must pass **without**:
- `admin.initializeApp()` called
- Firestore emulator running
- Network access
- Environment variables

Domain tests are pure unit tests. Repository and handler tests use `vi.mock('firebase-admin/firestore')`.

### 2.2 Test Helpers

**`src/domain/__tests__/helpers/CatalogFixtures.ts`:**

```typescript
export function createTestOptionProps(overrides?: Partial<OptionProps>): OptionProps;
export function createTestOptionSetProps(overrides?: Partial<OptionSetProps>): OptionSetProps;
export function createTestProductProps(overrides?: Partial<ProductProps>): ProductProps;
export function createTestCategoryProps(overrides?: Partial<CategoryProps>): CategoryProps;
export function createTestTaxRateProps(overrides?: Partial<TaxRateProps>): TaxRateProps;
export function createTestDiscountProps(overrides?: Partial<DiscountProps>): DiscountProps;
export function createTestServiceChargeProps(overrides?: Partial<ServiceChargeProps>): ServiceChargeProps;
export function createTestInventoryCount(overrides?: Partial<InventoryCount>): InventoryCount;
```

Each factory provides sensible defaults (e.g., `name: 'Test Option'`, `price: 100`, `isActive: true`, `linkedObjects: {}`).

---

### 2.3 Test Cases — Domain Layer

#### `src/domain/catalog/__tests__/InventoryCount.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | InventoryCountState has inStock and soldOut | Enum values accessible |
| 2 | InventoryCount interface holds all fields | Object literal satisfies interface |
| 3 | InventoryCount timestamp is optional | Object without timestamp compiles |
| 4 | LocationInventoryMap holds location-keyed inventory | `{ 'loc-1': inventoryCount }` satisfies type |
| 5 | defaultInventoryCount returns correct defaults | `count === -1`, `state === inStock`, `isAvailable === true` |
| 6 | No Firebase dependency | Test passing = proof |

#### `src/domain/catalog/__tests__/Option.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | Constructs with all props | All fields match input |
| 2 | Auto-generates UUID when no Id | Matches UUID pattern |
| 3 | Uses provided Id | Exact match |
| 4 | Defaults sku to null | `option.sku === null` |
| 5 | Defaults gtin to null | `option.gtin === null` |
| 6 | Defaults imageUrls to [] | Empty array |
| 7 | Defaults imageGsls to [] | Empty array |
| 8 | Defaults locationPrices to {} | Empty object |
| 9 | Defaults locationInventory to {} | Empty object |
| 10 | Defaults linkedObjects to {} | Empty object |
| 11 | metadata() returns OptionMeta | `{ name, isActive }` matches |
| 12 | Inherits DomainEntity fields | Has `created`, `updated`, `isDeleted` |
| 13 | Instantiates without Firebase | Test passing = proof |
| 14 | name is mutable | Assign new value, verify |
| 15 | price is mutable | Assign new value, verify |

#### `src/domain/catalog/__tests__/OptionSet.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | Constructs with all props | All fields match input |
| 2 | Auto-generates UUID | Matches UUID pattern |
| 3 | Defaults options to {} | Empty object |
| 4 | Defaults optionDisplayOrder to [] | Empty array |
| 5 | Defaults preselectedOptionIds to [] | Empty array |
| 6 | Defaults imageUrls/imageGsls to [] | Empty arrays |
| 7 | Defaults locationInventory to {} | Empty object |
| 8 | Defaults linkedObjects to {} | Empty object |
| 9 | metadata() returns OptionSetMeta | `{ name, displayOrder, displayTier }` |
| 10 | ProductOptionSetSetting interface works | Object literal satisfies interface |
| 11 | Inherits DomainEntity fields | Has base fields |
| 12 | Instantiates without Firebase | Test passing = proof |

#### `src/domain/catalog/__tests__/Product.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | Constructs with all props | All fields match input |
| 2 | Auto-generates UUID | Matches UUID pattern |
| 3 | Defaults caption to '' | Empty string |
| 4 | Defaults description to '' | Empty string |
| 5 | Defaults imageUrls/imageGsls to [] | Empty arrays |
| 6 | Defaults optionSets to {} | Empty object |
| 7 | Defaults optionSetsSelection to {} | Empty object |
| 8 | Defaults locationInventory to {} | Empty object |
| 9 | Defaults linkedObjects to {} | Empty object |
| 10 | metadata() returns ProductMeta | All 7 fields match |
| 11 | Inherits DomainEntity fields | Has base fields |
| 12 | Instantiates without Firebase | Test passing = proof |
| 13 | optionSets stores OptionSetMeta | Nested structure accessible |
| 14 | locationInventory stores InventoryCount | Nested structure accessible |

#### `src/domain/catalog/__tests__/Category.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | Constructs with all props | All fields match input |
| 2 | Auto-generates UUID | Matches UUID pattern |
| 3 | Defaults products to {} | Empty object |
| 4 | Defaults productDisplayOrder to [] | Empty array |
| 5 | Defaults imageUrls/imageGsls to [] | Empty arrays |
| 6 | Defaults linkedObjects to {} | Empty object |
| 7 | metadata() returns CategoryMeta | `{ name }` matches |
| 8 | products stores ProductMeta | Nested structure accessible |
| 9 | Inherits DomainEntity fields | Has base fields |
| 10 | Instantiates without Firebase | Test passing = proof |

#### `src/domain/catalog/__tests__/TaxRate.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | Constructs with all props | All fields match input |
| 2 | Auto-generates UUID | Matches UUID pattern |
| 3 | Defaults linkedObjects to {} | Empty object |
| 4 | No metadata() method | Not an instance of MetadataProjection |
| 5 | Inherits DomainEntity fields | Has base fields |
| 6 | Instantiates without Firebase | Test passing = proof |

#### `src/domain/catalog/__tests__/Discount.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | Constructs with all props | All fields match input |
| 2 | Auto-generates UUID | Matches UUID pattern |
| 3 | DiscountType enum has expected values | `percentage`, `amount`, `unknown` |
| 4 | Defaults description to '' | Empty string |
| 5 | Defaults couponCode to '' | Empty string |
| 6 | Defaults linkedObjects to {} | Empty object |
| 7 | Inherits DomainEntity fields | Has base fields |
| 8 | Instantiates without Firebase | Test passing = proof |

#### `src/domain/catalog/__tests__/ServiceCharge.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | Constructs with all props | All fields match input |
| 2 | Auto-generates UUID | Matches UUID pattern |
| 3 | ServiceChargeType enum has expected values | `percentage`, `amount` |
| 4 | Defaults linkedObjects to {} | Empty object |
| 5 | Inherits DomainEntity fields | Has base fields |
| 6 | Instantiates without Firebase | Test passing = proof |

---

### 2.4 Test Cases — Persistence Layer (Repositories)

All repository tests use `vi.mock('firebase-admin/firestore')` with mock stubs. Same pattern as Phase 1.

#### `src/persistence/firestore/__tests__/helpers/InventoryCountConverter.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | inventoryCountToFirestore serializes correctly | All fields present, state mapped to old values |
| 2 | inventoryCountToFirestore maps inStock to 'instock' | Backward compatible |
| 3 | inventoryCountToFirestore maps soldOut to 'soldout' | Backward compatible |
| 4 | inventoryCountToFirestore includes timestamp as ISO string | When present |
| 5 | inventoryCountToFirestore omits timestamp when undefined | Field absent |
| 6 | inventoryCountFromFirestore deserializes correctly | All fields correct |
| 7 | inventoryCountFromFirestore maps 'instock' to inStock | Enum mapping |
| 8 | inventoryCountFromFirestore maps 'soldout' to soldOut | Enum mapping |
| 9 | inventoryCountFromFirestore returns default on null | `defaultInventoryCount()` values |
| 10 | locationInventoryToFirestore iterates all locations | Each location converted |
| 11 | locationInventoryFromFirestore iterates all locations | Each location deserialized |
| 12 | locationInventoryFromFirestore returns {} on null | Empty object |

#### `src/persistence/firestore/__tests__/OptionRepository.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | get() returns Option when exists | All fields populated |
| 2 | get() returns null when missing | `null` returned |
| 3 | set() serializes all fields correctly | DocumentData shape matches |
| 4 | set() uses locationInventoryToFirestore | Inventory helper called |
| 5 | set() deep-clones nested objects | linkedObjects, locationPrices |
| 6 | set() runs transaction | `transaction.set` called |
| 7 | Round-trip preserves data | toFirestore → fromFirestore cycle |
| 8 | fromFirestore defaults sku to null | When absent |
| 9 | fromFirestore defaults gtin to null | When absent |
| 10 | findByLinkedObject queries correct field | `linkedObjects.square.linkedObjectId` |

#### `src/persistence/firestore/__tests__/OptionSetRepository.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | get() returns OptionSet when exists | All fields populated |
| 2 | get() returns null when missing | `null` returned |
| 3 | set() serializes all fields | DocumentData shape matches |
| 4 | set() uses locationInventoryToFirestore | Inventory helper called |
| 5 | Round-trip preserves data | All fields match after cycle |
| 6 | fromFirestore defaults optionDisplayOrder to [] | When absent |
| 7 | fromFirestore defaults preselectedOptionIds to [] | When absent |

#### `src/persistence/firestore/__tests__/ProductRepository.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | get() returns Product when exists | All fields populated |
| 2 | get() returns null when missing | `null` returned |
| 3 | set() serializes all fields | DocumentData shape matches |
| 4 | set() deep-clones optionSets and optionSetsSelection | JSON round-tripped |
| 5 | Round-trip preserves data | All fields match after cycle |
| 6 | fromFirestore defaults caption to '' | When absent |
| 7 | fromFirestore defaults description to '' | When absent |

#### `src/persistence/firestore/__tests__/CategoryRepository.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | get() returns Category when exists | All fields populated |
| 2 | get() returns null when missing | `null` returned |
| 3 | set() serializes all fields | DocumentData shape matches |
| 4 | Round-trip preserves data | All fields match |
| 5 | fromFirestore defaults products to {} | When absent |
| 6 | fromFirestore defaults productDisplayOrder to [] | When absent |

#### `src/persistence/firestore/__tests__/TaxRateRepository.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | get() returns TaxRate when exists | All fields populated |
| 2 | get() returns null when missing | `null` returned |
| 3 | set() serializes all fields | DocumentData shape matches |
| 4 | Round-trip preserves data | All fields match |

#### `src/persistence/firestore/__tests__/DiscountRepository.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | get() returns Discount when exists | All fields populated |
| 2 | get() returns null when missing | `null` returned |
| 3 | set() serializes all fields | DocumentData shape matches |
| 4 | Round-trip preserves data | All fields match |
| 5 | fromFirestore casts type as DiscountType | Enum value correct |
| 6 | fromFirestore defaults description to '' | When absent |

#### `src/persistence/firestore/__tests__/ServiceChargeRepository.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | get() returns ServiceCharge when exists | All fields populated |
| 2 | get() returns null when missing | `null` returned |
| 3 | set() serializes type 'amount' as 'number' for Firestore | Backward compatible |
| 4 | set() serializes type 'percentage' unchanged | No mapping needed |
| 5 | fromFirestore maps type 'number' to ServiceChargeType.amount | Enum conversion |
| 6 | fromFirestore reads value field, falls back to rate | `data.value ?? data.rate` |
| 7 | Round-trip preserves data | All fields match |
| 8 | collectionRef uses 'serviceCharges' not 'taxRates' | Bug fix verified |

---

### 2.5 Test Cases — Relationship Handlers

#### `src/persistence/firestore/handlers/__tests__/RelationshipHandlerRegistry.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | Register and resolve | Returns registered handler |
| 2 | Null for unregistered | Returns `null` |
| 3 | Prototype chain walking | Child class resolves parent's handler |
| 4 | clear() removes all | Returns `null` after clear |

#### `src/persistence/firestore/handlers/__tests__/OptionRelationshipHandler.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | onSet queries OptionSets containing this option | `where('options.{id}.name', '>=', '')` called |
| 2 | onSet updates OptionMeta on matching OptionSets | `t.update` with `options.{id}` = OptionMeta |
| 3 | onSet no-ops when no OptionSets match | No `t.update` calls |
| 4 | onDelete queries OptionSets containing this option | Same where clause |
| 5 | onDelete removes option from options map | `FieldValue.delete()` on `options.{id}` |
| 6 | onDelete removes from optionDisplayOrder | `FieldValue.arrayRemove(id)` |
| 7 | onDelete removes from preselectedOptionIds | `FieldValue.arrayRemove(id)` |

#### `src/persistence/firestore/handlers/__tests__/OptionSetRelationshipHandler.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | onSet queries Products containing this OptionSet | `where('optionSets.{id}.name', '>=', '')` called |
| 2 | onSet updates OptionSetMeta on matching Products | `t.update` with `optionSets.{id}` = OptionSetMeta |
| 3 | onSet no-ops when no Products match | No `t.update` calls |
| 4 | onDelete removes from Products optionSets map | `FieldValue.delete()` |
| 5 | onDelete removes from Products optionSetsSelection | `FieldValue.delete()` |

#### `src/persistence/firestore/handlers/__tests__/ProductRelationshipHandler.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | onSet queries Categories containing this Product | `where('productDisplayOrder', 'array-contains', id)` called |
| 2 | onSet updates ProductMeta on matching Categories | `t.update` with `products.{id}` = ProductMeta |
| 3 | onSet no-ops when no Categories match | No `t.update` calls |
| 4 | onDelete removes from Categories products map | `FieldValue.delete()` |
| 5 | onDelete removes from Categories productDisplayOrder | `FieldValue.arrayRemove(id)` |

---

## 3. Implementation & Testing Tracker

### Domain Layer — Code

- [ ] Create `src/domain/catalog/` directory
- [ ] `src/domain/catalog/InventoryCount.ts` — enum, interface, type, default helper
- [ ] `src/domain/catalog/ProductMeta.ts` — interface
- [ ] `src/domain/catalog/CategoryMeta.ts` — interface
- [ ] `src/domain/catalog/OptionMeta.ts` — interface
- [ ] `src/domain/catalog/OptionSetMeta.ts` — interface
- [ ] `src/domain/catalog/Option.ts` — `OptionProps`, `Option` class
- [ ] `src/domain/catalog/OptionSet.ts` — `ProductOptionSetSetting`, `OptionSetProps`, `OptionSet` class
- [ ] `src/domain/catalog/Product.ts` — `ProductProps`, `Product` class
- [ ] `src/domain/catalog/Category.ts` — `CategoryProps`, `Category` class
- [ ] `src/domain/catalog/TaxRate.ts` — `TaxRateProps`, `TaxRate` class
- [ ] `src/domain/catalog/Discount.ts` — `DiscountType` enum, `DiscountProps`, `Discount` class
- [ ] `src/domain/catalog/ServiceCharge.ts` — `ServiceChargeType` enum, `ServiceChargeProps`, `ServiceCharge` class
- [ ] `src/domain/catalog/index.ts` — barrel export
- [ ] Update `src/domain/index.ts` — add `Catalog` namespace export

### Domain Layer — Tests

- [ ] `src/domain/__tests__/helpers/CatalogFixtures.ts` — factory functions for all 7 models + InventoryCount
- [ ] `src/domain/catalog/__tests__/InventoryCount.test.ts` (6 tests)
- [ ] `src/domain/catalog/__tests__/Option.test.ts` (15 tests)
- [ ] `src/domain/catalog/__tests__/OptionSet.test.ts` (12 tests)
- [ ] `src/domain/catalog/__tests__/Product.test.ts` (14 tests)
- [ ] `src/domain/catalog/__tests__/Category.test.ts` (10 tests)
- [ ] `src/domain/catalog/__tests__/TaxRate.test.ts` (6 tests)
- [ ] `src/domain/catalog/__tests__/Discount.test.ts` (8 tests)
- [ ] `src/domain/catalog/__tests__/ServiceCharge.test.ts` (6 tests)

### Persistence Layer — Code (Helpers)

- [ ] `src/persistence/firestore/helpers/` directory
- [ ] `src/persistence/firestore/helpers/InventoryCountConverter.ts` — serialization helpers

### Persistence Layer — Code (Repositories)

- [ ] `src/persistence/firestore/OptionRepository.ts`
- [ ] `src/persistence/firestore/OptionSetRepository.ts`
- [ ] `src/persistence/firestore/ProductRepository.ts`
- [ ] `src/persistence/firestore/CategoryRepository.ts`
- [ ] `src/persistence/firestore/TaxRateRepository.ts`
- [ ] `src/persistence/firestore/DiscountRepository.ts`
- [ ] `src/persistence/firestore/ServiceChargeRepository.ts`

### Persistence Layer — Code (Relationship Handlers)

- [ ] `src/persistence/firestore/handlers/` directory
- [ ] `src/persistence/firestore/handlers/RelationshipHandler.ts` — interface
- [ ] `src/persistence/firestore/handlers/RelationshipHandlerRegistry.ts` — registry class
- [ ] `src/persistence/firestore/handlers/OptionRelationshipHandler.ts`
- [ ] `src/persistence/firestore/handlers/OptionSetRelationshipHandler.ts`
- [ ] `src/persistence/firestore/handlers/ProductRelationshipHandler.ts`
- [ ] `src/persistence/firestore/handlers/index.ts` — barrel export

### Persistence Layer — Code (Exports)

- [ ] Update `src/persistence/firestore/index.ts` — add repository + handler exports

### Persistence Layer — Tests (Helpers)

- [ ] `src/persistence/firestore/__tests__/helpers/InventoryCountConverter.test.ts` (12 tests)

### Persistence Layer — Tests (Repositories)

- [ ] `src/persistence/firestore/__tests__/OptionRepository.test.ts` (10 tests)
- [ ] `src/persistence/firestore/__tests__/OptionSetRepository.test.ts` (7 tests)
- [ ] `src/persistence/firestore/__tests__/ProductRepository.test.ts` (7 tests)
- [ ] `src/persistence/firestore/__tests__/CategoryRepository.test.ts` (6 tests)
- [ ] `src/persistence/firestore/__tests__/TaxRateRepository.test.ts` (4 tests)
- [ ] `src/persistence/firestore/__tests__/DiscountRepository.test.ts` (6 tests)
- [ ] `src/persistence/firestore/__tests__/ServiceChargeRepository.test.ts` (8 tests)

### Persistence Layer — Tests (Relationship Handlers)

- [ ] `src/persistence/firestore/handlers/__tests__/RelationshipHandlerRegistry.test.ts` (4 tests)
- [ ] `src/persistence/firestore/handlers/__tests__/OptionRelationshipHandler.test.ts` (7 tests)
- [ ] `src/persistence/firestore/handlers/__tests__/OptionSetRelationshipHandler.test.ts` (5 tests)
- [ ] `src/persistence/firestore/handlers/__tests__/ProductRelationshipHandler.test.ts` (5 tests)

### Deprecation

- [ ] Add `@deprecated` to `src/restaurant/catalog/Product.ts` class + static methods
- [ ] Add `@deprecated` to `src/restaurant/catalog/Category.ts` class + static methods
- [ ] Add `@deprecated` to `src/restaurant/catalog/Option.ts` class + static methods
- [ ] Add `@deprecated` to `src/restaurant/catalog/OptionSet.ts` class + static methods
- [ ] Add `@deprecated` to `src/restaurant/catalog/TaxRate.ts` class + static methods
- [ ] Add `@deprecated` to `src/restaurant/catalog/Discount.ts` class + static methods
- [ ] Add `@deprecated` to `src/restaurant/catalog/ServiceCharge.ts` class + static methods
- [ ] Add `@deprecated` to `src/restaurant/catalog/InventoryCount.ts` all exports
- [ ] Add `@deprecated` to `src/restaurant/catalog/ProductMeta.ts`
- [ ] Add `@deprecated` to `src/restaurant/catalog/CategoryMeta.ts`
- [ ] Add `@deprecated` to `src/restaurant/catalog/OptionMeta.ts`
- [ ] Add `@deprecated` to `src/restaurant/catalog/OptionSetMeta.ts`

### Integration Verification

- [ ] `npm run tsc` passes with no errors
- [ ] `npx eslint src/` passes
- [ ] `npm run test` — All tests pass (existing ~87 + ~146 new = ~233 total)
- [ ] All Phase 0/1/2 tests still pass (no regressions)
- [ ] Old imports still compile — backward compatible
- [ ] Domain classes instantiate without Firebase initialized
- [ ] `src/index.ts` exports both old (deprecated) and new APIs

---

## Files Changed Summary

| Action | File | Description |
|--------|------|-------------|
| **Create** | `src/domain/catalog/InventoryCount.ts` | Enum, interface, type, default helper |
| **Create** | `src/domain/catalog/ProductMeta.ts` | Product metadata projection interface |
| **Create** | `src/domain/catalog/CategoryMeta.ts` | Category metadata projection interface |
| **Create** | `src/domain/catalog/OptionMeta.ts` | Option metadata projection interface |
| **Create** | `src/domain/catalog/OptionSetMeta.ts` | OptionSet metadata projection interface |
| **Create** | `src/domain/catalog/Option.ts` | Pure domain model |
| **Create** | `src/domain/catalog/OptionSet.ts` | Pure domain model + `ProductOptionSetSetting` |
| **Create** | `src/domain/catalog/Product.ts` | Pure domain model |
| **Create** | `src/domain/catalog/Category.ts` | Pure domain model |
| **Create** | `src/domain/catalog/TaxRate.ts` | Pure domain model |
| **Create** | `src/domain/catalog/Discount.ts` | Pure domain model + `DiscountType` enum |
| **Create** | `src/domain/catalog/ServiceCharge.ts` | Pure domain model + `ServiceChargeType` enum |
| **Create** | `src/domain/catalog/index.ts` | Barrel export |
| **Create** | `src/persistence/firestore/helpers/InventoryCountConverter.ts` | Firestore serialization helpers |
| **Create** | `src/persistence/firestore/OptionRepository.ts` | Repository implementation |
| **Create** | `src/persistence/firestore/OptionSetRepository.ts` | Repository implementation |
| **Create** | `src/persistence/firestore/ProductRepository.ts` | Repository implementation |
| **Create** | `src/persistence/firestore/CategoryRepository.ts` | Repository implementation |
| **Create** | `src/persistence/firestore/TaxRateRepository.ts` | Repository implementation |
| **Create** | `src/persistence/firestore/DiscountRepository.ts` | Repository implementation |
| **Create** | `src/persistence/firestore/ServiceChargeRepository.ts` | Repository implementation |
| **Create** | `src/persistence/firestore/handlers/RelationshipHandler.ts` | Handler interface |
| **Create** | `src/persistence/firestore/handlers/RelationshipHandlerRegistry.ts` | Registry class |
| **Create** | `src/persistence/firestore/handlers/OptionRelationshipHandler.ts` | Option → OptionSet updates |
| **Create** | `src/persistence/firestore/handlers/OptionSetRelationshipHandler.ts` | OptionSet → Product updates |
| **Create** | `src/persistence/firestore/handlers/ProductRelationshipHandler.ts` | Product → Category updates |
| **Create** | `src/persistence/firestore/handlers/index.ts` | Handler barrel export |
| **Create** | `src/domain/__tests__/helpers/CatalogFixtures.ts` | Test factory functions |
| **Create** | 8 domain test files | 77 domain tests |
| **Create** | 8 persistence test files | 48 repository tests |
| **Create** | 1 helper test file | 12 converter tests |
| **Create** | 4 handler test files | 21 handler tests |
| **Modify** | `src/domain/index.ts` | Add `Catalog` namespace export |
| **Modify** | `src/persistence/firestore/index.ts` | Add repository + handler exports |
| **Modify** | 12 old catalog files | Add `@deprecated` JSDoc |

**Total new tests:** ~158

---

## Dependency Graph Position

```
Phase 0 (done) ── Phase 1 (done) ── Phase 2 (done, includes Location)
                                            │
                                    ▶ Phase 3 (this — Catalog + Relationships) ◀
                                            │
                                       Phase 4 (Roots)
                                            │
                                       Phase 5 (Cleanup)
```

Phase 3 is the hardest phase. After this, the remaining work (Roots, Cleanup) is structurally simpler.

---

## Critical Files Reference

| File | Why |
|------|-----|
| `src/restaurant/catalog/Product.ts` | V1 model — 14 fields, ProductMeta |
| `src/restaurant/catalog/Category.ts` | V1 model — contains ProductMeta map |
| `src/restaurant/catalog/Option.ts` | V1 model — 13 fields, OptionMeta |
| `src/restaurant/catalog/OptionSet.ts` | V1 model — contains OptionMeta map |
| `src/restaurant/catalog/TaxRate.ts` | V1 model — standalone |
| `src/restaurant/catalog/Discount.ts` | V1 model — standalone |
| `src/restaurant/catalog/ServiceCharge.ts` | V1 model — known bugs |
| `src/restaurant/catalog/InventoryCount.ts` | Value type + Firestore helpers |
| `src/restaurant/roots/Catalog.ts` | `docRef(businessId)` for collection paths |
| `src/firestore-core/core/FirestoreWriter.ts` | `instanceof` chains → RelationshipHandlers |
| `src/firestore-core/core/FirestoreObject.ts` | V1 base — contract being replaced |
| `src/firestore-core/Paths.ts` | Collection name constants |
| `src/domain/DomainEntity.ts` | Phase 0 base — all catalog models extend this |
| `src/domain/LinkedObjectRef.ts` | Phase 2 — used by all catalog models |
| `src/persistence/firestore/FirestoreRepository.ts` | Phase 0 base repo — all catalog repos extend this |
