import { BaseEntity, baseEntityDefaults } from '../BaseEntity';
import { requireString, requireNonNegativeNumber } from '../validation';
import { LinkedObjectMap } from '../LinkedObjectRef';

export enum ServiceChargeType {
  percentage = 'percentage',
  amount = 'amount',
}

export interface ServiceCharge extends BaseEntity {
  name: string;
  value: number;
  type: ServiceChargeType;
  isCalculatedSubTotalPhase: boolean;
  isTaxable: boolean;
  linkedObjects: LinkedObjectMap;
}

export interface ServiceChargeInput {
  name: string;
  value: number;
  type: ServiceChargeType;
  isCalculatedSubTotalPhase: boolean;
  isTaxable: boolean;
  linkedObjects?: LinkedObjectMap;
}

export function createServiceCharge(input: ServiceChargeInput & Partial<BaseEntity>): ServiceCharge {
  requireString('name', input.name);
  requireNonNegativeNumber('value', input.value);
  return {
    ...baseEntityDefaults(input),
    name: input.name,
    value: input.value,
    type: input.type,
    isCalculatedSubTotalPhase: input.isCalculatedSubTotalPhase,
    isTaxable: input.isTaxable,
    linkedObjects: input.linkedObjects ?? {},
  };
}
