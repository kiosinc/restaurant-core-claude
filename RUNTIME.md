# Plan: Add Runtime Validation to Domain Factory Functions

## Context

Factory functions (`createProduct`, `createOrder`, etc.) accept any values without runtime validation. No price range checks, no required-field enforcement beyond TypeScript types, no business rule validation. Since this library is consumed by JS callers and deserializes from Firestore, TypeScript types alone don't guarantee correctness at runtime.

## Approach

Inline validation in each factory function using a small set of reusable guard helpers. No external dependencies. Throw-on-first-failure with a `ValidationError` that names the offending field. Validation applies everywhere — including Firestore deserialization — so if an entity exists, it's valid.

## New Files

### `src/domain/validation.ts`
- `ValidationError` class (extends `Error`, has `field: string` property)
- `requireNonEmptyString(field, value)` — rejects empty/whitespace/non-string
- `requireNonNegativeNumber(field, value)` — rejects negative/NaN/non-number
- `requireNonNegativeInteger(field, value)` — same + rejects floats
- `requireMinLessOrEqual(minField, minVal, maxField, maxVal)` — cross-field constraint
- `requireIndexInBounds(field, index, arrayLength, arrayField)` — bounds check

### `src/domain/__tests__/validation.test.ts`
- Unit tests for each guard function (~25 tests)

## Modified Files — Domain Models

Each factory gets validation calls at the top, before the object spread. The rules per model:

| Model | File | Rules |
|-------|------|-------|
| Product | `catalog/Product.ts` | `name` nonEmpty, `minPrice` nonNeg, `maxPrice` nonNeg, `minPrice <= maxPrice`, `variationCount` nonNegInt |
| Option | `catalog/Option.ts` | `name` nonEmpty, `price` nonNeg |
| OptionSet | `catalog/OptionSet.ts` | `name` nonEmpty, `minSelection` nonNegInt, `maxSelection` nonNegInt, `minSelection <= maxSelection`, `displayOrder` nonNegInt, `displayTier` nonNegInt |
| Category | `catalog/Category.ts` | `name` nonEmpty |
| TaxRate | `catalog/TaxRate.ts` | `name` nonEmpty, `rate` nonNeg |
| Discount | `catalog/Discount.ts` | `name` nonEmpty, `value` nonNeg |
| ServiceCharge | `catalog/ServiceCharge.ts` | `name` nonEmpty, `value` nonNeg |
| Order | `orders/Order.ts` | `businessId` nonEmpty, `locationId` nonEmpty, `menuId` nonEmpty, `channel` nonEmpty, `agent` nonEmpty, `currency` nonEmpty, `totalAmount` nonNeg, `totalDiscountAmount` nonNeg, `totalTaxAmount` nonNeg, `totalSurchargeAmount` nonNeg, `totalTipAmount` nonNeg |
| Menu | `surfaces/Menu.ts` | `name` nonEmpty |
| MenuGroup | `surfaces/MenuGroup.ts` | `name` nonEmpty |
| SurfaceConfiguration | `surfaces/SurfaceConfiguration.ts` | `name` nonEmpty |
| KioskConfiguration | `surfaces/KioskConfiguration.ts` | `name` nonEmpty |
| CheckoutOptions | `surfaces/CheckoutOptions.ts` | `name` nonEmpty |
| Location | `locations/Location.ts` | `businessId` nonEmpty, `name` nonEmpty |
| Event | `connected-accounts/Event.ts` | `provider` nonEmpty, `type` nonEmpty |
| Token | `connected-accounts/Token.ts` | `createdBy` nonEmpty, `businessId` nonEmpty, `provider` nonEmpty |
| Business | `roots/Business.ts` | `agent` nonEmpty, `createdBy` nonEmpty |
| OnboardingOrder | `onboarding/OnboardingOrder.ts` | `invoiceId` nonEmpty, `totalAmount` nonNeg |
| Services | `roots/Services.ts` | `kioskFeeRate` nonNeg (when provided) |

**Skipped models** (no meaningful fields to validate): Catalog, ConnectedAccounts, LocationsRoot, Surfaces, Onboarding, OrderSettings.

## Modified Files — Tests

Add a `describe('validation', ...)` block to each model's existing test file (19 test files). Each block tests that invalid input throws `ValidationError` and valid edge cases (e.g., zero price, equal min/max) pass.

## Modified Files — Exports

`src/domain/index.ts` — add one export line for `ValidationError` and the guard functions.

## Existing test fixtures to update

Some test fixtures (`CatalogFixtures.ts`, `OrderFixtures.ts`, etc.) may create entities with values that now fail validation (e.g., empty-string names). These will be fixed as encountered.

## Implementation order

1. Create `validation.ts` + `validation.test.ts`, update `domain/index.ts`
2. Catalog models (Product, Option, OptionSet, Category, TaxRate, Discount, ServiceCharge) + their tests
3. Order + tests
4. Surfaces, Locations, ConnectedAccounts, Roots, Onboarding + their tests

## Verification

1. `npm test` — all existing 446 tests pass + new validation tests pass
2. `npx eslint src/` — 0 errors
3. `npm run tsc` — compiles cleanly
