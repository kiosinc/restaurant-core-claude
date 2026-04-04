import { BaseEntity, baseEntityDefaults } from '../BaseEntity';
import { requireString, requireNonNegativeNumber } from '../validation';
import { LinkedObjectMap } from '../LinkedObjectRef';

export interface TaxRate extends BaseEntity {
  name: string;
  rate: number;
  isCalculatedSubTotalPhase: boolean;
  isInclusive: boolean;
  linkedObjects: LinkedObjectMap;
}

export interface TaxRateInput {
  name: string;
  rate: number;
  isCalculatedSubTotalPhase: boolean;
  isInclusive: boolean;
  linkedObjects?: LinkedObjectMap;
}

export function createTaxRate(input: TaxRateInput & Partial<BaseEntity>): TaxRate {
  requireString('name', input.name);
  requireNonNegativeNumber('rate', input.rate);
  return {
    ...baseEntityDefaults(input),
    name: input.name,
    rate: input.rate,
    isCalculatedSubTotalPhase: input.isCalculatedSubTotalPhase,
    isInclusive: input.isInclusive,
    linkedObjects: input.linkedObjects ?? {},
  };
}
