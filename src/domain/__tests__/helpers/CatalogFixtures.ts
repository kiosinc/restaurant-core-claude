import { OptionProps } from '../../catalog/Option';
import { OptionSetProps } from '../../catalog/OptionSet';
import { ProductProps } from '../../catalog/Product';
import { CategoryProps } from '../../catalog/Category';
import { TaxRateProps } from '../../catalog/TaxRate';
import { DiscountProps, DiscountType } from '../../catalog/Discount';
import { ServiceChargeProps, ServiceChargeType } from '../../catalog/ServiceCharge';
import { InventoryCount, InventoryCountState } from '../../catalog/InventoryCount';

export function createTestOptionProps(overrides?: Partial<OptionProps>): OptionProps {
  return {
    name: 'Test Option',
    price: 100,
    sku: null,
    gtin: null,
    imageUrls: [],
    imageGsls: [],
    locationPrices: {},
    locationInventory: {},
    isActive: true,
    linkedObjects: {},
    ...overrides,
  };
}

export function createTestOptionSetProps(overrides?: Partial<OptionSetProps>): OptionSetProps {
  return {
    name: 'Test OptionSet',
    options: {},
    minSelection: 0,
    maxSelection: 1,
    displayOrder: 0,
    displayTier: 0,
    optionDisplayOrder: [],
    preselectedOptionIds: [],
    imageUrls: [],
    imageGsls: [],
    locationInventory: {},
    isActive: true,
    linkedObjects: {},
    ...overrides,
  };
}

export function createTestProductProps(overrides?: Partial<ProductProps>): ProductProps {
  return {
    name: 'Test Product',
    caption: '',
    description: '',
    imageUrls: [],
    imageGsls: [],
    optionSets: {},
    optionSetsSelection: {},
    minPrice: 500,
    maxPrice: 500,
    variationCount: 1,
    locationInventory: {},
    isActive: true,
    linkedObjects: {},
    ...overrides,
  };
}

export function createTestCategoryProps(overrides?: Partial<CategoryProps>): CategoryProps {
  return {
    name: 'Test Category',
    products: {},
    productDisplayOrder: [],
    imageUrls: [],
    imageGsls: [],
    linkedObjects: {},
    ...overrides,
  };
}

export function createTestTaxRateProps(overrides?: Partial<TaxRateProps>): TaxRateProps {
  return {
    name: 'Test Tax',
    rate: 0.08,
    isCalculatedSubTotalPhase: true,
    isInclusive: false,
    linkedObjects: {},
    ...overrides,
  };
}

export function createTestDiscountProps(overrides?: Partial<DiscountProps>): DiscountProps {
  return {
    name: 'Test Discount',
    description: '',
    couponCode: '',
    type: DiscountType.percentage,
    value: 10,
    isActive: true,
    linkedObjects: {},
    ...overrides,
  };
}

export function createTestServiceChargeProps(overrides?: Partial<ServiceChargeProps>): ServiceChargeProps {
  return {
    name: 'Test Service Charge',
    value: 200,
    type: ServiceChargeType.amount,
    isCalculatedSubTotalPhase: false,
    isTaxable: false,
    linkedObjects: {},
    ...overrides,
  };
}

export function createTestInventoryCount(overrides?: Partial<InventoryCount>): InventoryCount {
  return {
    count: 10,
    state: InventoryCountState.inStock,
    isAvailable: true,
    ...overrides,
  };
}
