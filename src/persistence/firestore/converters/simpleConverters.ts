import { createConverter, FieldTransform } from './converterFactory';
import { locationInventoryToFirestore, locationInventoryFromFirestore } from './inventoryCountHelper';
import { PathResolver } from '../PathResolver';

import { Catalog, createCatalog } from '../../../domain/roots/Catalog';
import { ConnectedAccounts, createConnectedAccounts } from '../../../domain/roots/ConnectedAccounts';
import { Services, createServices } from '../../../domain/roots/Services';
import { LocationsRoot, createLocationsRoot } from '../../../domain/roots/Locations';
import { Surfaces, createSurfaces } from '../../../domain/roots/Surfaces';
import { Onboarding, createOnboarding } from '../../../domain/roots/Onboarding';
import { Category, createCategory } from '../../../domain/catalog/Category';
import { Discount, createDiscount } from '../../../domain/catalog/Discount';
import { TaxRate, createTaxRate } from '../../../domain/catalog/TaxRate';
import { Product, createProduct } from '../../../domain/catalog/Product';
import { OptionSet, createOptionSet } from '../../../domain/catalog/OptionSet';
import { Option, createOption } from '../../../domain/catalog/Option';
import { Menu, createMenu } from '../../../domain/surfaces/Menu';
import { MenuGroup, createMenuGroup } from '../../../domain/surfaces/MenuGroup';
import { SurfaceConfiguration, createSurfaceConfiguration } from '../../../domain/surfaces/SurfaceConfiguration';
import { KioskConfiguration, createKioskConfiguration } from '../../../domain/surfaces/KioskConfiguration';
import { CheckoutOptions, createCheckoutOptions } from '../../../domain/surfaces/CheckoutOptions';
import { OnboardingOrder, createOnboardingOrder } from '../../../domain/onboarding/OnboardingOrder';

// Shared field transform for entities with locationInventory
const inventoryTransform: FieldTransform<{ locationInventory: any }> = {
  toFirestore: (entity) => ({ locationInventory: locationInventoryToFirestore(entity.locationInventory) }),
  fromFirestore: (data) => ({ locationInventory: locationInventoryFromFirestore(data.locationInventory) }),
};

// Roots
export const catalogConverter = createConverter<Catalog>('catalog', (bid) => PathResolver.publicCollection(bid), createCatalog);
export const connectedAccountsConverter = createConverter<ConnectedAccounts>('connectedAccounts', (bid) => PathResolver.privateCollection(bid), createConnectedAccounts);
export const servicesConverter = createConverter<Services>('services', (bid) => PathResolver.privateCollection(bid), createServices);
export const locationsRootConverter = createConverter<LocationsRoot>('locationsRoot', (bid) => PathResolver.publicCollection(bid), createLocationsRoot);
export const surfacesRootConverter = createConverter<Surfaces>('surfacesRoot', (bid) => PathResolver.publicCollection(bid), createSurfaces);
export const onboardingConverter = createConverter<Onboarding>('onboarding', (bid) => PathResolver.privateCollection(bid), createOnboarding);

// Catalog (simple)
export const categoryConverter = createConverter<Category>('category', (bid) => PathResolver.categoriesCollection(bid), createCategory);
export const discountConverter = createConverter<Discount>('discount', (bid) => PathResolver.discountsCollection(bid), createDiscount);
export const taxRateConverter = createConverter<TaxRate>('taxRate', (bid) => PathResolver.taxRatesCollection(bid), createTaxRate);

// Catalog (with inventory)
export const productConverter = createConverter<Product>('product', (bid) => PathResolver.productsCollection(bid), createProduct, inventoryTransform);
export const optionSetConverter = createConverter<OptionSet>('optionSet', (bid) => PathResolver.optionSetsCollection(bid), createOptionSet, inventoryTransform);
export const optionConverter = createConverter<Option>('option', (bid) => PathResolver.optionsCollection(bid), createOption, inventoryTransform);

// Surfaces
export const menuConverter = createConverter<Menu>('menu', (bid) => PathResolver.menusCollection(bid), createMenu);
export const menuGroupConverter = createConverter<MenuGroup>('menuGroup', (bid) => PathResolver.menuGroupsCollection(bid), createMenuGroup);
export const surfaceConfigurationConverter = createConverter<SurfaceConfiguration>('surfaceConfiguration', (bid) => PathResolver.surfaceConfigurationsCollection(bid), createSurfaceConfiguration);
export const kioskConfigurationConverter = createConverter<KioskConfiguration>('kioskConfiguration', (bid) => PathResolver.kioskConfigurationsCollection(bid), createKioskConfiguration);
export const checkoutOptionsConverter = createConverter<CheckoutOptions>('checkoutOptions', (bid) => PathResolver.checkoutOptionsCollection(bid), createCheckoutOptions);

// Onboarding
export const onboardingOrderConverter = createConverter<OnboardingOrder>('onboardingOrder', (bid) => PathResolver.onboardingOrdersCollection(bid), createOnboardingOrder);
