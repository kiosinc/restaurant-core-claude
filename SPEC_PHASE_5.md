# Phase 5 (Migrate Root Aggregates, Business Utilities & Final Cleanup) — Detailed Spec

## Overview

Phase 5 is the **final phase**. It has two parts:

**Part A — Root Aggregates & Business Utilities:** Migrates root aggregate documents (Business, Catalog, Surfaces, Orders, Locations, ConnectedAccounts, Services, Onboarding) to the domain layer, along with BusinessUtilities' `createBusiness()` transaction orchestration. Introduces `PathResolver` for centralized Firestore path construction.

**Part B — Cleanup & Major Version Bump:** Removes all deprecated facade classes, old `FirestoreObject`/`FirestoreObjectV2`/`FirestoreWriter` base classes, migrates all child repositories to use `PathResolver`, and updates `src/index.ts` to export exclusively from the domain and persistence layers. Published as a **major version bump**.

Root aggregates are singleton documents that anchor Firestore sub-collection trees. Most are simple data holders — their primary role is providing `docRef(businessId)` paths for child collections. The domain layer extracts their data; the persistence layer retains their path-resolution logic.

**Key difference from Phases 3–4:** Root aggregates don't have `metaLinks()` or `metadata()` — they *are* the targets of metadata denormalization from child entities. They also serve as path anchors (e.g., `Catalog.docRef(businessId)` is used by 7+ repositories).

**Scope:** ~16 new domain files, ~10 new persistence files, BusinessUtilities refactored, 8 deprecated classes, ~42 old files deleted, ~20 repository imports refactored, barrel exports rewritten.

**Prerequisite:** Phases 0–4 complete.

---

## Current State

### Root Aggregate Classes

| Class | Base | Collection Path | Fields (beyond base) | Singleton Id |
|-------|------|-----------------|---------------------|-------------|
| `Business` | V1 | `businesses/{id}` | `agent`, `createdBy`, `type`, `businessProfile`, `roles` | No (uses auto ID) |
| `Catalog` | V1 | `businesses/{id}/public/catalog` | *(none)* | `'catalog'` |
| `Surfaces` | V1 | `businesses/{id}/public/surfaces` | `menus`, `menuGroups` | `'surfaces'` |
| `Orders` | V1 | `businesses/{id}/private/orders` | 14 settings fields | `'orders'` |
| `Locations` | V1 | `businesses/{id}/public/locations` | `locations` (map of LocationMeta) | `'locations'` |
| `ConnectedAccounts` | V1 | `businesses/{id}/private/connectedAccounts` | `tokens` (map) | `'connectedAccounts'` |
| `Services` | V1 | `businesses/{id}/private/services` | `kioskFeeRate`, `experiments` | `'services'` |
| `Onboarding` | V1 | `businesses/{id}/private/onboarding` | `stripeCustomerId`, `onboardingStatus`, `onboardingOrderId`, `menuCategories` | `'onboarding'` |

### Key Observations

1. **Most roots are singletons** — their Id is a fixed collection name constant (e.g., `'catalog'`, `'surfaces'`). Only `Business` uses auto-generated IDs.
2. **All use `FirestoreObject` V1** — positional constructors, static `docRef()`, static `firestoreConverter`.
3. **`Business` is the only root with child path helpers** — `publicCollectionRef()`, `privateCollectionRef()`, `featurelistRef()`, `sandboxCollectionRef()`.
4. **`Onboarding` has business logic** — `repair()` and `createMenu()` static methods. These stay in the application/persistence layer.
5. **Root `docRef()` methods are used by child repositories** — e.g., `Catalog.docRef(businessId)` is referenced in Phase 3's catalog repositories. These path helpers must remain accessible via PathResolver.

### What Exists After Phase 4 (Dual-Layer)

1. **Domain layer** (`src/domain/`) — Pure models, no Firebase imports
2. **Persistence layer** (`src/persistence/`) — Repositories, metadata registry
3. **Old restaurant layer** (`src/restaurant/`) — Deprecated, still exported for backward compatibility
4. **Old firestore-core layer** (`src/firestore-core/`) — Base classes, writer, paths, constants

### BusinessUtilities.createBusiness()

Current implementation:
- Creates 8 root documents in a single Firestore transaction
- Fetches feature list from Firebase Extensions
- Returns `Business.docRef(businessId)`

This is the only cross-root orchestration point in the codebase.

---

# PART A — Root Aggregates & Business Utilities

## A.1 Implementation Spec

### A.1.1 Design Decision: Path Resolution

**Problem:** Child repositories (from Phases 1–4) reference root `docRef()` methods. For example:
```typescript
// In OptionRepository config
collectionRef(businessId) {
  return Catalog.docRef(businessId).collection('options');
}
```

These calls use the *old* `Catalog` class (which calls `Business.publicCollectionRef()` → `getFirestore()`). Moving roots to the domain layer doesn't change this — repositories are already in the persistence layer and can call Firestore.

**Decision:** Create a `PathResolver` utility in the persistence layer that centralizes all Firestore path construction. New repositories created in Part A use `PathResolver`. In Part B, all existing repositories are migrated to `PathResolver` and old root classes are deleted.

**`src/persistence/firestore/PathResolver.ts`:**
```typescript
import { getFirestore } from 'firebase-admin/firestore';
import * as Paths from '../../firestore-core/Paths';

/**
 * Centralizes all Firestore document path resolution.
 * Replaces scattered Business.publicCollectionRef / Catalog.docRef / etc.
 */
export class PathResolver {
  private static db() {
    return getFirestore();
  }

  // Business root
  static businessDoc(businessId: string): FirebaseFirestore.DocumentReference {
    return this.db().collection(Paths.CollectionNames.businesses).doc(businessId);
  }

  static businessCollection(): FirebaseFirestore.CollectionReference {
    return this.db().collection(Paths.CollectionNames.businesses);
  }

  // Environment sub-collections
  static publicCollection(businessId: string): FirebaseFirestore.CollectionReference {
    return this.businessDoc(businessId).collection(Paths.Environment.public);
  }

  static privateCollection(businessId: string): FirebaseFirestore.CollectionReference {
    return this.businessDoc(businessId).collection(Paths.Environment.private);
  }

  static featurelistCollection(businessId: string): FirebaseFirestore.CollectionReference {
    return this.businessDoc(businessId).collection(Paths.Environment.featurelist);
  }

  static sandboxCollection(businessId: string): FirebaseFirestore.CollectionReference {
    return this.businessDoc(businessId).collection(Paths.Environment.sandbox);
  }

  // Singleton root docs
  static catalogDoc(businessId: string): FirebaseFirestore.DocumentReference {
    return this.publicCollection(businessId).doc(Paths.CollectionNames.catalog);
  }

  static surfacesDoc(businessId: string): FirebaseFirestore.DocumentReference {
    return this.publicCollection(businessId).doc(Paths.CollectionNames.surfaces);
  }

  static locationsDoc(businessId: string): FirebaseFirestore.DocumentReference {
    return this.publicCollection(businessId).doc(Paths.CollectionNames.locations);
  }

  static ordersDoc(businessId: string): FirebaseFirestore.DocumentReference {
    return this.privateCollection(businessId).doc(Paths.CollectionNames.orders);
  }

  static connectedAccountsDoc(businessId: string): FirebaseFirestore.DocumentReference {
    return this.privateCollection(businessId).doc(Paths.CollectionNames.connectedAccounts);
  }

  static servicesDoc(businessId: string): FirebaseFirestore.DocumentReference {
    return this.privateCollection(businessId).doc(Paths.CollectionNames.services);
  }

  static onboardingDoc(businessId: string): FirebaseFirestore.DocumentReference {
    return this.privateCollection(businessId).doc(Paths.CollectionNames.onboarding);
  }

  // Child collection helpers
  static productsCollection(businessId: string): FirebaseFirestore.CollectionReference {
    return this.catalogDoc(businessId).collection(Paths.CollectionNames.products);
  }

  static categoriesCollection(businessId: string): FirebaseFirestore.CollectionReference {
    return this.catalogDoc(businessId).collection(Paths.CollectionNames.categories);
  }

  static optionsCollection(businessId: string): FirebaseFirestore.CollectionReference {
    return this.catalogDoc(businessId).collection(Paths.CollectionNames.options);
  }

  static optionSetsCollection(businessId: string): FirebaseFirestore.CollectionReference {
    return this.catalogDoc(businessId).collection(Paths.CollectionNames.optionSets);
  }

  static taxRatesCollection(businessId: string): FirebaseFirestore.CollectionReference {
    return this.catalogDoc(businessId).collection(Paths.CollectionNames.taxRates);
  }

  static discountsCollection(businessId: string): FirebaseFirestore.CollectionReference {
    return this.catalogDoc(businessId).collection(Paths.CollectionNames.discounts);
  }

  static serviceChargesCollection(businessId: string): FirebaseFirestore.CollectionReference {
    return this.catalogDoc(businessId).collection(Paths.CollectionNames.serviceCharges);
  }

  static menusCollection(businessId: string): FirebaseFirestore.CollectionReference {
    return this.surfacesDoc(businessId).collection(Paths.CollectionNames.menus);
  }

  static menuGroupsCollection(businessId: string): FirebaseFirestore.CollectionReference {
    return this.surfacesDoc(businessId).collection(Paths.CollectionNames.menuGroups);
  }

  static surfaceConfigurationsCollection(businessId: string): FirebaseFirestore.CollectionReference {
    return this.surfacesDoc(businessId).collection(Paths.CollectionNames.surfaceConfigurations);
  }

  static kioskConfigurationsCollection(businessId: string): FirebaseFirestore.CollectionReference {
    return this.surfacesDoc(businessId).collection('kioskConfigurations');
  }

  static checkoutOptionsCollection(businessId: string): FirebaseFirestore.CollectionReference {
    return this.surfacesDoc(businessId).collection('checkoutOptions');
  }

  static locationsCollection(businessId: string): FirebaseFirestore.CollectionReference {
    return this.locationsDoc(businessId).collection(Paths.CollectionNames.locations);
  }

  static ordersCollection(businessId: string): FirebaseFirestore.CollectionReference {
    return this.ordersDoc(businessId).collection(Paths.CollectionNames.orders);
  }

  static eventsCollection(businessId: string): FirebaseFirestore.CollectionReference {
    return this.connectedAccountsDoc(businessId).collection(Paths.CollectionNames.events);
  }

  static tokensCollection(businessId: string): FirebaseFirestore.CollectionReference {
    return this.connectedAccountsDoc(businessId).collection(Paths.CollectionNames.tokens);
  }

  static onboardingOrdersCollection(businessId: string): FirebaseFirestore.CollectionReference {
    return this.onboardingDoc(businessId).collection(Paths.CollectionNames.onboardingOrders);
  }
}
```

---

### A.1.2 `src/domain/roots/Business.ts` — Domain model

```typescript
import { DomainEntity, DomainEntityProps } from '../DomainEntity';
import { BusinessProfile } from '../misc/BusinessProfile';

export enum BusinessType {
  restaurant = 'restaurant',
}

export enum Role {
  sysadmin = 'sysadmin',
  owner = 'owner',
}

export interface BusinessProps extends DomainEntityProps {
  agent: string;
  createdBy: string;
  type: BusinessType;
  businessProfile: BusinessProfile;
  roles: { [uid: string]: Role };
}

export class Business extends DomainEntity {
  agent: string;
  createdBy: string;
  type: BusinessType;
  businessProfile: BusinessProfile;
  roles: { [uid: string]: Role };

  constructor(props: BusinessProps) {
    super(props);
    this.agent = props.agent;
    this.createdBy = props.createdBy;
    this.type = props.type;
    this.businessProfile = props.businessProfile;
    this.roles = props.roles ?? {};
  }
}
```

**Key decisions:**
- **`BusinessType` and `Role` enums move to domain layer** — they are pure values. The old `Constants.Role` stays for backward compatibility until Part B cleanup.
- **`BusinessProfile` is now an interface** (from Phase 4's `src/domain/misc/BusinessProfile.ts`), not a class.
- **No singleton Id** — Business uses auto-generated IDs.

---

### A.1.3 `src/domain/roots/Catalog.ts` — Domain model

```typescript
import { DomainEntity, DomainEntityProps } from '../DomainEntity';

export interface CatalogProps extends DomainEntityProps {
  // Catalog is an empty root — only base fields
}

export class Catalog extends DomainEntity {
  constructor(props?: CatalogProps) {
    super(props ?? {});
  }
}
```

**Key decision:** Catalog has no domain fields. It's a structural anchor only. The domain model is minimal.

---

### A.1.4 `src/domain/roots/Surfaces.ts` — Domain model

```typescript
import { DomainEntity, DomainEntityProps } from '../DomainEntity';
import { MenuMeta } from '../surfaces/MenuMeta';
import { MenuGroupMeta } from '../surfaces/MenuGroupMeta';

export interface SurfacesProps extends DomainEntityProps {
  menus: { [id: string]: MenuMeta };
  menuGroups: { [id: string]: MenuGroupMeta };
}

export class Surfaces extends DomainEntity {
  menus: { [id: string]: MenuMeta };
  menuGroups: { [id: string]: MenuGroupMeta };

  constructor(props: SurfacesProps) {
    super(props);
    this.menus = props.menus ?? {};
    this.menuGroups = props.menuGroups ?? {};
  }
}
```

---

### A.1.5 `src/domain/roots/Orders.ts` — Domain model

```typescript
import { DomainEntity, DomainEntityProps } from '../DomainEntity';

export interface OrderSettingsProps extends DomainEntityProps {
  isSMSStateUpdate: boolean;
  isLoyaltyAccrue: boolean;
  isStateAutoNewToInProgress: boolean;
  gratuityRates: number[];
  isSquareDiscountCodeAPI: boolean;
  isSquareAutoApplyDiscounts: boolean;
  isSquareAutoApplyTaxes: boolean;
  isSquareDiscountCodeAutoEnabled: boolean;
  isKioskSessionIdleTimerOn: boolean;
  isFreeOrdersEnabled: boolean;
  isSingleLineItemsOnly: boolean;
  ticketHeaderFormat: { [orderType: string]: string } | null;
  smsReadyTextFormat: { [orderType: string]: string } | null;
  smsReceiptTextFormat: { [orderType: string]: string } | null;
}

const DEFAULT_GRATUITY_RATES = [10, 15, 20];

export class OrderSettings extends DomainEntity {
  isSMSStateUpdate: boolean;
  isLoyaltyAccrue: boolean;
  isStateAutoNewToInProgress: boolean;
  gratuityRates: number[];
  isSquareDiscountCodeAPI: boolean;
  isSquareAutoApplyDiscounts: boolean;
  isSquareAutoApplyTaxes: boolean;
  isSquareDiscountCodeAutoEnabled: boolean;
  isKioskSessionIdleTimerOn: boolean;
  isFreeOrdersEnabled: boolean;
  isSingleLineItemsOnly: boolean;
  ticketHeaderFormat: { [orderType: string]: string } | null;
  smsReadyTextFormat: { [orderType: string]: string } | null;
  smsReceiptTextFormat: { [orderType: string]: string } | null;

  constructor(props: OrderSettingsProps) {
    super(props);
    this.isSMSStateUpdate = props.isSMSStateUpdate;
    this.isLoyaltyAccrue = props.isLoyaltyAccrue;
    this.isStateAutoNewToInProgress = props.isStateAutoNewToInProgress;
    this.gratuityRates = props.gratuityRates ?? DEFAULT_GRATUITY_RATES;
    this.isSquareDiscountCodeAPI = props.isSquareDiscountCodeAPI ?? false;
    this.isSquareAutoApplyDiscounts = props.isSquareAutoApplyDiscounts ?? false;
    this.isSquareAutoApplyTaxes = props.isSquareAutoApplyTaxes ?? true;
    this.isSquareDiscountCodeAutoEnabled = props.isSquareDiscountCodeAutoEnabled ?? false;
    this.isKioskSessionIdleTimerOn = props.isKioskSessionIdleTimerOn ?? true;
    this.isFreeOrdersEnabled = props.isFreeOrdersEnabled ?? true;
    this.isSingleLineItemsOnly = props.isSingleLineItemsOnly ?? false;
    this.ticketHeaderFormat = props.ticketHeaderFormat ?? null;
    this.smsReadyTextFormat = props.smsReadyTextFormat ?? null;
    this.smsReceiptTextFormat = props.smsReceiptTextFormat ?? null;
  }
}
```

**Key decisions:**
- **Renamed from `Orders` to `OrderSettings`** — avoids collision with the `Order` entity from Phase 1. The old class name `Orders` is confusing (it's settings, not orders).
- **Format maps use `string` keys** instead of `OrderType` enum — decouples from `OrderSymbols`. Persistence layer handles mapping.

---

### A.1.6 `src/domain/roots/Locations.ts` — Domain model

```typescript
import { DomainEntity, DomainEntityProps } from '../DomainEntity';

export interface LocationMeta {
  name: string;
  isActive: boolean;
}

export interface LocationsRootProps extends DomainEntityProps {
  locations: { [id: string]: LocationMeta };
}

export class LocationsRoot extends DomainEntity {
  locations: { [id: string]: LocationMeta };

  constructor(props: LocationsRootProps) {
    super(props);
    this.locations = props.locations ?? {};
  }
}
```

**Key decisions:**
- **Renamed from `Locations` to `LocationsRoot`** — avoids collision with the `Location` entity from Phase 2.
- **`LocationMeta` is re-exported here** — it's the same shape as `src/restaurant/locations/LocationMeta.ts`. The domain version is the canonical one.

---

### A.1.7 `src/domain/roots/ConnectedAccounts.ts` — Domain model

```typescript
import { DomainEntity, DomainEntityProps } from '../DomainEntity';

export interface ConnectedAccountsProps extends DomainEntityProps {
  tokens: { [provider: string]: { [key: string]: string } };
}

export class ConnectedAccounts extends DomainEntity {
  tokens: { [provider: string]: { [key: string]: string } };

  constructor(props: ConnectedAccountsProps) {
    super(props);
    this.tokens = props.tokens ?? {};
  }
}
```

---

### A.1.8 `src/domain/roots/Services.ts` — Domain model

```typescript
import { DomainEntity, DomainEntityProps } from '../DomainEntity';

export interface ServicesProps extends DomainEntityProps {
  kioskFeeRate: number;
  experiments: { [key: string]: boolean };
}

export class Services extends DomainEntity {
  kioskFeeRate: number;
  experiments: { [key: string]: boolean };

  constructor(props: ServicesProps) {
    super(props);
    this.kioskFeeRate = props.kioskFeeRate ?? 1.5;
    this.experiments = props.experiments ?? {};
  }
}
```

---

### A.1.9 `src/domain/roots/Onboarding.ts` — Domain model

```typescript
import { DomainEntity, DomainEntityProps } from '../DomainEntity';

export enum OnboardingStage {
  createBusiness = 'createBusiness',
  squareIntegration = 'squareIntegration',
  categorySync = 'categorySync',
  scheduleMeeting = 'scheduleMeeting',
  configMenu = 'configMenu',
  menuCreate = 'menuCreate',
  onboardingSync = 'onboardingSync',
  shippingInfo = 'shippingInfo',
  kioskPurchase = 'kioskPurchase',
  kioskCheckout = 'kioskCheckout',
  previewKiosk = 'previewKiosk',
  onboardingComplete = 'onboardingComplete',
}

export enum OnboardingStageStatus {
  pending = 'pending',
  complete = 'complete',
  skipped = 'skipped',
}

export const DEFAULT_ONBOARDING_STATUS: { [stage in OnboardingStage]: OnboardingStageStatus } = {
  [OnboardingStage.createBusiness]: OnboardingStageStatus.pending,
  [OnboardingStage.squareIntegration]: OnboardingStageStatus.pending,
  [OnboardingStage.categorySync]: OnboardingStageStatus.pending,
  [OnboardingStage.scheduleMeeting]: OnboardingStageStatus.pending,
  [OnboardingStage.configMenu]: OnboardingStageStatus.pending,
  [OnboardingStage.menuCreate]: OnboardingStageStatus.pending,
  [OnboardingStage.onboardingSync]: OnboardingStageStatus.pending,
  [OnboardingStage.shippingInfo]: OnboardingStageStatus.pending,
  [OnboardingStage.kioskCheckout]: OnboardingStageStatus.pending,
  [OnboardingStage.previewKiosk]: OnboardingStageStatus.pending,
  [OnboardingStage.kioskPurchase]: OnboardingStageStatus.pending,
  [OnboardingStage.onboardingComplete]: OnboardingStageStatus.pending,
};

export interface OnboardingProps extends DomainEntityProps {
  stripeCustomerId: string | null;
  onboardingStatus: { [stage in OnboardingStage]?: OnboardingStageStatus } | null;
  onboardingOrderId: string | null;
  menuCategories: string[] | null;
}

export class Onboarding extends DomainEntity {
  stripeCustomerId: string | null;
  onboardingStatus: { [stage in OnboardingStage]?: OnboardingStageStatus };
  onboardingOrderId: string | null;
  menuCategories: string[] | null;

  constructor(props: OnboardingProps) {
    super(props);
    this.stripeCustomerId = props.stripeCustomerId ?? null;
    this.onboardingStatus = props.onboardingStatus ?? { ...DEFAULT_ONBOARDING_STATUS };
    this.onboardingOrderId = props.onboardingOrderId ?? null;
    this.menuCategories = props.menuCategories ?? null;
  }
}
```

**Key decisions:**
- **`OnboardingStage` and `OnboardingStageStatus` change from `const enum` to regular `enum`** — `const enum` is erased at compile time, can't be iterated or used in runtime lookups.
- **`DEFAULT_ONBOARDING_STATUS` is exported** — useful for consumers who need to create default onboarding state.
- **Business logic methods (`repair()`, `createMenu()`) stay in persistence/application layer** — they use Firestore queries and transactions. A future `OnboardingService` in the persistence layer would encapsulate this.

---

### A.1.10 Barrel Export — `src/domain/roots/index.ts`

```typescript
export { Business, BusinessProps, BusinessType, Role } from './Business';
export { Catalog, CatalogProps } from './Catalog';
export { Surfaces as SurfacesRoot, SurfacesProps } from './Surfaces';
export { OrderSettings, OrderSettingsProps } from './Orders';
export { LocationsRoot, LocationsRootProps, LocationMeta } from './Locations';
export { ConnectedAccounts as ConnectedAccountsRoot, ConnectedAccountsProps } from './ConnectedAccounts';
export { Services, ServicesProps } from './Services';
export {
  Onboarding, OnboardingProps, OnboardingStage, OnboardingStageStatus, DEFAULT_ONBOARDING_STATUS,
} from './Onboarding';
```

**Key decisions on naming:**
- **`SurfacesRoot`** — avoids collision with `Domain.Surfaces` (the surfaces entity namespace from Phase 4).
- **`ConnectedAccountsRoot`** — avoids collision with `Domain.ConnectedAccounts` (the namespace).
- **`LocationsRoot`** — avoids collision with Location entity.
- **`OrderSettings`** — clearer than `Orders`.

**Update `src/domain/index.ts`** — append:
```typescript
export * as Roots from './roots';
```

---

### A.1.11 Persistence — Root Repositories

Root repositories follow the same `FirestoreRepository<T>` pattern but with fixed document IDs for singletons.

**`src/persistence/firestore/BusinessRepository.ts`:**
```typescript
export class BusinessRepository extends FirestoreRepository<Business> {
  protected config(): FirestoreRepositoryConfig<Business> {
    return {
      collectionRef(_businessId: string) {
        return PathResolver.businessCollection();
      },
      toFirestore(business: Business): FirebaseFirestore.DocumentData {
        return {
          agent: business.agent,
          createdBy: business.createdBy,
          type: business.type,
          businessProfile: {
            name: business.businessProfile.name,
            address: business.businessProfile.address ?? null,
            shippingAddress: business.businessProfile.shippingAddress ?? null,
          },
          roles: JSON.parse(JSON.stringify(business.roles)),
          created: business.created.toISOString(),
          updated: business.updated.toISOString(),
          isDeleted: business.isDeleted,
        };
      },
      fromFirestore(data: FirebaseFirestore.DocumentData, id: string): Business {
        return new Business({
          Id: id,
          agent: data.agent,
          createdBy: data.createdBy,
          type: data.type,
          businessProfile: {
            name: data.businessProfile?.name ?? '',
            address: data.businessProfile?.address,
            shippingAddress: data.businessProfile?.shippingAddress,
          },
          roles: data.roles ?? {},
          created: new Date(data.created),
          updated: new Date(data.updated),
          isDeleted: data.isDeleted,
        });
      },
    };
  }
}
```

**Note on Business:** The `get()` method uses the entity's own `Id` as the `businessId` parameter, since Business is the top-level document. `collectionRef` ignores the `businessId` param.

**`src/persistence/firestore/CatalogRootRepository.ts`:**
```typescript
export class CatalogRootRepository extends FirestoreRepository<Catalog> {
  protected config(): FirestoreRepositoryConfig<Catalog> {
    return {
      collectionRef(businessId: string) {
        return PathResolver.publicCollection(businessId);
      },
      toFirestore(catalog: Catalog): FirebaseFirestore.DocumentData {
        return {
          created: catalog.created.toISOString(),
          updated: catalog.updated.toISOString(),
          isDeleted: catalog.isDeleted,
        };
      },
      fromFirestore(data: FirebaseFirestore.DocumentData, id: string): Catalog {
        return new Catalog({
          Id: id,
          created: new Date(data.created),
          updated: new Date(data.updated),
          isDeleted: data.isDeleted,
        });
      },
    };
  }
}
```

**`src/persistence/firestore/SurfacesRootRepository.ts`:**
```typescript
export class SurfacesRootRepository extends FirestoreRepository<SurfacesRoot> {
  protected config(): FirestoreRepositoryConfig<SurfacesRoot> {
    return {
      collectionRef(businessId: string) {
        return PathResolver.publicCollection(businessId);
      },
      toFirestore(surfaces: SurfacesRoot): FirebaseFirestore.DocumentData {
        return {
          menus: JSON.parse(JSON.stringify(surfaces.menus)),
          menuGroups: JSON.parse(JSON.stringify(surfaces.menuGroups)),
          created: surfaces.created.toISOString(),
          updated: surfaces.updated.toISOString(),
          isDeleted: surfaces.isDeleted,
        };
      },
      fromFirestore(data: FirebaseFirestore.DocumentData, id: string): SurfacesRoot {
        return new SurfacesRoot({
          Id: id,
          menus: data.menus ?? {},
          menuGroups: data.menuGroups ?? {},
          created: new Date(data.created),
          updated: new Date(data.updated),
          isDeleted: data.isDeleted,
        });
      },
    };
  }
}
```

**`src/persistence/firestore/OrderSettingsRepository.ts`:**
```typescript
export class OrderSettingsRepository extends FirestoreRepository<OrderSettings> {
  protected config(): FirestoreRepositoryConfig<OrderSettings> {
    return {
      collectionRef(businessId: string) {
        return PathResolver.privateCollection(businessId);
      },
      toFirestore(os: OrderSettings): FirebaseFirestore.DocumentData {
        return {
          isSMSStateUpdate: os.isSMSStateUpdate,
          isLoyaltyAccrue: os.isLoyaltyAccrue,
          isStateAutoNewToInProgress: os.isStateAutoNewToInProgress,
          gratuityRates: JSON.parse(JSON.stringify(os.gratuityRates)),
          isSquareDiscountCodeAPI: os.isSquareDiscountCodeAPI,
          isSquareAutoApplyDiscounts: os.isSquareAutoApplyDiscounts,
          isSquareAutoApplyTaxes: os.isSquareAutoApplyTaxes,
          isSquareDiscountCodeAutoEnabled: os.isSquareDiscountCodeAutoEnabled,
          isKioskSessionIdleTimerOn: os.isKioskSessionIdleTimerOn,
          isFreeOrdersEnabled: os.isFreeOrdersEnabled,
          isSingleLineItemsOnly: os.isSingleLineItemsOnly,
          ticketHeaderFormat: os.ticketHeaderFormat,
          smsReadyTextFormat: os.smsReadyTextFormat,
          smsReceiptTextFormat: os.smsReceiptTextFormat,
          created: os.created.toISOString(),
          updated: os.updated.toISOString(),
          isDeleted: os.isDeleted,
        };
      },
      fromFirestore(data: FirebaseFirestore.DocumentData, id: string): OrderSettings {
        return new OrderSettings({
          Id: id,
          isSMSStateUpdate: data.isSMSStateUpdate,
          isLoyaltyAccrue: data.isLoyaltyAccrue ?? true,
          isStateAutoNewToInProgress: data.isStateAutoNewToInProgress ?? false,
          gratuityRates: data.gratuityRates ?? null,
          isSquareDiscountCodeAPI: data.isSquareDiscountCodeAPI ?? null,
          isSquareAutoApplyDiscounts: data.isSquareAutoApplyDiscounts ?? null,
          isSquareAutoApplyTaxes: data.isSquareAutoApplyTaxes ?? null,
          isSquareDiscountCodeAutoEnabled: data.isSquareDiscountCodeAutoEnabled ?? null,
          isKioskSessionIdleTimerOn: data.isKioskSessionIdleTimerOn ?? null,
          isFreeOrdersEnabled: data.isFreeOrdersEnabled ?? null,
          isSingleLineItemsOnly: data.isSingleLineItemsOnly ?? null,
          ticketHeaderFormat: data.ticketHeaderFormat ?? null,
          smsReadyTextFormat: data.smsReadyTextFormat ?? null,
          smsReceiptTextFormat: data.smsReceiptTextFormat ?? null,
          created: new Date(data.created),
          updated: new Date(data.updated),
          isDeleted: data.isDeleted,
        });
      },
    };
  }
}
```

**`src/persistence/firestore/LocationsRootRepository.ts`:**
```typescript
export class LocationsRootRepository extends FirestoreRepository<LocationsRoot> {
  protected config(): FirestoreRepositoryConfig<LocationsRoot> {
    return {
      collectionRef(businessId: string) {
        return PathResolver.publicCollection(businessId);
      },
      toFirestore(lr: LocationsRoot): FirebaseFirestore.DocumentData {
        return {
          locations: JSON.parse(JSON.stringify(lr.locations)),
          created: lr.created.toISOString(),
          updated: lr.updated.toISOString(),
          isDeleted: lr.isDeleted,
        };
      },
      fromFirestore(data: FirebaseFirestore.DocumentData, id: string): LocationsRoot {
        return new LocationsRoot({
          Id: id,
          locations: data.locations ?? {},
          created: new Date(data.created),
          updated: new Date(data.updated),
          isDeleted: data.isDeleted,
        });
      },
    };
  }
}
```

**`src/persistence/firestore/ConnectedAccountsRootRepository.ts`:**
```typescript
export class ConnectedAccountsRootRepository extends FirestoreRepository<ConnectedAccountsRoot> {
  protected config(): FirestoreRepositoryConfig<ConnectedAccountsRoot> {
    return {
      collectionRef(businessId: string) {
        return PathResolver.privateCollection(businessId);
      },
      toFirestore(ca: ConnectedAccountsRoot): FirebaseFirestore.DocumentData {
        return {
          tokens: JSON.parse(JSON.stringify(ca.tokens)),
          created: ca.created.toISOString(),
          updated: ca.updated.toISOString(),
          isDeleted: ca.isDeleted,
        };
      },
      fromFirestore(data: FirebaseFirestore.DocumentData, id: string): ConnectedAccountsRoot {
        return new ConnectedAccountsRoot({
          Id: id,
          tokens: data.tokens ?? {},
          created: new Date(data.created),
          updated: new Date(data.updated),
          isDeleted: data.isDeleted,
        });
      },
    };
  }
}
```

**`src/persistence/firestore/ServicesRepository.ts`:**
```typescript
export class ServicesRepository extends FirestoreRepository<Services> {
  protected config(): FirestoreRepositoryConfig<Services> {
    return {
      collectionRef(businessId: string) {
        return PathResolver.privateCollection(businessId);
      },
      toFirestore(svc: Services): FirebaseFirestore.DocumentData {
        return {
          kioskFeeRate: svc.kioskFeeRate,
          experiments: svc.experiments,
          created: svc.created.toISOString(),
          updated: svc.updated.toISOString(),
          isDeleted: svc.isDeleted,
        };
      },
      fromFirestore(data: FirebaseFirestore.DocumentData, id: string): Services {
        return new Services({
          Id: id,
          kioskFeeRate: data.kioskFeeRate,
          experiments: data.experiments ?? {},
          created: new Date(data.created),
          updated: new Date(data.updated),
          isDeleted: data.isDeleted,
        });
      },
    };
  }
}
```

**`src/persistence/firestore/OnboardingRepository.ts`:**
```typescript
export class OnboardingRepository extends FirestoreRepository<Onboarding> {
  protected config(): FirestoreRepositoryConfig<Onboarding> {
    return {
      collectionRef(businessId: string) {
        return PathResolver.privateCollection(businessId);
      },
      toFirestore(ob: Onboarding): FirebaseFirestore.DocumentData {
        return {
          stripeCustomerId: ob.stripeCustomerId,
          onboardingStatus: ob.onboardingStatus,
          onboardingOrderId: ob.onboardingOrderId ?? null,
          created: ob.created.toISOString(),
          updated: ob.updated.toISOString(),
          isDeleted: ob.isDeleted,
        };
      },
      fromFirestore(data: FirebaseFirestore.DocumentData, id: string): Onboarding {
        return new Onboarding({
          Id: id,
          stripeCustomerId: data.stripeCustomerId ?? null,
          onboardingStatus: data.onboardingStatus ?? null,
          onboardingOrderId: data.onboardingOrderId ?? null,
          menuCategories: data.menuCategories ?? null,
          created: new Date(data.created),
          updated: new Date(data.updated),
          isDeleted: data.isDeleted,
        });
      },
    };
  }
}
```

---

### A.1.12 BusinessUtilities — `createBusiness` Refactored

The old `createBusiness()` creates 8 root documents in one transaction. The new version uses domain models and repositories.

**`src/persistence/firestore/BusinessFactory.ts`:**
```typescript
import { getFirestore } from 'firebase-admin/firestore';
import { Business, BusinessType, Role } from '../../domain/roots/Business';
import { Catalog } from '../../domain/roots/Catalog';
import { Onboarding } from '../../domain/roots/Onboarding';
import { OrderSettings } from '../../domain/roots/Orders';
import { Services } from '../../domain/roots/Services';
import { LocationsRoot } from '../../domain/roots/Locations';
import { ConnectedAccounts as ConnectedAccountsRoot } from '../../domain/roots/ConnectedAccounts';
import { Surfaces as SurfacesRoot } from '../../domain/roots/Surfaces';
import { PathResolver } from './PathResolver';
import * as Paths from '../../firestore-core/Paths';

const FEATURELIST_PATH = '/_firebase_ext_/defaultFeatureList';

export interface CreateBusinessInput {
  uid: string;
  device: string;
  type: BusinessType;
  name?: string;
}

/**
 * Creates a new business with all root aggregate documents.
 * Replaces BusinessUtilities.createBusiness().
 */
export async function createBusiness(input: CreateBusinessInput): Promise<string> {
  const { uid, device, type, name } = input;
  const now = new Date();

  const business = new Business({
    agent: device,
    createdBy: uid,
    type,
    businessProfile: { name: name ?? '' },
    roles: { [uid]: Role.owner },
  });

  const businessId = business.Id;

  const catalog = new Catalog({ Id: Paths.CollectionNames.catalog });
  const connectedAccounts = new ConnectedAccountsRoot({ tokens: {}, Id: Paths.CollectionNames.connectedAccounts });
  const surfaces = new SurfacesRoot({ menus: {}, menuGroups: {}, Id: Paths.CollectionNames.surfaces });
  const onboarding = new Onboarding({
    stripeCustomerId: null,
    onboardingStatus: null,
    onboardingOrderId: null,
    menuCategories: null,
    Id: Paths.CollectionNames.onboarding,
  });
  const orderSettings = new OrderSettings({
    isSMSStateUpdate: true,
    isLoyaltyAccrue: false,
    isStateAutoNewToInProgress: false,
    gratuityRates: [10, 15, 20],
    isSquareDiscountCodeAPI: false,
    isSquareAutoApplyDiscounts: false,
    isSquareAutoApplyTaxes: true,
    isSquareDiscountCodeAutoEnabled: false,
    isKioskSessionIdleTimerOn: true,
    isFreeOrdersEnabled: true,
    isSingleLineItemsOnly: false,
    ticketHeaderFormat: null,
    smsReadyTextFormat: null,
    smsReceiptTextFormat: null,
    Id: Paths.CollectionNames.orders,
  });
  const services = new Services({
    kioskFeeRate: 1.5,
    experiments: {},
    Id: Paths.CollectionNames.services,
  });
  const locationsRoot = new LocationsRoot({ locations: {}, Id: Paths.CollectionNames.locations });

  await getFirestore().runTransaction(async (t) => {
    // Feature list
    const featureListQuery = getFirestore().doc(FEATURELIST_PATH);
    const featureList = await t.get(featureListQuery).then((d) => d.data());

    // Use repository toFirestore converters inline
    t.set(PathResolver.businessDoc(businessId), businessToFirestore(business));
    t.set(PathResolver.catalogDoc(businessId), rootToFirestore(catalog));
    t.set(PathResolver.connectedAccountsDoc(businessId), connectedAccountsToFirestore(connectedAccounts));
    t.set(PathResolver.surfacesDoc(businessId), surfacesToFirestore(surfaces));
    t.set(PathResolver.onboardingDoc(businessId), onboardingToFirestore(onboarding));
    t.set(PathResolver.ordersDoc(businessId), orderSettingsToFirestore(orderSettings));
    t.set(PathResolver.servicesDoc(businessId), servicesToFirestore(services));
    t.set(PathResolver.locationsDoc(businessId), locationsRootToFirestore(locationsRoot));

    if (featureList) {
      const update = {
        created: now.toISOString(),
        isDeleted: false,
        locationId: null,
        updated: now.toISOString(),
        enabled: { ...featureList },
      };
      const featureListPath = `/businesses/${businessId}/featurelist`;
      t.set(getFirestore().collection(featureListPath).doc(), update);
    }
  });

  return businessId;
}

// Private serialization helpers (extracted from repository configs)
function businessToFirestore(b: Business) { /* ... same as BusinessRepository.toFirestore ... */ }
function rootToFirestore(c: Catalog) { /* ... base fields only ... */ }
function connectedAccountsToFirestore(ca: ConnectedAccountsRoot) { /* ... */ }
function surfacesToFirestore(s: SurfacesRoot) { /* ... */ }
function onboardingToFirestore(ob: Onboarding) { /* ... */ }
function orderSettingsToFirestore(os: OrderSettings) { /* ... */ }
function servicesToFirestore(svc: Services) { /* ... */ }
function locationsRootToFirestore(lr: LocationsRoot) { /* ... */ }
```

**Key decisions:**
- **Takes `CreateBusinessInput` instead of `User`** — decouples from the auth module. Caller extracts `uid` from the user.
- **Returns `businessId: string`** instead of a Firestore `DocumentReference` — decouples from Firestore types.
- **Uses `PathResolver`** for all document references.
- **Serialization helpers are private functions** — not full repository instances. The transaction creates all docs inline.

---

### A.1.13 Barrel Export Updates

**Update `src/persistence/firestore/index.ts`** — append:
```typescript
export { PathResolver } from './PathResolver';
export { BusinessRepository } from './BusinessRepository';
export { CatalogRootRepository } from './CatalogRootRepository';
export { SurfacesRootRepository } from './SurfacesRootRepository';
export { OrderSettingsRepository } from './OrderSettingsRepository';
export { LocationsRootRepository } from './LocationsRootRepository';
export { ConnectedAccountsRootRepository } from './ConnectedAccountsRootRepository';
export { ServicesRepository } from './ServicesRepository';
export { OnboardingRepository } from './OnboardingRepository';
export { createBusiness, CreateBusinessInput } from './BusinessFactory';
```

---

### A.1.14 Deprecation Markers

| File | Deprecation target |
|------|-------------------|
| `src/restaurant/roots/Business.ts` | Class + static methods — `@deprecated Use Domain.Roots.Business` |
| `src/restaurant/roots/Catalog.ts` | Class + static methods — `@deprecated Use Domain.Roots.Catalog` |
| `src/restaurant/roots/Surfaces.ts` | Class + static methods — `@deprecated Use Domain.Roots.SurfacesRoot` |
| `src/restaurant/roots/Orders.ts` | Class + static methods — `@deprecated Use Domain.Roots.OrderSettings` |
| `src/restaurant/roots/Locations.ts` | Class + static methods — `@deprecated Use Domain.Roots.LocationsRoot` |
| `src/restaurant/roots/ConnectedAccounts.ts` | Class + static methods — `@deprecated Use Domain.Roots.ConnectedAccountsRoot` |
| `src/restaurant/roots/Services.ts` | Class + static methods — `@deprecated Use Domain.Roots.Services` |
| `src/restaurant/roots/Onboarding.ts` | Class (not `repair()`/`createMenu()` — those stay) — `@deprecated Use Domain.Roots.Onboarding` |
| `src/restaurant/roots/BusinessUtilities.ts` | Function — `@deprecated Use Persistence.createBusiness()` |
| `src/restaurant/misc/BusinessProfile.ts` | Class — `@deprecated Use Domain.Misc.BusinessProfile` |
| `src/restaurant/locations/LocationMeta.ts` | Interface — `@deprecated Use Domain.Roots.LocationMeta` |

---

# PART B — Cleanup & Major Version Bump

## B.1 Implementation Spec

### B.1.1 Migrate Child Repository Imports to PathResolver

All child repositories (Phases 1–4) currently reference old root classes for path resolution:
```typescript
// Old pattern (in OptionRepository)
import Catalog from '../../restaurant/roots/Catalog';
// ...
collectionRef(businessId) {
  return Catalog.docRef(businessId).collection('options');
}
```

Replace with `PathResolver`:
```typescript
// New pattern
import { PathResolver } from './PathResolver';
// ...
collectionRef(businessId) {
  return PathResolver.optionsCollection(businessId);
}
```

**Repositories to update:**

| Repository | Old Import | New Call |
|-----------|-----------|---------|
| `OptionRepository` | `Catalog.docRef(biz).collection('options')` | `PathResolver.optionsCollection(biz)` |
| `OptionSetRepository` | `Catalog.docRef(biz).collection('optionSets')` | `PathResolver.optionSetsCollection(biz)` |
| `ProductRepository` | `Catalog.docRef(biz).collection('products')` | `PathResolver.productsCollection(biz)` |
| `CategoryRepository` | `Catalog.docRef(biz).collection('categories')` | `PathResolver.categoriesCollection(biz)` |
| `TaxRateRepository` | `Catalog.docRef(biz).collection('taxRates')` | `PathResolver.taxRatesCollection(biz)` |
| `DiscountRepository` | `Catalog.docRef(biz).collection('discounts')` | `PathResolver.discountsCollection(biz)` |
| `ServiceChargeRepository` | `Catalog.docRef(biz).collection('serviceCharges')` | `PathResolver.serviceChargesCollection(biz)` |
| `MenuRepository` | `Surfaces.docRef(biz).collection('menus')` | `PathResolver.menusCollection(biz)` |
| `MenuGroupRepository` | `Surfaces.docRef(biz).collection('menuGroups')` | `PathResolver.menuGroupsCollection(biz)` |
| `SurfaceConfigurationRepository` | `Surfaces.docRef(biz).collection('surfaceConfigurations')` | `PathResolver.surfaceConfigurationsCollection(biz)` |
| `KioskConfigurationRepository` | `Surfaces.docRef(biz).collection('kioskConfigurations')` | `PathResolver.kioskConfigurationsCollection(biz)` |
| `CheckoutOptionsRepository` | `Surfaces.docRef(biz).collection('checkoutOptions')` | `PathResolver.checkoutOptionsCollection(biz)` |
| `TokenRepository` | `ConnectedAccounts.docRef(biz).collection('tokens')` | `PathResolver.tokensCollection(biz)` |
| `EventRepository` | `ConnectedAccounts.docRef(biz).collection('events')` | `PathResolver.eventsCollection(biz)` |
| `OrderRepository` | `Orders.docRef(biz).collection('orders')` | `PathResolver.ordersCollection(biz)` |
| `LocationRepository` | `Locations.docRef(biz).collection('locations')` | `PathResolver.locationsCollection(biz)` |
| `OnboardingOrderRepository` | `Onboarding.docRef(biz).collection('onboardingOrders')` | `PathResolver.onboardingOrdersCollection(biz)` |

Also update:
- `MenuMetadataSpec` — replace `Surfaces.docRef(biz)` with `PathResolver.surfacesDoc(biz)`
- `MenuGroupMetadataSpec` — same
- `LocationMetadataSpec` — replace with `PathResolver.locationsDoc(biz)`
- Relationship handlers (`OptionRelationshipHandler`, `OptionSetRelationshipHandler`, `ProductRelationshipHandler`) — replace `Catalog.docRef(biz)` with `PathResolver.catalogDoc(biz)`

---

### B.1.2 Delete Deprecated Files

**Delete these files entirely:**

```
src/firestore-core/core/FirestoreObject.ts
src/firestore-core/core/FirestoreObjectV2.ts
src/firestore-core/core/FirestoreWriter.ts
src/firestore-core/core/LinkedObject.ts
src/firestore-core/core/LinkedObjectType.ts
src/firestore-core/core/LinkedObjectUtilities.ts
src/restaurant/catalog/Product.ts
src/restaurant/catalog/Category.ts
src/restaurant/catalog/Option.ts
src/restaurant/catalog/OptionSet.ts
src/restaurant/catalog/TaxRate.ts
src/restaurant/catalog/Discount.ts
src/restaurant/catalog/ServiceCharge.ts
src/restaurant/catalog/InventoryCount.ts
src/restaurant/catalog/ProductMeta.ts
src/restaurant/catalog/CategoryMeta.ts
src/restaurant/catalog/OptionMeta.ts
src/restaurant/catalog/OptionSetMeta.ts
src/restaurant/surfaces/Menu.ts
src/restaurant/surfaces/MenuGroup.ts
src/restaurant/surfaces/MenuMeta.ts
src/restaurant/surfaces/MenuGroupMeta.ts
src/restaurant/surfaces/SurfaceConfiguration.ts
src/restaurant/surfaces/KioskConfiguration.ts
src/restaurant/surfaces/CheckoutOptions.ts
src/restaurant/roots/Business.ts
src/restaurant/roots/BusinessUtilities.ts
src/restaurant/roots/Catalog.ts
src/restaurant/roots/Surfaces.ts
src/restaurant/roots/Orders.ts
src/restaurant/roots/Locations.ts
src/restaurant/roots/ConnectedAccounts.ts
src/restaurant/roots/Services.ts
src/restaurant/roots/Onboarding.ts
src/restaurant/connected-accounts/Event.ts
src/restaurant/connected-accounts/Token.ts
src/restaurant/locations/Location.ts
src/restaurant/locations/LocationMeta.ts
src/restaurant/orders/OrderV3.ts
src/restaurant/orders/OrderSymbols.ts
src/restaurant/misc/BusinessProfile.ts
src/restaurant/misc/Address.ts
src/restaurant/onboarding/OnboardingOrder.ts
```

**Keep these files:**
```
src/firestore-core/Paths.ts               # Pure constants, used by PathResolver
src/firestore-core/Constants.ts            # Provider, Role, Semaphore enums
src/firestore-core/index.ts               # Update to export only Paths + Constants
src/restaurant/connected-accounts/EventNotification.ts  # RTDB, not migrated
src/restaurant/vars/SemaphoreV2.ts         # RTDB, not migrated
```

---

### B.1.3 Update `src/firestore-core/index.ts`

**Before:** Exports `FirestoreObject`, `FirestoreObjectV2`, `FirestoreWriter`, `LinkedObject`, etc.

**After:**
```typescript
export * as Paths from './Paths';
export * as Constants from './Constants';
```

All other exports removed.

---

### B.1.4 Update `src/index.ts` — New Barrel Export

```typescript
// Domain layer — pure models
export * as Domain from './domain';

// Persistence layer — repositories, registries, path resolver
export * as Persistence from './persistence';

// Infrastructure — Firestore path constants & enums
export * as Paths from './firestore-core/Paths';
export * as Constants from './firestore-core/Constants';

// Auth & User — unchanged
export * as Authentication from './user/Authentication';
export * as Claims from './user/Claims';
export * as User from './user/User';

// Utils — unchanged
export * as Utils from './utils';

// Reports — unchanged
export * as Reports from './reports';

// RTDB modules — not migrated, kept as-is
export { default as EventNotification } from './restaurant/connected-accounts/EventNotification';
export { default as SemaphoreV2 } from './restaurant/vars/SemaphoreV2';
```

**What's removed from `src/index.ts`:**
- All individual model exports (Category, Product, Menu, etc.)
- All old root exports (Catalog, Surfaces, Orders, etc.)
- LinkedObject, LinkedObjectType, LinkedObjectSync
- Core namespace export
- All re-exports from `src/restaurant/`

**Migration path for consumers:**

| Old Import | New Import |
|-----------|-----------|
| `import { Category } from '@kiosinc/restaurant-core'` | `import { Domain } from '@kiosinc/restaurant-core'; const { Category } = Domain.Catalog;` |
| `import { Product } from '@kiosinc/restaurant-core'` | `import { Domain } from '@kiosinc/restaurant-core'; const { Product } = Domain.Catalog;` |
| `import { Menu } from '@kiosinc/restaurant-core'` | `import { Domain } from '@kiosinc/restaurant-core'; const { Menu } = Domain.Surfaces;` |
| `import { Catalog } from '@kiosinc/restaurant-core'` | `import { Domain } from '@kiosinc/restaurant-core'; const { Catalog } = Domain.Roots;` |
| `import { Business, createBusiness } from '...'` | `import { Domain, Persistence } from '...'; const { Business } = Domain.Roots; const { createBusiness } = Persistence;` |
| `import { Location, LocationProps } from '...'` | `import { Domain } from '...'; const { Location } = Domain.Locations;` |
| `import { OrderV3 } from '...'` | `import { Domain } from '...'; const { Order } = Domain.Orders;` |
| `import { Constants } from '...'` | `import { Constants } from '...';` (unchanged) |
| `import { LinkedObject } from '...'` | `import { Domain } from '...'; const { LinkedObjectRef } = Domain;` |

---

### B.1.5 Clean Up Empty Directories

After deleting deprecated files, remove empty directories:

```
src/restaurant/catalog/        (delete if empty)
src/restaurant/surfaces/       (delete if empty)
src/restaurant/roots/          (delete if empty)
src/restaurant/locations/      (delete if empty)
src/restaurant/orders/         (delete if empty)
src/restaurant/misc/           (delete if empty)
src/restaurant/onboarding/     (delete if empty)
src/firestore-core/core/       (delete if empty)
```

**Remaining directory structure after cleanup:**
```
src/
├── domain/              # Pure domain models (Phase 0-5)
├── persistence/         # Repositories, registry, path resolver
├── firestore-core/      # Paths.ts, Constants.ts only
├── restaurant/
│   ├── connected-accounts/
│   │   └── EventNotification.ts   # RTDB, kept
│   └── vars/
│       └── SemaphoreV2.ts         # RTDB, kept
├── user/                # Auth middleware, unchanged
├── reports/             # Report models, unchanged
├── utils/               # Utility functions, unchanged
└── index.ts             # Updated barrel export
```

---

### B.1.6 Version Bump

- Update `package.json` version to next major (e.g., `3.0.0` or whatever the next major is)
- Add `MIGRATION.md` documenting import path changes for consumers

---

## 2. Testing Spec

### 2.1 Test Cases — Domain Layer (Part A)

#### `src/domain/roots/__tests__/Business.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | Constructs with all props | All fields match input |
| 2 | Auto-generates UUID | Matches UUID pattern |
| 3 | BusinessType enum has expected values | `restaurant` |
| 4 | Role enum has expected values | `sysadmin`, `owner` |
| 5 | Defaults roles to {} | Empty object |
| 6 | Stores BusinessProfile | Nested structure accessible |
| 7 | Inherits DomainEntity fields | Has base fields |
| 8 | Instantiates without Firebase | Test passing = proof |

#### `src/domain/roots/__tests__/Catalog.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | Constructs with no args | Default props used |
| 2 | Constructs with explicit props | Fields match |
| 3 | Inherits DomainEntity fields | Has base fields |
| 4 | Instantiates without Firebase | Test passing = proof |

#### `src/domain/roots/__tests__/Surfaces.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | Constructs with all props | All fields match input |
| 2 | Defaults menus to {} | Empty object |
| 3 | Defaults menuGroups to {} | Empty object |
| 4 | menus stores MenuMeta | Nested structure accessible |
| 5 | menuGroups stores MenuGroupMeta | Nested structure accessible |
| 6 | Instantiates without Firebase | Test passing = proof |

#### `src/domain/roots/__tests__/OrderSettings.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | Constructs with all props | All fields match input |
| 2 | Defaults gratuityRates to [10, 15, 20] | Default array |
| 3 | Defaults isSquareAutoApplyTaxes to true | `true` |
| 4 | Defaults isKioskSessionIdleTimerOn to true | `true` |
| 5 | Defaults isFreeOrdersEnabled to true | `true` |
| 6 | Defaults other booleans to false | All false |
| 7 | Defaults format maps to null | All null |
| 8 | Instantiates without Firebase | Test passing = proof |

#### `src/domain/roots/__tests__/LocationsRoot.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | Constructs with all props | All fields match |
| 2 | Defaults locations to {} | Empty object |
| 3 | LocationMeta interface works | Object literal satisfies |
| 4 | Instantiates without Firebase | Test passing = proof |

#### `src/domain/roots/__tests__/ConnectedAccounts.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | Constructs with all props | All fields match |
| 2 | Defaults tokens to {} | Empty object |
| 3 | Instantiates without Firebase | Test passing = proof |

#### `src/domain/roots/__tests__/Services.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | Constructs with all props | All fields match |
| 2 | Defaults kioskFeeRate to 1.5 | Number match |
| 3 | Defaults experiments to {} | Empty object |
| 4 | Instantiates without Firebase | Test passing = proof |

#### `src/domain/roots/__tests__/Onboarding.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | Constructs with all props | All fields match input |
| 2 | Defaults onboardingStatus to DEFAULT_ONBOARDING_STATUS | All stages pending |
| 3 | OnboardingStage enum has all 12 values | Enum iterable |
| 4 | OnboardingStageStatus enum has 3 values | pending, complete, skipped |
| 5 | Defaults stripeCustomerId to null | Null |
| 6 | Defaults onboardingOrderId to null | Null |
| 7 | Defaults menuCategories to null | Null |
| 8 | Instantiates without Firebase | Test passing = proof |

---

### 2.2 Test Cases — Persistence Layer (Part A)

#### `src/persistence/firestore/__tests__/PathResolver.test.ts`

Uses `vi.mock('firebase-admin/firestore')`.

| # | Test | Assertion |
|---|------|-----------|
| 1 | businessDoc returns correct path | `businesses/{id}` |
| 2 | publicCollection returns correct path | `businesses/{id}/public` |
| 3 | privateCollection returns correct path | `businesses/{id}/private` |
| 4 | catalogDoc returns correct path | `businesses/{id}/public/catalog` |
| 5 | surfacesDoc returns correct path | `businesses/{id}/public/surfaces` |
| 6 | ordersDoc returns correct path | `businesses/{id}/private/orders` |
| 7 | productsCollection returns correct path | `businesses/{id}/public/catalog/products` |
| 8 | menusCollection returns correct path | `businesses/{id}/public/surfaces/menus` |
| 9 | eventsCollection returns correct path | `businesses/{id}/private/connectedAccounts/events` |
| 10 | taxRatesCollection returns correct path | `businesses/{id}/public/catalog/taxRates` |
| 11 | discountsCollection returns correct path | `businesses/{id}/public/catalog/discounts` |
| 12 | serviceChargesCollection returns correct path | `businesses/{id}/public/catalog/serviceCharges` |
| 13 | surfaceConfigurationsCollection returns correct path | Expected path |
| 14 | kioskConfigurationsCollection returns correct path | Expected path |
| 15 | checkoutOptionsCollection returns correct path | Expected path |
| 16 | onboardingOrdersCollection returns correct path | Expected path |

#### `src/persistence/firestore/__tests__/BusinessRepository.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | get() returns Business when exists | All fields populated |
| 2 | get() returns null when missing | `null` returned |
| 3 | set() serializes BusinessProfile | Nested object correct |
| 4 | Round-trip preserves data | All fields match |

#### `src/persistence/firestore/__tests__/CatalogRootRepository.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | get() returns Catalog when exists | Base fields populated |
| 2 | set() serializes base fields only | No extra fields |
| 3 | Round-trip preserves data | All fields match |

#### `src/persistence/firestore/__tests__/OrderSettingsRepository.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | get() returns OrderSettings when exists | All 14 fields populated |
| 2 | set() serializes all fields | DocumentData shape matches |
| 3 | fromFirestore applies defaults | Missing fields get defaults |
| 4 | Round-trip preserves data | All fields match |

#### `src/persistence/firestore/__tests__/SurfacesRootRepository.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | get() returns SurfacesRoot when exists | menus and menuGroups populated |
| 2 | set() deep-clones menus and menuGroups | JSON round-tripped |
| 3 | Round-trip preserves data | All fields match |

#### Other root repository tests follow the same pattern (3-4 tests each):
- `LocationsRootRepository.test.ts` (3 tests)
- `ConnectedAccountsRootRepository.test.ts` (3 tests)
- `ServicesRepository.test.ts` (3 tests)
- `OnboardingRepository.test.ts` (4 tests)

#### `src/persistence/firestore/__tests__/BusinessFactory.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | Creates Business with correct fields | agent, createdBy, type, roles match |
| 2 | Creates all 8 root documents | transaction.set called 8 times |
| 3 | Sets feature list when available | 9th t.set call |
| 4 | Returns businessId string | Not a DocumentReference |
| 5 | Skips feature list when missing | Only 8 t.set calls |

---

### 2.3 Test Cases — Part B (Cleanup Verification)

#### `src/__tests__/index.test.ts` — Updated Barrel Export Tests

| # | Test | Assertion |
|---|------|-----------|
| 1 | Domain namespace exports all subdomains | Catalog, Surfaces, Orders, Locations, ConnectedAccounts, Roots, Onboarding, Misc |
| 2 | Persistence namespace exports all repositories | All repository classes accessible |
| 3 | Persistence exports PathResolver | Accessible |
| 4 | Persistence exports createBusiness | Function accessible |
| 5 | Constants namespace exports Provider, Role, Semaphore | Enum values accessible |
| 6 | Paths namespace exports CollectionNames, Environment | Constants accessible |
| 7 | Authentication namespace exports | Functions accessible |
| 8 | Utils namespace exports | Functions accessible |
| 9 | Reports namespace exports | Classes accessible |
| 10 | EventNotification accessible | Class accessible |
| 11 | SemaphoreV2 accessible | Class accessible |

### 2.4 Compile-Time Verification

| # | Check | Method |
|---|-------|--------|
| 1 | No references to deleted files | `npm run tsc` passes |
| 2 | No circular dependencies | `npm run tsc` passes |
| 3 | No unused imports | `npx eslint src/` passes |

---

## 3. Implementation & Testing Tracker

### Part A — Domain Layer Code

- [ ] Create `src/domain/roots/` directory
- [ ] `src/domain/roots/Business.ts` — BusinessType, Role enums, BusinessProps, Business class
- [ ] `src/domain/roots/Catalog.ts` — CatalogProps, Catalog class
- [ ] `src/domain/roots/Surfaces.ts` — SurfacesProps, Surfaces class
- [ ] `src/domain/roots/Orders.ts` — OrderSettingsProps, OrderSettings class
- [ ] `src/domain/roots/Locations.ts` — LocationMeta, LocationsRootProps, LocationsRoot class
- [ ] `src/domain/roots/ConnectedAccounts.ts` — ConnectedAccountsProps, ConnectedAccounts class
- [ ] `src/domain/roots/Services.ts` — ServicesProps, Services class
- [ ] `src/domain/roots/Onboarding.ts` — enums, DEFAULT_ONBOARDING_STATUS, OnboardingProps, Onboarding class
- [ ] `src/domain/roots/index.ts` — barrel export
- [ ] Update `src/domain/index.ts` — add `Roots` namespace export

### Part A — Domain Layer Tests

- [ ] `src/domain/roots/__tests__/Business.test.ts` (8 tests)
- [ ] `src/domain/roots/__tests__/Catalog.test.ts` (4 tests)
- [ ] `src/domain/roots/__tests__/Surfaces.test.ts` (6 tests)
- [ ] `src/domain/roots/__tests__/OrderSettings.test.ts` (8 tests)
- [ ] `src/domain/roots/__tests__/LocationsRoot.test.ts` (4 tests)
- [ ] `src/domain/roots/__tests__/ConnectedAccounts.test.ts` (3 tests)
- [ ] `src/domain/roots/__tests__/Services.test.ts` (4 tests)
- [ ] `src/domain/roots/__tests__/Onboarding.test.ts` (8 tests)

### Part A — Persistence Layer Code

- [ ] `src/persistence/firestore/PathResolver.ts` — centralized path resolution (all collection methods)
- [ ] `src/persistence/firestore/BusinessRepository.ts`
- [ ] `src/persistence/firestore/CatalogRootRepository.ts`
- [ ] `src/persistence/firestore/SurfacesRootRepository.ts`
- [ ] `src/persistence/firestore/OrderSettingsRepository.ts`
- [ ] `src/persistence/firestore/LocationsRootRepository.ts`
- [ ] `src/persistence/firestore/ConnectedAccountsRootRepository.ts`
- [ ] `src/persistence/firestore/ServicesRepository.ts`
- [ ] `src/persistence/firestore/OnboardingRepository.ts`
- [ ] `src/persistence/firestore/BusinessFactory.ts` — createBusiness refactored
- [ ] Update `src/persistence/firestore/index.ts` — add new exports

### Part A — Persistence Layer Tests

- [ ] `src/persistence/firestore/__tests__/PathResolver.test.ts` (16 tests)
- [ ] `src/persistence/firestore/__tests__/BusinessRepository.test.ts` (4 tests)
- [ ] `src/persistence/firestore/__tests__/CatalogRootRepository.test.ts` (3 tests)
- [ ] `src/persistence/firestore/__tests__/SurfacesRootRepository.test.ts` (3 tests)
- [ ] `src/persistence/firestore/__tests__/OrderSettingsRepository.test.ts` (4 tests)
- [ ] `src/persistence/firestore/__tests__/LocationsRootRepository.test.ts` (3 tests)
- [ ] `src/persistence/firestore/__tests__/ConnectedAccountsRootRepository.test.ts` (3 tests)
- [ ] `src/persistence/firestore/__tests__/ServicesRepository.test.ts` (3 tests)
- [ ] `src/persistence/firestore/__tests__/OnboardingRepository.test.ts` (4 tests)
- [ ] `src/persistence/firestore/__tests__/BusinessFactory.test.ts` (5 tests)

### Part A — Deprecation

- [ ] Add `@deprecated` to `src/restaurant/roots/Business.ts`
- [ ] Add `@deprecated` to `src/restaurant/roots/Catalog.ts`
- [ ] Add `@deprecated` to `src/restaurant/roots/Surfaces.ts`
- [ ] Add `@deprecated` to `src/restaurant/roots/Orders.ts`
- [ ] Add `@deprecated` to `src/restaurant/roots/Locations.ts`
- [ ] Add `@deprecated` to `src/restaurant/roots/ConnectedAccounts.ts`
- [ ] Add `@deprecated` to `src/restaurant/roots/Services.ts`
- [ ] Add `@deprecated` to `src/restaurant/roots/Onboarding.ts` (class only, not `repair`/`createMenu`)
- [ ] Add `@deprecated` to `src/restaurant/roots/BusinessUtilities.ts`
- [ ] Add `@deprecated` to `src/restaurant/misc/BusinessProfile.ts`
- [ ] Add `@deprecated` to `src/restaurant/locations/LocationMeta.ts`

### Part A — Verification

- [ ] `npm run tsc` passes with no errors
- [ ] `npx eslint src/` passes
- [ ] `npm run test` — All tests pass (existing + ~93 new Part A tests)
- [ ] All Phase 0/1/2/3/4 tests still pass (no regressions)
- [ ] Old imports still compile — backward compatible
- [ ] Domain classes instantiate without Firebase initialized
- [ ] PathResolver paths match old root docRef() paths exactly

### Part B — Repository Migration to PathResolver

- [ ] Update `OptionRepository` — use `PathResolver.optionsCollection()`
- [ ] Update `OptionSetRepository` — use `PathResolver.optionSetsCollection()`
- [ ] Update `ProductRepository` — use `PathResolver.productsCollection()`
- [ ] Update `CategoryRepository` — use `PathResolver.categoriesCollection()`
- [ ] Update `TaxRateRepository` — use `PathResolver.taxRatesCollection()`
- [ ] Update `DiscountRepository` — use `PathResolver.discountsCollection()`
- [ ] Update `ServiceChargeRepository` — use `PathResolver.serviceChargesCollection()`
- [ ] Update `MenuRepository` — use `PathResolver.menusCollection()`
- [ ] Update `MenuGroupRepository` — use `PathResolver.menuGroupsCollection()`
- [ ] Update `SurfaceConfigurationRepository` — use `PathResolver`
- [ ] Update `KioskConfigurationRepository` — use `PathResolver`
- [ ] Update `CheckoutOptionsRepository` — use `PathResolver`
- [ ] Update `TokenRepository` — use `PathResolver.tokensCollection()`
- [ ] Update `EventRepository` — use `PathResolver.eventsCollection()`
- [ ] Update `OrderRepository` — use `PathResolver.ordersCollection()`
- [ ] Update `LocationRepository` — use `PathResolver.locationsCollection()`
- [ ] Update `OnboardingOrderRepository` — use `PathResolver`

### Part B — Metadata Spec & Relationship Handler Migration

- [ ] Update `MenuMetadataSpec` — use `PathResolver.surfacesDoc()`
- [ ] Update `MenuGroupMetadataSpec` — use `PathResolver.surfacesDoc()`
- [ ] Update `LocationMetadataSpec` — use `PathResolver.locationsDoc()`
- [ ] Update `OptionRelationshipHandler` — use `PathResolver.catalogDoc()`
- [ ] Update `OptionSetRelationshipHandler` — use `PathResolver.catalogDoc()`
- [ ] Update `ProductRelationshipHandler` — use `PathResolver.catalogDoc()`

### Part B — Delete Deprecated Files

- [ ] Delete `src/firestore-core/core/FirestoreObject.ts`
- [ ] Delete `src/firestore-core/core/FirestoreObjectV2.ts`
- [ ] Delete `src/firestore-core/core/FirestoreWriter.ts`
- [ ] Delete `src/firestore-core/core/LinkedObject.ts`
- [ ] Delete `src/firestore-core/core/LinkedObjectType.ts`
- [ ] Delete `src/firestore-core/core/LinkedObjectUtilities.ts`
- [ ] Delete all `src/restaurant/catalog/*.ts` (12 files)
- [ ] Delete all `src/restaurant/surfaces/*.ts` (7 files)
- [ ] Delete all `src/restaurant/roots/*.ts` (9 files)
- [ ] Delete `src/restaurant/connected-accounts/Event.ts`
- [ ] Delete `src/restaurant/connected-accounts/Token.ts`
- [ ] Delete `src/restaurant/locations/Location.ts`
- [ ] Delete `src/restaurant/locations/LocationMeta.ts`
- [ ] Delete `src/restaurant/orders/OrderV3.ts`
- [ ] Delete `src/restaurant/orders/OrderSymbols.ts`
- [ ] Delete `src/restaurant/misc/BusinessProfile.ts`
- [ ] Delete `src/restaurant/misc/Address.ts`
- [ ] Delete `src/restaurant/onboarding/OnboardingOrder.ts`

### Part B — Clean Up Empty Directories

- [ ] Remove `src/restaurant/catalog/` if empty
- [ ] Remove `src/restaurant/surfaces/` if empty
- [ ] Remove `src/restaurant/roots/` if empty
- [ ] Remove `src/restaurant/locations/` if empty
- [ ] Remove `src/restaurant/orders/` if empty
- [ ] Remove `src/restaurant/misc/` if empty
- [ ] Remove `src/restaurant/onboarding/` if empty
- [ ] Remove `src/firestore-core/core/` if empty

### Part B — Update Barrel Exports

- [ ] Update `src/firestore-core/index.ts` — export only Paths + Constants
- [ ] Update `src/index.ts` — new clean barrel export (see B.1.4)

### Part B — Tests

- [ ] Create/update `src/__tests__/index.test.ts` — verify all namespace exports (11 tests)
- [ ] All existing tests pass (no regressions)
- [ ] `npm run tsc` passes — no references to deleted files
- [ ] `npx eslint src/` passes

### Part B — Version & Documentation

- [ ] Bump `package.json` to next major version
- [ ] Create `MIGRATION.md` with import path migration guide

---

## Files Changed Summary

### Part A (Root Aggregates)

| Action | File | Description |
|--------|------|-------------|
| **Create** | `src/domain/roots/Business.ts` | Business domain model + BusinessType/Role enums |
| **Create** | `src/domain/roots/Catalog.ts` | Empty root domain model |
| **Create** | `src/domain/roots/Surfaces.ts` | Surfaces root with menus/menuGroups maps |
| **Create** | `src/domain/roots/Orders.ts` | OrderSettings domain model (14 settings fields) |
| **Create** | `src/domain/roots/Locations.ts` | LocationsRoot + LocationMeta |
| **Create** | `src/domain/roots/ConnectedAccounts.ts` | ConnectedAccounts root |
| **Create** | `src/domain/roots/Services.ts` | Services root |
| **Create** | `src/domain/roots/Onboarding.ts` | Onboarding root + enums + default status |
| **Create** | `src/domain/roots/index.ts` | Barrel export |
| **Create** | `src/persistence/firestore/PathResolver.ts` | Centralized path resolution |
| **Create** | `src/persistence/firestore/BusinessRepository.ts` | Repository |
| **Create** | `src/persistence/firestore/CatalogRootRepository.ts` | Repository |
| **Create** | `src/persistence/firestore/SurfacesRootRepository.ts` | Repository |
| **Create** | `src/persistence/firestore/OrderSettingsRepository.ts` | Repository |
| **Create** | `src/persistence/firestore/LocationsRootRepository.ts` | Repository |
| **Create** | `src/persistence/firestore/ConnectedAccountsRootRepository.ts` | Repository |
| **Create** | `src/persistence/firestore/ServicesRepository.ts` | Repository |
| **Create** | `src/persistence/firestore/OnboardingRepository.ts` | Repository |
| **Create** | `src/persistence/firestore/BusinessFactory.ts` | createBusiness orchestration |
| **Create** | 8 domain test files | ~45 domain tests |
| **Create** | 10 persistence test files | ~48 persistence tests |
| **Modify** | `src/domain/index.ts` | Add `Roots` namespace export |
| **Modify** | `src/persistence/firestore/index.ts` | Add root repository + factory exports |
| **Modify** | 11 old files | Add `@deprecated` JSDoc |

### Part B (Cleanup)

| Action | Count | Description |
|--------|-------|-------------|
| **Delete** | ~42 files | All deprecated model/root/surface/firestore-core files |
| **Delete** | ~8 directories | Empty directories after file deletion |
| **Modify** | 17 repository files | Switch from old root imports to PathResolver |
| **Modify** | 3 metadata spec files | Switch to PathResolver |
| **Modify** | 3 relationship handler files | Switch to PathResolver |
| **Modify** | `src/firestore-core/index.ts` | Reduce to Paths + Constants only |
| **Modify** | `src/index.ts` | Complete rewrite of barrel export |
| **Modify** | `package.json` | Major version bump |
| **Create** | `MIGRATION.md` | Consumer migration guide |
| **Create/Modify** | Test files | 11 new tests |

**Total new tests:** ~104 (93 Part A + 11 Part B)

---

## Dependency Graph — Complete

```
Phase 0 (done) ── Phase 1 (done) ── Phase 2 (done)
                                          │
                                     Phase 3 (done — Catalog)
                                          │
                                     Phase 4 (done — Surfaces)
                                          │
                              ▶ Phase 5 (this — Roots + Cleanup) ◀
                                          │
                                     ✅ COMPLETE
```

---

## Entities NOT Migrated

| Entity | Reason |
|--------|--------|
| `EventNotification` | Firebase Realtime Database, not Firestore. No domain extraction. |
| `SemaphoreV2` | Firebase Realtime Database. RTDB-specific lock pattern. |
| `Onboarding.repair()` | Application-layer business logic that uses Firestore queries. Stays in old class until consumers are migrated. |
| `Onboarding.createMenu()` | Application-layer orchestration. Same as above. |
| `DistributedCounter` | Deeply Firestore-coupled sharding pattern. No domain logic to extract. |

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Consumers break on major version | `MIGRATION.md` with exact import mapping. Deprecation warnings in Phases 1–4 give advance notice. |
| Missed import references | `npm run tsc` catches all — TypeScript won't compile with dangling imports |
| RTDB modules break | `EventNotification` and `SemaphoreV2` are explicitly kept, not touched |
| `Onboarding.repair()`/`createMenu()` | These application-layer methods reference old model constructors. If still needed, they must be refactored to use domain models + repositories. Flag as TODO if not resolved during Part B. |
| Paths.ts collection names drift | PathResolver is the single source of truth — all references go through it |
| Part B is a breaking change | Clearly scoped as major version bump. Part A can be shipped independently as a minor version if needed, giving consumers time to migrate before Part B lands. |
