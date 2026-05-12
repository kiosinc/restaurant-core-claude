import { OptionInput } from '../../catalog/Option';
import { OptionSetInput } from '../../catalog/OptionSet';
import { ProductInput } from '../../catalog/Product';
import { CategoryInput } from '../../catalog/Category';
import { TaxRateInput } from '../../catalog/TaxRate';
import { DiscountInput, DiscountType } from '../../catalog/Discount';
import { ServiceChargeInput, ServiceChargeType } from '../../catalog/ServiceCharge';
import { InventoryCount, InventoryCountState } from '../../catalog/InventoryCount';
import { BaseEntity } from '../../BaseEntity';

export function createTestOptionInput(overrides?: Partial<OptionInput>): OptionInput {
  return {
    name: 'Test Option',
    price: 100,
    isActive: true,
    ...overrides,
  };
}

export function createTestOptionSetInput(overrides?: Partial<OptionSetInput>): OptionSetInput {
  return {
    name: 'Test OptionSet',
    minSelection: 0,
    maxSelection: 1,
    displayOrder: 0,
    displayTier: 0,
    isActive: true,
    ...overrides,
  };
}

export function createTestProductInput(overrides?: Partial<ProductInput>): ProductInput {
  return {
    name: 'Test Product',
    minPrice: 500,
    maxPrice: 500,
    variationCount: 1,
    isActive: true,
    ...overrides,
  };
}

export function createTestCategoryInput(overrides?: Partial<CategoryInput>): CategoryInput {
  return {
    name: 'Test Category',
    ...overrides,
  };
}

export function createTestTaxRateInput(overrides?: Partial<TaxRateInput & BaseEntity>): TaxRateInput & Partial<BaseEntity> {
  return {
    name: 'Test Tax',
    rate: 0.08,
    isCalculatedSubTotalPhase: true,
    isInclusive: false,
    ...overrides,
  };
}

export function createTestDiscountInput(overrides?: Partial<DiscountInput & BaseEntity>): DiscountInput & Partial<BaseEntity> {
  return {
    name: 'Test Discount',
    type: DiscountType.percentage,
    value: 10,
    isActive: true,
    ...overrides,
  };
}

export function createTestServiceChargeInput(overrides?: Partial<ServiceChargeInput & BaseEntity>): ServiceChargeInput & Partial<BaseEntity> {
  return {
    name: 'Test Service Charge',
    value: 200,
    type: ServiceChargeType.amount,
    isCalculatedSubTotalPhase: false,
    isTaxable: false,
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
