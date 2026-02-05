# Phase 4 (Migrate Surfaces & Remaining Entity Models) — Detailed Spec

## Overview

Phase 4 migrates surface models (Menu, MenuGroup, SurfaceConfiguration, KioskConfiguration, CheckoutOptions), connected-account models (Token), and onboarding models (OnboardingOrder) to the domain layer with separated persistence.

**Key difference from Phase 3:** Menu and MenuGroup have *active `metaLinks()`* — they denormalize metadata into the Surfaces root document. This is the first migration of entities with real metadata denormalization targets (Phase 2's Location also had metaLinks, but Phase 3's catalog models did not).

**Migration order:** Bottom-up by dependency: **MenuMeta/MenuGroupMeta → MenuGroup → Menu → SurfaceConfiguration → KioskConfiguration → CheckoutOptions → Token → OnboardingOrder**

Menu depends on MenuGroup (contains MenuGroupMeta map). MenuGroup depends on ProductMeta (from Phase 3).

**Scope:** ~20 new domain/persistence files, 7 deprecated classes, 0 existing code broken.

**Prerequisite:** Phases 0–3 complete.

---

## Current State

### What exists today

| File | Responsibility |
|------|---------------|
| `src/restaurant/surfaces/Menu.ts` | V1 class — 9 fields, `metadata()` → `MenuMeta`, `metaLinks()` → Surfaces root |
| `src/restaurant/surfaces/MenuGroup.ts` | V1 class — 7 fields, `metadata()` → `MenuGroupMeta`, `metaLinks()` → Surfaces root |
| `src/restaurant/surfaces/MenuMeta.ts` | Interface: `name`, `displayName` |
| `src/restaurant/surfaces/MenuGroupMeta.ts` | Interface: `name`, `displayName` |
| `src/restaurant/surfaces/SurfaceConfiguration.ts` | V1 class — 5 fields + nested config interfaces, no metadata |
| `src/restaurant/surfaces/KioskConfiguration.ts` | V2 class — 4 fields, no metadata |
| `src/restaurant/surfaces/CheckoutOptions.ts` | V2 class — 6 fields + many nested interfaces, no metadata |
| `src/restaurant/connected-accounts/Token.ts` | V1 abstract class — 3 fields, no metadata |
| `src/restaurant/onboarding/OnboardingOrder.ts` | V1 class — 8 fields, no metadata |

### Metadata Denormalization (Menu, MenuGroup)

| Entity | `metaLinks(businessId)` Target | Field Written |
|--------|-------------------------------|---------------|
| Menu | `Surfaces.docRef(businessId).path` | `menus.{menuId}` → `MenuMeta` |
| MenuGroup | `Surfaces.docRef(businessId).path` | `menuGroups.{menuGroupId}` → `MenuGroupMeta` |

These are real denormalization targets — the Surfaces root document stores maps of `MenuMeta` and `MenuGroupMeta` for fast lookup.

### Cross-Entity Relationships

| Trigger | Action |
|---------|--------|
| Menu contains `groups` map of `MenuGroupMeta` | When MenuGroup saved, update `groups.{id}` in all Menus containing it |
| MenuGroup contains `products` map of `ProductMeta` | When Product saved, update `products.{id}` in all MenuGroups containing it |

The Product→MenuGroup relationship is NOT currently handled in `FirestoreWriter` — the writer only handles Product→Category. MenuGroup product metadata is managed via separate code paths (onboarding, manual updates). **No new relationship handler needed for Product→MenuGroup at this phase.**

The MenuGroup→Menu relationship is also NOT in `FirestoreWriter`. MenuGroup metadata in menus is updated through explicit calls. **No new relationship handler needed for MenuGroup→Menu at this phase.**

---

## 1. Implementation Spec

### 1.1 Meta Interfaces — `src/domain/surfaces/`

Pure interfaces. Identical shapes to old files.

**`src/domain/surfaces/MenuMeta.ts`:**
```typescript
export interface MenuMeta {
  name: string;
  displayName: string | null;
}
```

**`src/domain/surfaces/MenuGroupMeta.ts`:**
```typescript
export interface MenuGroupMeta {
  name: string;
  displayName: string | null;
}
```

---

### 1.2 `src/domain/surfaces/Menu.ts` — Domain model

```typescript
import { DomainEntity, DomainEntityProps } from '../DomainEntity';
import { MetadataProjection } from '../MetadataSpec';
import { MenuMeta } from './MenuMeta';
import { MenuGroupMeta } from './MenuGroupMeta';

export interface MenuProps extends DomainEntityProps {
  name: string;
  displayName: string | null;
  groups: { [id: string]: MenuGroupMeta };
  groupDisplayOrder: string[];
  coverImageGsl: string | null;
  coverBackgroundImageGsl: string | null;
  coverVideoGsl: string | null;
  logoImageGsl: string | null;
  gratuityRates: number[];
}

export class Menu extends DomainEntity implements MetadataProjection<MenuMeta> {
  name: string;
  displayName: string | null;
  groups: { [id: string]: MenuGroupMeta };
  groupDisplayOrder: string[];
  coverImageGsl: string | null;
  coverBackgroundImageGsl: string | null;
  coverVideoGsl: string | null;
  logoImageGsl: string | null;
  gratuityRates: number[];

  constructor(props: MenuProps) {
    super(props);
    this.name = props.name;
    this.displayName = props.displayName ?? null;
    this.groups = props.groups ?? {};
    this.groupDisplayOrder = props.groupDisplayOrder ?? [];
    this.coverImageGsl = props.coverImageGsl ?? null;
    this.coverBackgroundImageGsl = props.coverBackgroundImageGsl ?? null;
    this.coverVideoGsl = props.coverVideoGsl ?? null;
    this.logoImageGsl = props.logoImageGsl ?? null;
    this.gratuityRates = props.gratuityRates ?? [];
  }

  metadata(): MenuMeta {
    return {
      name: this.name,
      displayName: this.displayName,
    };
  }
}
```

**Key decisions:**
- **Extends `DomainEntity`, not `TenantEntity`** — Menu is accessed via `Surfaces.docRef(businessId)` path, no stored `businessId`.
- **`groups` map stores `MenuGroupMeta`** — denormalized metadata from MenuGroup entities.

---

### 1.3 `src/domain/surfaces/MenuGroup.ts` — Domain model

```typescript
import { DomainEntity, DomainEntityProps } from '../DomainEntity';
import { MetadataProjection } from '../MetadataSpec';
import { MenuGroupMeta } from './MenuGroupMeta';
import { ProductMeta } from '../catalog/ProductMeta';

export interface MenuGroupProps extends DomainEntityProps {
  name: string;
  displayName: string | null;
  products: { [id: string]: ProductMeta };
  productDisplayOrder: string[];
  parentGroup: string | null;
  childGroup: string | null;
  mirrorCategoryId: string | null;
}

export class MenuGroup extends DomainEntity implements MetadataProjection<MenuGroupMeta> {
  name: string;
  displayName: string | null;
  products: { [id: string]: ProductMeta };
  productDisplayOrder: string[];
  parentGroup: string | null;
  childGroup: string | null;
  mirrorCategoryId: string | null;

  constructor(props: MenuGroupProps) {
    super(props);
    this.name = props.name;
    this.displayName = props.displayName ?? '';
    this.products = props.products ?? {};
    this.productDisplayOrder = props.productDisplayOrder ?? [];
    this.parentGroup = props.parentGroup ?? null;
    this.childGroup = props.childGroup ?? null;
    this.mirrorCategoryId = props.mirrorCategoryId ?? null;
  }

  metadata(): MenuGroupMeta {
    return {
      name: this.name,
      displayName: this.displayName,
    };
  }
}
```

**Key decisions:**
- **`displayName` defaults to `''`** — matches old constructor behavior (`data.displayName ?? ''`).
- **`products` stores `ProductMeta`** — same cross-reference pattern as Category.
- **`mirrorCategoryId`** — links to a catalog Category for content mirroring.

---

### 1.4 `src/domain/surfaces/SurfaceConfiguration.ts` — Domain model

```typescript
import { DomainEntity, DomainEntityProps } from '../DomainEntity';

export interface CoverConfiguration {
  isCoverNoticeEnabled: boolean;
  coverNoticeText: string | null;
}

export interface CheckoutFlowConfiguration {
  isCouponsEnabled: boolean;
  isSquareGiftCardEnabled: boolean;
  isOrderNoteEnabled: boolean;
  checkoutCustomerNamePromptText: string | null;
  checkoutCustomerPhoneNumberPromptHeading: string | null;
  checkoutCustomerPhoneNumberPromptText: string | null;
  isDineInEnabled: boolean;
  isDineInNoticeEnabled: boolean;
  dineInNoticeText: string | null;
  isDineInCustomerEnterIdEnabled: boolean;
  dineInCustomerEnterIdPrompt: string | null;
  isDineInCustomerNameRequired: boolean;
  dineInCustomerNameRequiredPrompt: string | null;
  isToGoEnabled: boolean;
  isToGoNoticeEnabled: boolean;
  toGoNoticeText: string | null;
  orderConfirmationText: string | null;
  isReferralCodeEnabled: boolean;
  referralCodePromptText: string | null;
}

export interface TipConfiguration {
  isTipsEnabled: boolean;
  isSmartTipsEnabled: boolean;
}

export interface SurfaceConfigurationProps extends DomainEntityProps {
  name: string;
  isChargeCustomerServiceFee: boolean;
  coverConfiguration: CoverConfiguration | null;
  tipConfiguration: TipConfiguration | null;
  checkoutFlowConfiguration: CheckoutFlowConfiguration | null;
  version?: string;
}

export class SurfaceConfiguration extends DomainEntity {
  name: string;
  isChargeCustomerServiceFee: boolean;
  coverConfiguration: CoverConfiguration | null;
  tipConfiguration: TipConfiguration | null;
  checkoutFlowConfiguration: CheckoutFlowConfiguration | null;
  version: string;

  constructor(props: SurfaceConfigurationProps) {
    super(props);
    this.name = props.name;
    this.isChargeCustomerServiceFee = props.isChargeCustomerServiceFee;
    this.coverConfiguration = props.coverConfiguration ?? null;
    this.tipConfiguration = props.tipConfiguration ?? null;
    this.checkoutFlowConfiguration = props.checkoutFlowConfiguration ?? null;
    this.version = props.version ?? '0.0';
  }
}
```

**Key decisions:**
- **Nested config interfaces (`CoverConfiguration`, `CheckoutFlowConfiguration`, `TipConfiguration`) move to domain layer** — they are pure data types, no Firestore dependency.
- **No `MetadataProjection`** — `metadata()` returns `{}` in old code.

---

### 1.5 `src/domain/surfaces/KioskConfiguration.ts` — Domain model

```typescript
import { DomainEntity, DomainEntityProps } from '../DomainEntity';

export interface KioskConfigurationProps extends DomainEntityProps {
  name: string;
  unlockCode: string | null;
  checkoutOptionId: string | null;
  version?: string;
}

export class KioskConfiguration extends DomainEntity {
  name: string;
  unlockCode: string | null;
  checkoutOptionId: string | null;
  version: string;

  constructor(props: KioskConfigurationProps) {
    super(props);
    this.name = props.name;
    this.unlockCode = props.unlockCode ?? null;
    this.checkoutOptionId = props.checkoutOptionId ?? null;
    this.version = props.version ?? '1.0';
  }
}
```

**Key decisions:**
- **Old class extends `FirestoreObjectV2`** with `businessId` — but `businessId` is a path parameter (via `Surfaces.docRef(businessId)`), not stored in the document. The new class extends `DomainEntity`.
- **`version` defaults to `'1.0'`** — matches old behavior.

---

### 1.6 `src/domain/surfaces/CheckoutOptions.ts` — Domain model

```typescript
import { DomainEntity, DomainEntityProps } from '../DomainEntity';

export interface TipOptions {
  isEnabled: boolean;
  isSmartTipEnabled: boolean;
  tipAmounts: number[];
  preselectedIdx: number;
}

export interface DiscountOptions {
  isEnabled: boolean;
}

export interface GiftCardOptions {
  isEnabled: boolean;
}

export interface ReferralCodeOptions {
  isEnabled: boolean;
}

export interface ScheduleOptions {
  isEnabled: boolean;
}

export interface ContactOptions {
  isEnabled: boolean;
}

export interface ManualIdConfig {
  title: string;
  text: string;
  isQREnabled: boolean;
}

export interface ManualIdOptions {
  isEnabled: boolean;
  config?: ManualIdConfig;
}

export enum CheckoutOptionType {
  switch = 'switch',
  quantity = 'quantity',
}

export interface OptionConfig {
  name: string;
  type: CheckoutOptionType;
  productId: string;
}

export interface FulfillmentOption {
  isEnabled: boolean;
  scheduleOptions: ScheduleOptions;
  contactOptions: ContactOptions;
  manualIdOptions: ManualIdOptions;
  options: OptionConfig[];
}

export interface CheckoutOptionsProps extends DomainEntityProps {
  name: string;
  discounts: DiscountOptions;
  giftCards: GiftCardOptions;
  referralCodes: ReferralCodeOptions;
  tipOptions: TipOptions | null;
  fulfillmentOptions: { [orderType: string]: FulfillmentOption | undefined };
}

export class CheckoutOptions extends DomainEntity {
  name: string;
  discounts: DiscountOptions;
  giftCards: GiftCardOptions;
  referralCodes: ReferralCodeOptions;
  tipOptions: TipOptions | null;
  fulfillmentOptions: { [orderType: string]: FulfillmentOption | undefined };

  constructor(props: CheckoutOptionsProps) {
    super(props);
    this.name = props.name;
    this.discounts = props.discounts;
    this.giftCards = props.giftCards;
    this.referralCodes = props.referralCodes;
    this.tipOptions = props.tipOptions ?? null;
    this.fulfillmentOptions = props.fulfillmentOptions ?? {};
  }
}
```

**Key decisions:**
- **`fulfillmentOptions` keyed by `string`**, not `OrderType` enum — decouples from `OrderSymbols`. The persistence layer maps the keys.
- **All nested interfaces move to domain layer** — they are pure data types.
- **Old class extends `FirestoreObjectV2`** — same `businessId` situation as KioskConfiguration. New class extends `DomainEntity`.

---

### 1.7 `src/domain/connected-accounts/Token.ts` — Domain model

```typescript
import { DomainEntity, DomainEntityProps } from '../DomainEntity';

export interface TokenProps extends DomainEntityProps {
  createdBy: string;
  businessId: string;
  provider: string;
}

export abstract class Token extends DomainEntity {
  createdBy: string;
  businessId: string;
  provider: string;

  protected constructor(props: TokenProps) {
    super(props);
    this.createdBy = props.createdBy;
    this.businessId = props.businessId;
    this.provider = props.provider;
  }
}
```

**Key decisions:**
- **Remains `abstract`** — Token is a base class for provider-specific subclasses. Consumers extend it.
- **`businessId` is a stored field** (unlike catalog models) — Token documents explicitly store `businessId`.
- **Does NOT extend `TenantEntity`** — Token has its own `businessId` field and doesn't inherit DomainEntity's `isDeleted` pattern the same way. Keeping it simple with explicit field.

---

### 1.8 `src/domain/onboarding/OnboardingOrder.ts` — Domain model

```typescript
import { DomainEntity, DomainEntityProps } from '../DomainEntity';
import { Address } from '../misc/Address';
import { OrderState } from '../orders/OrderSymbols';
import { OrderLineItem } from '../orders/Order';

export enum InvoiceStatus {
  draft = 'draft',
  open = 'open',
  paid = 'paid',
  void = 'void',
  uncollectible = 'uncollectible',
}

export interface OnboardingOrderProps extends DomainEntityProps {
  invoiceId: string;
  invoiceStatus: InvoiceStatus;
  shippingTrackingNumber: string;
  shipmentCarrier: string;
  shipmentAddress: Address;
  totalAmount: number;
  orderStatus: OrderState;
  lineItems: OrderLineItem[];
}

export class OnboardingOrder extends DomainEntity {
  invoiceId: string;
  invoiceStatus: InvoiceStatus;
  shippingTrackingNumber: string;
  shipmentCarrier: string;
  shipmentAddress: Address;
  totalAmount: number;
  orderStatus: OrderState;
  lineItems: OrderLineItem[];

  constructor(props: OnboardingOrderProps) {
    super(props);
    this.invoiceId = props.invoiceId;
    this.invoiceStatus = props.invoiceStatus;
    this.shippingTrackingNumber = props.shippingTrackingNumber;
    this.shipmentCarrier = props.shipmentCarrier;
    this.shipmentAddress = props.shipmentAddress;
    this.totalAmount = props.totalAmount;
    this.orderStatus = props.orderStatus;
    this.lineItems = props.lineItems ?? [];
  }
}
```

**Key decisions:**
- **`InvoiceStatus` changes from `const enum` to regular `enum`** — `const enum` is erased at compile time and can't be used in runtime checks. Regular enum is safer for a library.
- **References `Address` from `src/domain/misc/`** — Address interface must be moved to domain layer first (see 1.9).
- **References `OrderState` and `OrderLineItem` from domain `orders/`** — these already exist from Phase 1.

---

### 1.9 Shared Value Types — `src/domain/misc/`

These already exist in `src/restaurant/misc/` but must be copied to the domain layer as pure types.

**`src/domain/misc/Address.ts`:**
```typescript
export interface Address {
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export const emptyAddress: Address = {
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  zip: '',
  country: '',
};
```

**`src/domain/misc/BusinessProfile.ts`:**
```typescript
import { Address } from './Address';

export interface BusinessProfile {
  name: string;
  address?: Address;
  shippingAddress?: Address;
}
```

**Key decisions:**
- **`BusinessProfile` becomes an interface** instead of a class — it's a pure data projection. The `firestoreConverter` on the old class moves to the persistence layer.
- **`Address` is already a pure interface** — straight copy.

---

### 1.10 Barrel Exports

**`src/domain/surfaces/index.ts`:**
```typescript
export { MenuMeta } from './MenuMeta';
export { MenuGroupMeta } from './MenuGroupMeta';
export { Menu, MenuProps } from './Menu';
export { MenuGroup, MenuGroupProps } from './MenuGroup';
export {
  SurfaceConfiguration, SurfaceConfigurationProps,
  CoverConfiguration, CheckoutFlowConfiguration, TipConfiguration,
} from './SurfaceConfiguration';
export { KioskConfiguration, KioskConfigurationProps } from './KioskConfiguration';
export {
  CheckoutOptions, CheckoutOptionsProps, CheckoutOptionType,
  TipOptions, DiscountOptions, GiftCardOptions, ReferralCodeOptions,
  ScheduleOptions, ContactOptions, ManualIdOptions, ManualIdConfig,
  OptionConfig, FulfillmentOption,
} from './CheckoutOptions';
```

**`src/domain/onboarding/index.ts`:**
```typescript
export { OnboardingOrder, OnboardingOrderProps, InvoiceStatus } from './OnboardingOrder';
```

**`src/domain/misc/index.ts`:**
```typescript
export { Address, emptyAddress } from './Address';
export { BusinessProfile } from './BusinessProfile';
```

**Update `src/domain/connected-accounts/index.ts`** — append:
```typescript
export { Token, TokenProps } from './Token';
```

**Update `src/domain/index.ts`** — append:
```typescript
export * as Surfaces from './surfaces';
export * as Onboarding from './onboarding';
export * as Misc from './misc';
```

---

### 1.11 Persistence — Surface Repositories

**`src/persistence/firestore/MenuRepository.ts`:**
```typescript
export class MenuRepository extends FirestoreRepository<Menu> {
  protected config(): FirestoreRepositoryConfig<Menu> {
    return {
      collectionRef(businessId: string) {
        return Surfaces.docRef(businessId).collection(Paths.CollectionNames.menus);
      },
      toFirestore(menu: Menu): FirebaseFirestore.DocumentData {
        return {
          name: menu.name,
          displayName: menu.displayName,
          groups: JSON.parse(JSON.stringify(menu.groups)),
          groupDisplayOrder: JSON.parse(JSON.stringify(menu.groupDisplayOrder)),
          coverImageGsl: menu.coverImageGsl,
          coverBackgroundImageGsl: menu.coverBackgroundImageGsl,
          coverVideoGsl: menu.coverVideoGsl,
          logoImageGsl: menu.logoImageGsl,
          gratuityRates: JSON.parse(JSON.stringify(menu.gratuityRates)),
          created: menu.created.toISOString(),
          updated: menu.updated.toISOString(),
          isDeleted: menu.isDeleted,
        };
      },
      fromFirestore(data: FirebaseFirestore.DocumentData, id: string): Menu {
        return new Menu({
          Id: id,
          name: data.name,
          displayName: data.displayName ?? null,
          groups: data.groups ?? {},
          groupDisplayOrder: data.groupDisplayOrder ?? [],
          coverImageGsl: data.coverImageGsl ?? null,
          coverBackgroundImageGsl: data.coverBackgroundImageGsl ?? null,
          coverVideoGsl: data.coverVideoGsl ?? null,
          logoImageGsl: data.logoImageGsl ?? null,
          gratuityRates: data.gratuityRates ?? [],
          created: new Date(data.created),
          updated: new Date(data.updated),
          isDeleted: data.isDeleted,
        });
      },
    };
  }
}
```

**`src/persistence/firestore/MenuGroupRepository.ts`:**
```typescript
export class MenuGroupRepository extends FirestoreRepository<MenuGroup> {
  protected config(): FirestoreRepositoryConfig<MenuGroup> {
    return {
      collectionRef(businessId: string) {
        return Surfaces.docRef(businessId).collection(Paths.CollectionNames.menuGroups);
      },
      toFirestore(mg: MenuGroup): FirebaseFirestore.DocumentData {
        return {
          name: mg.name,
          products: JSON.parse(JSON.stringify(mg.products)),
          productDisplayOrder: JSON.parse(JSON.stringify(mg.productDisplayOrder)),
          displayName: mg.displayName ?? null,
          parentGroup: mg.parentGroup ?? null,
          childGroup: mg.childGroup ?? null,
          mirrorCategoryId: mg.mirrorCategoryId ?? null,
          created: mg.created.toISOString(),
          updated: mg.updated.toISOString(),
          isDeleted: mg.isDeleted,
        };
      },
      fromFirestore(data: FirebaseFirestore.DocumentData, id: string): MenuGroup {
        return new MenuGroup({
          Id: id,
          name: data.name,
          displayName: data.displayName ?? null,
          products: data.products ?? {},
          productDisplayOrder: data.productDisplayOrder ?? [],
          parentGroup: data.parentGroup ?? null,
          childGroup: data.childGroup ?? null,
          mirrorCategoryId: data.mirrorCategoryId ?? null,
          created: new Date(data.created),
          updated: new Date(data.updated),
          isDeleted: data.isDeleted,
        });
      },
    };
  }
}
```

**`src/persistence/firestore/SurfaceConfigurationRepository.ts`:**
```typescript
export class SurfaceConfigurationRepository extends FirestoreRepository<SurfaceConfiguration> {
  protected config(): FirestoreRepositoryConfig<SurfaceConfiguration> {
    return {
      collectionRef(businessId: string) {
        return Surfaces.docRef(businessId).collection(Paths.CollectionNames.surfaceConfigurations);
      },
      toFirestore(sc: SurfaceConfiguration): FirebaseFirestore.DocumentData {
        return {
          name: sc.name,
          isChargeCustomerServiceFee: sc.isChargeCustomerServiceFee,
          coverConfiguration: sc.coverConfiguration,
          tipConfiguration: sc.tipConfiguration,
          checkoutFlowConfiguration: sc.checkoutFlowConfiguration,
          version: sc.version,
          created: sc.created.toISOString(),
          updated: sc.updated.toISOString(),
          isDeleted: sc.isDeleted,
        };
      },
      fromFirestore(data: FirebaseFirestore.DocumentData, id: string): SurfaceConfiguration {
        return new SurfaceConfiguration({
          Id: id,
          name: data.name,
          isChargeCustomerServiceFee: data.isChargeCustomerServiceFee,
          coverConfiguration: data.coverConfiguration ?? null,
          tipConfiguration: data.tipConfiguration ?? null,
          checkoutFlowConfiguration: data.checkoutFlowConfiguration ?? null,
          version: data.version,
          created: new Date(data.created),
          updated: new Date(data.updated),
          isDeleted: data.isDeleted,
        });
      },
    };
  }
}
```

**`src/persistence/firestore/KioskConfigurationRepository.ts`:**
```typescript
export class KioskConfigurationRepository extends FirestoreRepository<KioskConfiguration> {
  protected config(): FirestoreRepositoryConfig<KioskConfiguration> {
    return {
      collectionRef(businessId: string) {
        return Surfaces.docRef(businessId).collection('kioskConfigurations');
      },
      toFirestore(kc: KioskConfiguration): FirebaseFirestore.DocumentData {
        return {
          name: kc.name,
          unlockCode: kc.unlockCode,
          checkoutOptionId: kc.checkoutOptionId,
          version: kc.version,
          created: kc.created.toISOString(),
          updated: kc.updated.toISOString(),
          isDeleted: kc.isDeleted,
        };
      },
      fromFirestore(data: FirebaseFirestore.DocumentData, id: string): KioskConfiguration {
        return new KioskConfiguration({
          Id: id,
          name: data.name,
          unlockCode: data.unlockCode ?? null,
          checkoutOptionId: data.checkoutOptionId ?? null,
          version: data.version,
          created: new Date(data.created),
          updated: new Date(data.updated),
          isDeleted: data.isDeleted,
        });
      },
    };
  }
}
```

**`src/persistence/firestore/CheckoutOptionsRepository.ts`:**
```typescript
export class CheckoutOptionsRepository extends FirestoreRepository<CheckoutOptions> {
  protected config(): FirestoreRepositoryConfig<CheckoutOptions> {
    return {
      collectionRef(businessId: string) {
        return Surfaces.docRef(businessId).collection('checkoutOptions');
      },
      toFirestore(co: CheckoutOptions): FirebaseFirestore.DocumentData {
        return {
          name: co.name,
          discounts: co.discounts,
          giftCards: co.giftCards,
          referralCodes: co.referralCodes,
          tipOptions: co.tipOptions,
          fulfillmentOptions: JSON.parse(JSON.stringify(co.fulfillmentOptions)),
          created: co.created.toISOString(),
          updated: co.updated.toISOString(),
          isDeleted: co.isDeleted,
        };
      },
      fromFirestore(data: FirebaseFirestore.DocumentData, id: string): CheckoutOptions {
        return new CheckoutOptions({
          Id: id,
          name: data.name,
          discounts: data.discounts,
          giftCards: data.giftCards,
          referralCodes: data.referralCodes,
          tipOptions: data.tipOptions ?? null,
          fulfillmentOptions: data.fulfillmentOptions ?? {},
          created: new Date(data.created),
          updated: new Date(data.updated),
          isDeleted: data.isDeleted,
        });
      },
    };
  }
}
```

**`src/persistence/firestore/TokenRepository.ts`:**
```typescript
export class TokenRepository extends FirestoreRepository<Token> {
  protected config(): FirestoreRepositoryConfig<Token> {
    return {
      collectionRef(businessId: string) {
        return ConnectedAccounts.docRef(businessId).collection(Paths.CollectionNames.tokens);
      },
      toFirestore(token: Token): FirebaseFirestore.DocumentData {
        return {
          createdBy: token.createdBy,
          businessId: token.businessId,
          provider: token.provider,
          created: token.created.toISOString(),
          updated: token.updated.toISOString(),
          isDeleted: token.isDeleted,
        };
      },
      fromFirestore(data: FirebaseFirestore.DocumentData, id: string): Token {
        // Token is abstract — concrete subclasses override this repository.
        // Base implementation returns a minimal token object.
        throw new Error('TokenRepository.fromFirestore must be overridden by subclass repository');
      },
    };
  }
}
```

**Key decision:** `TokenRepository` is a base class. Since `Token` is abstract, `fromFirestore` cannot construct a generic Token. Concrete provider-specific repositories (e.g., `SquareTokenRepository`) extend this and override `fromFirestore`. The `toFirestore` method serializes the base fields.

**`src/persistence/firestore/OnboardingOrderRepository.ts`:**
```typescript
export class OnboardingOrderRepository extends FirestoreRepository<OnboardingOrder> {
  protected config(): FirestoreRepositoryConfig<OnboardingOrder> {
    return {
      collectionRef(businessId: string) {
        return Onboarding.docRef(businessId).collection(Paths.CollectionNames.onboardingOrders);
      },
      toFirestore(oo: OnboardingOrder): FirebaseFirestore.DocumentData {
        return {
          invoiceId: oo.invoiceId,
          invoiceStatus: oo.invoiceStatus,
          shippingTrackingNumber: oo.shippingTrackingNumber,
          shipmentCarrier: oo.shipmentCarrier,
          shipmentAddress: oo.shipmentAddress,
          totalAmount: oo.totalAmount,
          orderStatus: oo.orderStatus,
          lineItems: JSON.parse(JSON.stringify(oo.lineItems)),
          created: oo.created.toISOString(),
          updated: oo.updated.toISOString(),
          isDeleted: oo.isDeleted,
        };
      },
      fromFirestore(data: FirebaseFirestore.DocumentData, id: string): OnboardingOrder {
        return new OnboardingOrder({
          Id: id,
          invoiceId: data.invoiceId,
          invoiceStatus: data.invoiceStatus,
          shippingTrackingNumber: data.shippingTrackingNumber,
          shipmentCarrier: data.shipmentCarrier,
          shipmentAddress: data.shipmentAddress,
          totalAmount: data.totalAmount,
          orderStatus: data.orderStatus,
          lineItems: data.lineItems ?? [],
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

### 1.12 Persistence — Metadata Specs

**`src/persistence/firestore/MenuMetadataSpec.ts`:**
```typescript
import { MetadataSpec, MetaLinkDeclaration } from '../../domain/MetadataSpec';
import { Menu } from '../../domain/surfaces/Menu';
import { MenuMeta } from '../../domain/surfaces/MenuMeta';
import Surfaces from '../../restaurant/roots/Surfaces';
import * as Paths from '../../firestore-core/Paths';

export class MenuMetadataSpec implements MetadataSpec<Menu, MenuMeta> {
  getMetadata(entity: Menu): MenuMeta {
    return entity.metadata();
  }

  getMetaLinks(entity: Menu, businessId: string): MetaLinkDeclaration[] {
    return [{
      documentPath: Surfaces.docRef(businessId).path,
      fieldPath: `${Paths.CollectionNames.menus}.${entity.Id}`,
    }];
  }
}
```

**`src/persistence/firestore/MenuGroupMetadataSpec.ts`:**
```typescript
import { MetadataSpec, MetaLinkDeclaration } from '../../domain/MetadataSpec';
import { MenuGroup } from '../../domain/surfaces/MenuGroup';
import { MenuGroupMeta } from '../../domain/surfaces/MenuGroupMeta';
import Surfaces from '../../restaurant/roots/Surfaces';
import * as Paths from '../../firestore-core/Paths';

export class MenuGroupMetadataSpec implements MetadataSpec<MenuGroup, MenuGroupMeta> {
  getMetadata(entity: MenuGroup): MenuGroupMeta {
    return entity.metadata();
  }

  getMetaLinks(entity: MenuGroup, businessId: string): MetaLinkDeclaration[] {
    return [{
      documentPath: Surfaces.docRef(businessId).path,
      fieldPath: `${Paths.CollectionNames.menuGroups}.${entity.Id}`,
    }];
  }
}
```

---

### 1.13 Barrel Export Updates

**Update `src/persistence/firestore/index.ts`** — append:
```typescript
export { MenuRepository } from './MenuRepository';
export { MenuGroupRepository } from './MenuGroupRepository';
export { SurfaceConfigurationRepository } from './SurfaceConfigurationRepository';
export { KioskConfigurationRepository } from './KioskConfigurationRepository';
export { CheckoutOptionsRepository } from './CheckoutOptionsRepository';
export { TokenRepository } from './TokenRepository';
export { OnboardingOrderRepository } from './OnboardingOrderRepository';
export { MenuMetadataSpec } from './MenuMetadataSpec';
export { MenuGroupMetadataSpec } from './MenuGroupMetadataSpec';
```

---

### 1.14 Deprecation Markers

Add `@deprecated` JSDoc to each old class — no functional changes:

| File | Deprecation target |
|------|-------------------|
| `src/restaurant/surfaces/Menu.ts` | Class + all static methods — `@deprecated Use Domain.Surfaces.Menu` |
| `src/restaurant/surfaces/MenuGroup.ts` | Class + all static methods — `@deprecated Use Domain.Surfaces.MenuGroup` |
| `src/restaurant/surfaces/MenuMeta.ts` | Interface — `@deprecated Use Domain.Surfaces.MenuMeta` |
| `src/restaurant/surfaces/MenuGroupMeta.ts` | Interface — `@deprecated Use Domain.Surfaces.MenuGroupMeta` |
| `src/restaurant/surfaces/SurfaceConfiguration.ts` | Class + interfaces — `@deprecated Use Domain.Surfaces.SurfaceConfiguration` |
| `src/restaurant/surfaces/KioskConfiguration.ts` | Class — `@deprecated Use Domain.Surfaces.KioskConfiguration` |
| `src/restaurant/surfaces/CheckoutOptions.ts` | Class + interfaces — `@deprecated Use Domain.Surfaces.CheckoutOptions` |
| `src/restaurant/connected-accounts/Token.ts` | Class — `@deprecated Use Domain.ConnectedAccounts.Token` |
| `src/restaurant/onboarding/OnboardingOrder.ts` | Class — `@deprecated Use Domain.Onboarding.OnboardingOrder` |

Old `src/index.ts` exports remain unchanged — backward compatible.

---

## 2. Testing Spec

### 2.1 "Zero Infrastructure" Requirement

All domain-layer tests must pass **without** Firebase initialized. Same rules as Phases 0–3.

### 2.2 Test Helpers

**`src/domain/__tests__/helpers/SurfacesFixtures.ts`:**
```typescript
export function createTestMenuProps(overrides?: Partial<MenuProps>): MenuProps;
export function createTestMenuGroupProps(overrides?: Partial<MenuGroupProps>): MenuGroupProps;
export function createTestSurfaceConfigurationProps(overrides?: Partial<SurfaceConfigurationProps>): SurfaceConfigurationProps;
export function createTestKioskConfigurationProps(overrides?: Partial<KioskConfigurationProps>): KioskConfigurationProps;
export function createTestCheckoutOptionsProps(overrides?: Partial<CheckoutOptionsProps>): CheckoutOptionsProps;
export function createTestTokenProps(overrides?: Partial<TokenProps>): TokenProps;
export function createTestOnboardingOrderProps(overrides?: Partial<OnboardingOrderProps>): OnboardingOrderProps;
```

---

### 2.3 Test Cases — Domain Layer

#### `src/domain/surfaces/__tests__/Menu.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | Constructs with all props | All fields match input |
| 2 | Auto-generates UUID when no Id | Matches UUID pattern |
| 3 | Defaults displayName to null | `menu.displayName === null` |
| 4 | Defaults groups to {} | Empty object |
| 5 | Defaults groupDisplayOrder to [] | Empty array |
| 6 | Defaults coverImageGsl to null | Null |
| 7 | Defaults coverBackgroundImageGsl to null | Null |
| 8 | Defaults coverVideoGsl to null | Null |
| 9 | Defaults logoImageGsl to null | Null |
| 10 | Defaults gratuityRates to [] | Empty array |
| 11 | metadata() returns MenuMeta | `{ name, displayName }` matches |
| 12 | Inherits DomainEntity fields | Has `created`, `updated`, `isDeleted` |
| 13 | Instantiates without Firebase | Test passing = proof |

#### `src/domain/surfaces/__tests__/MenuGroup.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | Constructs with all props | All fields match input |
| 2 | Auto-generates UUID | Matches UUID pattern |
| 3 | Defaults displayName to '' | Empty string |
| 4 | Defaults products to {} | Empty object |
| 5 | Defaults productDisplayOrder to [] | Empty array |
| 6 | Defaults parentGroup to null | Null |
| 7 | Defaults childGroup to null | Null |
| 8 | Defaults mirrorCategoryId to null | Null |
| 9 | metadata() returns MenuGroupMeta | `{ name, displayName }` matches |
| 10 | products stores ProductMeta | Nested structure accessible |
| 11 | Inherits DomainEntity fields | Has base fields |
| 12 | Instantiates without Firebase | Test passing = proof |

#### `src/domain/surfaces/__tests__/SurfaceConfiguration.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | Constructs with all props | All fields match input |
| 2 | Auto-generates UUID | Matches UUID pattern |
| 3 | Defaults coverConfiguration to null | Null |
| 4 | Defaults tipConfiguration to null | Null |
| 5 | Defaults checkoutFlowConfiguration to null | Null |
| 6 | Defaults version to '0.0' | String match |
| 7 | CoverConfiguration interface works | Object literal satisfies interface |
| 8 | CheckoutFlowConfiguration interface works | Object literal satisfies interface |
| 9 | TipConfiguration interface works | Object literal satisfies interface |
| 10 | Inherits DomainEntity fields | Has base fields |
| 11 | Instantiates without Firebase | Test passing = proof |

#### `src/domain/surfaces/__tests__/KioskConfiguration.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | Constructs with all props | All fields match input |
| 2 | Auto-generates UUID | Matches UUID pattern |
| 3 | Defaults unlockCode to null | Null |
| 4 | Defaults checkoutOptionId to null | Null |
| 5 | Defaults version to '1.0' | String match |
| 6 | Inherits DomainEntity fields | Has base fields |
| 7 | Instantiates without Firebase | Test passing = proof |

#### `src/domain/surfaces/__tests__/CheckoutOptions.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | Constructs with all props | All fields match input |
| 2 | Auto-generates UUID | Matches UUID pattern |
| 3 | Defaults tipOptions to null | Null |
| 4 | Defaults fulfillmentOptions to {} | Empty object |
| 5 | CheckoutOptionType enum has expected values | `switch`, `quantity` |
| 6 | TipOptions interface works | Object satisfies interface |
| 7 | FulfillmentOption interface works | Object satisfies interface |
| 8 | ManualIdConfig interface works | Object satisfies interface |
| 9 | Inherits DomainEntity fields | Has base fields |
| 10 | Instantiates without Firebase | Test passing = proof |

#### `src/domain/connected-accounts/__tests__/Token.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | Concrete subclass constructs with all props | All fields match input |
| 2 | Auto-generates UUID | Matches UUID pattern |
| 3 | Stores businessId | Exact match |
| 4 | Stores provider | Exact match |
| 5 | Stores createdBy | Exact match |
| 6 | Inherits DomainEntity fields | Has base fields |
| 7 | Instantiates without Firebase | Test passing = proof |

#### `src/domain/onboarding/__tests__/OnboardingOrder.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | Constructs with all props | All fields match input |
| 2 | Auto-generates UUID | Matches UUID pattern |
| 3 | InvoiceStatus enum has expected values | draft, open, paid, void, uncollectible |
| 4 | Defaults lineItems to [] | Empty array |
| 5 | Stores Address | Nested structure accessible |
| 6 | Stores OrderState | Enum value correct |
| 7 | Inherits DomainEntity fields | Has base fields |
| 8 | Instantiates without Firebase | Test passing = proof |

#### `src/domain/misc/__tests__/Address.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | Address interface works | Object satisfies interface |
| 2 | emptyAddress has all empty strings | All 6 fields are '' |

#### `src/domain/misc/__tests__/BusinessProfile.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | BusinessProfile interface works | Object satisfies interface |
| 2 | address is optional | Object without address compiles |
| 3 | shippingAddress is optional | Object without shippingAddress compiles |

---

### 2.4 Test Cases — Persistence Layer (Repositories)

#### `src/persistence/firestore/__tests__/MenuRepository.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | get() returns Menu when exists | All fields populated |
| 2 | get() returns null when missing | `null` returned |
| 3 | set() serializes all fields correctly | DocumentData shape matches |
| 4 | set() deep-clones groups and groupDisplayOrder | JSON round-tripped |
| 5 | Round-trip preserves data | toFirestore → fromFirestore cycle |
| 6 | fromFirestore defaults optional fields | coverImageGsl, etc. to null |

#### `src/persistence/firestore/__tests__/MenuGroupRepository.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | get() returns MenuGroup when exists | All fields populated |
| 2 | get() returns null when missing | `null` returned |
| 3 | set() serializes all fields correctly | DocumentData shape matches |
| 4 | Round-trip preserves data | All fields match |
| 5 | fromFirestore defaults products to {} | When absent |
| 6 | fromFirestore defaults productDisplayOrder to [] | When absent |

#### `src/persistence/firestore/__tests__/SurfaceConfigurationRepository.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | get() returns SurfaceConfiguration when exists | All fields populated |
| 2 | get() returns null when missing | `null` returned |
| 3 | set() serializes nested configurations | All config objects present |
| 4 | Round-trip preserves data | All fields match |

#### `src/persistence/firestore/__tests__/KioskConfigurationRepository.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | get() returns KioskConfiguration when exists | All fields populated |
| 2 | get() returns null when missing | `null` returned |
| 3 | Round-trip preserves data | All fields match |

#### `src/persistence/firestore/__tests__/CheckoutOptionsRepository.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | get() returns CheckoutOptions when exists | All fields populated |
| 2 | get() returns null when missing | `null` returned |
| 3 | set() deep-clones fulfillmentOptions | JSON round-tripped |
| 4 | Round-trip preserves data | All fields match |
| 5 | fromFirestore defaults tipOptions to null | When absent |

#### `src/persistence/firestore/__tests__/OnboardingOrderRepository.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | get() returns OnboardingOrder when exists | All fields populated |
| 2 | get() returns null when missing | `null` returned |
| 3 | set() serializes all fields correctly | DocumentData shape matches |
| 4 | set() deep-clones lineItems | JSON round-tripped |
| 5 | Round-trip preserves data | All fields match |

#### `src/persistence/firestore/__tests__/MenuMetadataSpec.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | getMetadata returns MenuMeta | `{ name, displayName }` |
| 2 | getMetaLinks returns Surfaces doc path | documentPath matches Surfaces.docRef pattern |
| 3 | getMetaLinks field path includes menu Id | `menus.{id}` format |

#### `src/persistence/firestore/__tests__/MenuGroupMetadataSpec.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | getMetadata returns MenuGroupMeta | `{ name, displayName }` |
| 2 | getMetaLinks returns Surfaces doc path | documentPath matches Surfaces.docRef pattern |
| 3 | getMetaLinks field path includes menuGroup Id | `menuGroups.{id}` format |

---

## 3. Implementation & Testing Tracker

### Domain Layer — Code

- [ ] Create `src/domain/surfaces/` directory
- [ ] Create `src/domain/onboarding/` directory
- [ ] Create `src/domain/misc/` directory
- [ ] `src/domain/misc/Address.ts` — interface + emptyAddress
- [ ] `src/domain/misc/BusinessProfile.ts` — interface
- [ ] `src/domain/misc/index.ts` — barrel export
- [ ] `src/domain/surfaces/MenuMeta.ts` — interface
- [ ] `src/domain/surfaces/MenuGroupMeta.ts` — interface
- [ ] `src/domain/surfaces/Menu.ts` — `MenuProps`, `Menu` class
- [ ] `src/domain/surfaces/MenuGroup.ts` — `MenuGroupProps`, `MenuGroup` class
- [ ] `src/domain/surfaces/SurfaceConfiguration.ts` — class + config interfaces
- [ ] `src/domain/surfaces/KioskConfiguration.ts` — `KioskConfigurationProps`, class
- [ ] `src/domain/surfaces/CheckoutOptions.ts` — class + all nested interfaces + enum
- [ ] `src/domain/surfaces/index.ts` — barrel export
- [ ] `src/domain/connected-accounts/Token.ts` — abstract `Token` class
- [ ] Update `src/domain/connected-accounts/index.ts` — add Token export
- [ ] `src/domain/onboarding/OnboardingOrder.ts` — class + `InvoiceStatus` enum
- [ ] `src/domain/onboarding/index.ts` — barrel export
- [ ] Update `src/domain/index.ts` — add `Surfaces`, `Onboarding`, `Misc` namespace exports

### Domain Layer — Tests

- [ ] `src/domain/__tests__/helpers/SurfacesFixtures.ts` — factory functions for all models
- [ ] `src/domain/surfaces/__tests__/Menu.test.ts` (13 tests)
- [ ] `src/domain/surfaces/__tests__/MenuGroup.test.ts` (12 tests)
- [ ] `src/domain/surfaces/__tests__/SurfaceConfiguration.test.ts` (11 tests)
- [ ] `src/domain/surfaces/__tests__/KioskConfiguration.test.ts` (7 tests)
- [ ] `src/domain/surfaces/__tests__/CheckoutOptions.test.ts` (10 tests)
- [ ] `src/domain/connected-accounts/__tests__/Token.test.ts` (7 tests)
- [ ] `src/domain/onboarding/__tests__/OnboardingOrder.test.ts` (8 tests)
- [ ] `src/domain/misc/__tests__/Address.test.ts` (2 tests)
- [ ] `src/domain/misc/__tests__/BusinessProfile.test.ts` (3 tests)

### Persistence Layer — Code (Repositories)

- [ ] `src/persistence/firestore/MenuRepository.ts`
- [ ] `src/persistence/firestore/MenuGroupRepository.ts`
- [ ] `src/persistence/firestore/SurfaceConfigurationRepository.ts`
- [ ] `src/persistence/firestore/KioskConfigurationRepository.ts`
- [ ] `src/persistence/firestore/CheckoutOptionsRepository.ts`
- [ ] `src/persistence/firestore/TokenRepository.ts`
- [ ] `src/persistence/firestore/OnboardingOrderRepository.ts`

### Persistence Layer — Code (Metadata Specs)

- [ ] `src/persistence/firestore/MenuMetadataSpec.ts`
- [ ] `src/persistence/firestore/MenuGroupMetadataSpec.ts`

### Persistence Layer — Code (Exports)

- [ ] Update `src/persistence/firestore/index.ts` — add repository + metadata spec exports

### Persistence Layer — Tests (Repositories)

- [ ] `src/persistence/firestore/__tests__/MenuRepository.test.ts` (6 tests)
- [ ] `src/persistence/firestore/__tests__/MenuGroupRepository.test.ts` (6 tests)
- [ ] `src/persistence/firestore/__tests__/SurfaceConfigurationRepository.test.ts` (4 tests)
- [ ] `src/persistence/firestore/__tests__/KioskConfigurationRepository.test.ts` (3 tests)
- [ ] `src/persistence/firestore/__tests__/CheckoutOptionsRepository.test.ts` (5 tests)
- [ ] `src/persistence/firestore/__tests__/OnboardingOrderRepository.test.ts` (5 tests)

### Persistence Layer — Tests (Metadata Specs)

- [ ] `src/persistence/firestore/__tests__/MenuMetadataSpec.test.ts` (3 tests)
- [ ] `src/persistence/firestore/__tests__/MenuGroupMetadataSpec.test.ts` (3 tests)

### Deprecation

- [ ] Add `@deprecated` to `src/restaurant/surfaces/Menu.ts`
- [ ] Add `@deprecated` to `src/restaurant/surfaces/MenuGroup.ts`
- [ ] Add `@deprecated` to `src/restaurant/surfaces/MenuMeta.ts`
- [ ] Add `@deprecated` to `src/restaurant/surfaces/MenuGroupMeta.ts`
- [ ] Add `@deprecated` to `src/restaurant/surfaces/SurfaceConfiguration.ts`
- [ ] Add `@deprecated` to `src/restaurant/surfaces/KioskConfiguration.ts`
- [ ] Add `@deprecated` to `src/restaurant/surfaces/CheckoutOptions.ts`
- [ ] Add `@deprecated` to `src/restaurant/connected-accounts/Token.ts`
- [ ] Add `@deprecated` to `src/restaurant/onboarding/OnboardingOrder.ts`

### Integration Verification

- [ ] `npm run tsc` passes with no errors
- [ ] `npx eslint src/` passes
- [ ] `npm run test` — All tests pass (existing + ~108 new)
- [ ] All Phase 0/1/2/3 tests still pass (no regressions)
- [ ] Old imports still compile — backward compatible
- [ ] Domain classes instantiate without Firebase initialized

---

## Files Changed Summary

| Action | File | Description |
|--------|------|-------------|
| **Create** | `src/domain/misc/Address.ts` | Address interface + emptyAddress |
| **Create** | `src/domain/misc/BusinessProfile.ts` | BusinessProfile interface |
| **Create** | `src/domain/misc/index.ts` | Barrel export |
| **Create** | `src/domain/surfaces/MenuMeta.ts` | MenuMeta interface |
| **Create** | `src/domain/surfaces/MenuGroupMeta.ts` | MenuGroupMeta interface |
| **Create** | `src/domain/surfaces/Menu.ts` | Pure domain model |
| **Create** | `src/domain/surfaces/MenuGroup.ts` | Pure domain model |
| **Create** | `src/domain/surfaces/SurfaceConfiguration.ts` | Domain model + config interfaces |
| **Create** | `src/domain/surfaces/KioskConfiguration.ts` | Pure domain model |
| **Create** | `src/domain/surfaces/CheckoutOptions.ts` | Domain model + nested interfaces |
| **Create** | `src/domain/surfaces/index.ts` | Barrel export |
| **Create** | `src/domain/connected-accounts/Token.ts` | Abstract domain model |
| **Create** | `src/domain/onboarding/OnboardingOrder.ts` | Domain model + InvoiceStatus enum |
| **Create** | `src/domain/onboarding/index.ts` | Barrel export |
| **Create** | `src/persistence/firestore/MenuRepository.ts` | Repository implementation |
| **Create** | `src/persistence/firestore/MenuGroupRepository.ts` | Repository implementation |
| **Create** | `src/persistence/firestore/SurfaceConfigurationRepository.ts` | Repository implementation |
| **Create** | `src/persistence/firestore/KioskConfigurationRepository.ts` | Repository implementation |
| **Create** | `src/persistence/firestore/CheckoutOptionsRepository.ts` | Repository implementation |
| **Create** | `src/persistence/firestore/TokenRepository.ts` | Base repository (abstract fromFirestore) |
| **Create** | `src/persistence/firestore/OnboardingOrderRepository.ts` | Repository implementation |
| **Create** | `src/persistence/firestore/MenuMetadataSpec.ts` | Menu → Surfaces metadata denormalization |
| **Create** | `src/persistence/firestore/MenuGroupMetadataSpec.ts` | MenuGroup → Surfaces metadata denormalization |
| **Create** | 10 domain test files | ~73 domain tests |
| **Create** | 8 persistence test files | ~35 persistence tests |
| **Modify** | `src/domain/connected-accounts/index.ts` | Add Token export |
| **Modify** | `src/domain/index.ts` | Add Surfaces, Onboarding, Misc namespace exports |
| **Modify** | `src/persistence/firestore/index.ts` | Add repository + metadata spec exports |
| **Modify** | 9 old files | Add `@deprecated` JSDoc |

**Total new tests:** ~108

---

## Dependency Graph Position

```
Phase 0 (done) ── Phase 1 (done) ── Phase 2 (done)
                                          │
                                     Phase 3 (done — Catalog)
                                          │
                                  ▶ Phase 4 (this — Surfaces + Remaining) ◀
                                          │
                                     Phase 5 (Roots)
                                          │
                                     Phase 6 (Cleanup)
```

---

## Entities NOT Migrated in This Phase

| Entity | Reason |
|--------|--------|
| `EventNotification` | Uses Firebase Realtime Database (not Firestore). Deeply coupled to RTDB transactions. Stays as-is — no domain extraction needed. |
| `SemaphoreV2` | Uses Firebase Realtime Database. RTDB-specific lock pattern. Stays as-is. |
| `Onboarding` (root) | Root aggregate class — migrated in Phase 5. Contains business logic (`repair()`, `createMenu()`) that stays in persistence/application layer. |
| All root aggregates | Phase 5 scope. |
