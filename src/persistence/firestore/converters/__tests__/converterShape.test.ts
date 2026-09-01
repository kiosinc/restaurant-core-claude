import { describe, it, expect } from 'vitest';
import { undefinedPaths } from '../../../../domain/__tests__/helpers/undefinedPaths';
import * as Converters from '../index';
import { createCatalog } from '../../../../domain/roots/Catalog';
import { createConnectedAccounts } from '../../../../domain/roots/ConnectedAccounts';
import { createServices } from '../../../../domain/roots/Services';
import { createLocationsRoot } from '../../../../domain/roots/Locations';
import { createSurfaces } from '../../../../domain/roots/Surfaces';
import { createOnboarding } from '../../../../domain/roots/Onboarding';
import { createOrderSettings } from '../../../../domain/roots/Orders';
import { createBusinessRoot } from '../../../../domain/roots/Business';
import { createCategory } from '../../../../domain/catalog/Category';
import { createDiscount } from '../../../../domain/catalog/Discount';
import { createTaxRate } from '../../../../domain/catalog/TaxRate';
import { createProduct } from '../../../../domain/catalog/Product';
import { createOptionSet } from '../../../../domain/catalog/OptionSet';
import { createOption } from '../../../../domain/catalog/Option';
import { createServiceCharge } from '../../../../domain/catalog/ServiceCharge';
import { createMenu } from '../../../../domain/surfaces/Menu';
import { createMenuGroup } from '../../../../domain/surfaces/MenuGroup';
import { createSurfaceConfiguration } from '../../../../domain/surfaces/SurfaceConfiguration';
import { createKioskConfiguration } from '../../../../domain/surfaces/KioskConfiguration';
import { createCheckoutOptions } from '../../../../domain/surfaces/CheckoutOptions';
import { createOnboardingOrder } from '../../../../domain/onboarding/OnboardingOrder';
import { createLocation } from '../../../../domain/locations/Location';
import { createEvent } from '../../../../domain/connected-accounts/Event';
import { createOrder } from '../../../../domain/orders/Order';
import { OrderType } from '../../../../domain/orders/OrderSymbols';

/**
 * #204 shape guard at the SERIALIZATION boundary, one level below #200's `*Meta` guard.
 *
 * `toFirestore` spreads the entity, so any key the factory left `undefined` is carried into the
 * written document — and businesses, childs and webhook-receiver all write converter output to a
 * Firestore instance with `ignoreUndefinedProperties` off, where that rejects the whole document.
 * `converterFactory.toFirestore` now strips, so this asserts the property the strip buys rather
 * than the strip's own mechanics (those live in `sanitize.test.ts`).
 *
 * Every case hydrates from the barest legacy document its factory accepts — exactly the fields it
 * hard-requires, nothing defaulted for it — because that is the input that produces the
 * `undefined`s in the first place (`createDiscount` never defaults `type`/`isActive`,
 * `createOnboardingOrder` never defaults `orderStatus`, `createProduct` used to emit
 * `calorieCount: undefined`). `as unknown as` mirrors the real read path: Firestore hands the
 * factory untyped `DocumentData`, so the input type is no guarantee at runtime.
 */
type MinimalInput<F extends (input: never) => unknown> = Parameters<F>[0];

const legacyProduct = () => createProduct({ name: 'Legacy' } as unknown as MinimalInput<typeof createProduct>);

const legacyOrderInput = {
  businessId: 'biz-1',
  locationId: 'loc-1',
  menuId: 'menu-1',
  channel: 'kiosk',
  agent: 'ios',
  currency: 'USD',
  totalAmount: 0,
  totalDiscountAmount: 0,
  totalTaxAmount: 0,
  totalSurchargeAmount: 0,
  totalTipAmount: 0,
};

const converterCases: Array<{ name: string; write: () => unknown }> = [
  {
    name: 'catalogConverter',
    write: () => Converters.catalogConverter.toFirestore(createCatalog({})),
  },
  {
    name: 'connectedAccountsConverter',
    write: () => Converters.connectedAccountsConverter.toFirestore(createConnectedAccounts({})),
  },
  {
    name: 'servicesConverter',
    write: () => Converters.servicesConverter.toFirestore(createServices({})),
  },
  {
    name: 'locationsRootConverter',
    write: () => Converters.locationsRootConverter.toFirestore(createLocationsRoot({})),
  },
  {
    name: 'surfacesRootConverter',
    write: () => Converters.surfacesRootConverter.toFirestore(createSurfaces({})),
  },
  {
    name: 'onboardingConverter',
    write: () => Converters.onboardingConverter.toFirestore(
      createOnboarding({} as unknown as MinimalInput<typeof createOnboarding>),
    ),
  },
  {
    name: 'orderSettingsConverter',
    write: () => Converters.orderSettingsConverter.toFirestore(
      createOrderSettings({} as unknown as MinimalInput<typeof createOrderSettings>),
    ),
  },
  {
    name: 'businessConverter',
    // `businessProfile` is the one field the transform dereferences, so it cannot be dropped; the
    // absent `type` is what this case exercises.
    write: () => Converters.businessConverter.toFirestore(createBusinessRoot({
      agent: 'ios', createdBy: 'user-1', businessProfile: { name: 'Legacy' },
    } as unknown as MinimalInput<typeof createBusinessRoot>)),
  },
  {
    name: 'categoryConverter',
    write: () => Converters.categoryConverter.toFirestore(createCategory({ name: 'Legacy' })),
  },
  {
    name: 'discountConverter',
    write: () => Converters.discountConverter.toFirestore(
      createDiscount({ name: 'Legacy', value: 0 } as unknown as MinimalInput<typeof createDiscount>),
    ),
  },
  {
    name: 'taxRateConverter',
    write: () => Converters.taxRateConverter.toFirestore(
      createTaxRate({ name: 'Legacy', rate: 0 } as unknown as MinimalInput<typeof createTaxRate>),
    ),
  },
  {
    name: 'serviceChargeConverter',
    write: () => Converters.serviceChargeConverter.toFirestore(
      createServiceCharge({ name: 'Legacy', value: 0 } as unknown as MinimalInput<typeof createServiceCharge>),
    ),
  },
  {
    name: 'productConverter',
    write: () => Converters.productConverter.toFirestore(legacyProduct()),
  },
  {
    name: 'optionSetConverter',
    write: () => Converters.optionSetConverter.toFirestore(createOptionSet({
      name: 'Legacy', minSelection: 0, maxSelection: 1, displayOrder: 0, displayTier: 0,
    } as unknown as MinimalInput<typeof createOptionSet>)),
  },
  {
    name: 'optionConverter',
    write: () => Converters.optionConverter.toFirestore(
      createOption({ name: 'Legacy', price: 0 } as unknown as MinimalInput<typeof createOption>),
    ),
  },
  {
    name: 'menuConverter',
    write: () => Converters.menuConverter.toFirestore(createMenu({ name: 'Legacy' })),
  },
  {
    name: 'menuGroupConverter',
    write: () => Converters.menuGroupConverter.toFirestore(createMenuGroup({ name: 'Legacy' })),
  },
  {
    name: 'surfaceConfigurationConverter',
    write: () => Converters.surfaceConfigurationConverter.toFirestore(
      createSurfaceConfiguration({ name: 'Legacy' } as unknown as MinimalInput<typeof createSurfaceConfiguration>),
    ),
  },
  {
    name: 'kioskConfigurationConverter',
    write: () => Converters.kioskConfigurationConverter.toFirestore(createKioskConfiguration({ name: 'Legacy' })),
  },
  {
    name: 'checkoutOptionsConverter',
    write: () => Converters.checkoutOptionsConverter.toFirestore(
      createCheckoutOptions({ name: 'Legacy' } as unknown as MinimalInput<typeof createCheckoutOptions>),
    ),
  },
  {
    name: 'onboardingOrderConverter',
    write: () => Converters.onboardingOrderConverter.toFirestore(createOnboardingOrder({
      invoiceId: 'inv-1', totalAmount: 0,
    } as unknown as MinimalInput<typeof createOnboardingOrder>)),
  },
  {
    name: 'locationConverter',
    write: () => Converters.locationConverter.toFirestore(createLocation({
      businessId: 'biz-1', name: 'Legacy',
    } as unknown as MinimalInput<typeof createLocation>)),
  },
  {
    name: 'eventConverter',
    write: () => Converters.eventConverter.toFirestore(
      createEvent({ provider: 'square', type: 'catalog.version.updated' } as unknown as MinimalInput<typeof createEvent>),
    ),
  },
  {
    name: 'orderConverter',
    write: () => Converters.orderConverter.toFirestore(
      createOrder(legacyOrderInput as unknown as MinimalInput<typeof createOrder>),
    ),
  },
];

describe('converter output shape (#204 boundary guard)', () => {
  it.each(converterCases)('$name writes no undefined value from a legacy document', ({ write }) => {
    expect(undefinedPaths(write())).toEqual([]);
  });

  it('covers every converter createConverter builds', () => {
    // Guards the guard: a converter added later without a case above would otherwise pass by
    // simply not being tested. Enumerated from the barrel rather than hardcoded, so the new
    // export fails here on the day it lands.
    //
    // tokenConverter is deliberately excluded, not overlooked: it is hand-written
    // (converters/tokenConverter.ts) rather than produced by createConverter, so the boundary
    // strip does not cover it and asserting the strip's property of it would be a false pass.
    const exported = Object.entries(Converters)
      .filter(([name, value]) => name !== 'tokenConverter'
        && typeof value === 'object' && value !== null && 'toFirestore' in value)
      .map(([name]) => name);

    expect(exported.sort()).toEqual(converterCases.map((c) => c.name).sort());
  });

  it('reports a path when an undefined does survive at depth', () => {
    // Anti-tautology: without this, every assertion above would still pass if `undefinedPaths`
    // were blind to this shape — or if `toFirestore` returned an empty object.
    const written = Converters.productConverter.toFirestore(legacyProduct());
    expect(Object.keys(written).length).toBeGreaterThan(0);
    expect(undefinedPaths({ ...written, optionSets: { 'os-1': { name: undefined } } }))
      .toEqual(['optionSets.os-1.name']);
  });

  it('hands a nested Date to Firestore by reference rather than rebuilding it', () => {
    // orderConverter's transform stringifies the TOP-LEVEL timestamp only, so every other Date
    // travels through `...fields` as a live Date. Reference identity is what proves the strip
    // returned it untouched instead of walking its (empty) entries into a plain object.
    const scheduledTime = new Date('2026-01-02T03:04:05.000Z');
    const order = createOrder({
      ...legacyOrderInput,
      fulfillment: {
        type: OrderType.toGo, typeMetaData: null, scheduledTime, contact: null, displayId: null,
      },
    } as unknown as MinimalInput<typeof createOrder>);

    const written = Converters.orderConverter.toFirestore(order) as {
      timestamp: unknown;
      fulfillment: { scheduledTime: Date };
    };

    expect(written.fulfillment.scheduledTime).toBe(scheduledTime);
    expect(typeof written.timestamp).toBe('string');
  });
});
