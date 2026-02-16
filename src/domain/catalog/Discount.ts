import { BaseEntity, baseEntityDefaults } from '../BaseEntity';
import { requireNonEmptyString, requireNonNegativeNumber } from '../validation';
import { LinkedObjectMap } from '../LinkedObjectRef';

export enum DiscountType {
  percentage = 'percentage',
  amount = 'amount',
  unknown = 'unknown',
}

export interface Discount extends BaseEntity {
  name: string;
  description: string;
  couponCode: string;
  type: DiscountType;
  value: number;
  isActive: boolean;
  linkedObjects: LinkedObjectMap;
}

export interface DiscountInput {
  name: string;
  type: DiscountType;
  value: number;
  isActive: boolean;
  description?: string;
  couponCode?: string;
  linkedObjects?: LinkedObjectMap;
}

export function createDiscount(input: DiscountInput & Partial<BaseEntity>): Discount {
  requireNonEmptyString('name', input.name);
  requireNonNegativeNumber('value', input.value);
  return {
    ...baseEntityDefaults(input),
    name: input.name,
    description: input.description ?? '',
    couponCode: input.couponCode ?? '',
    type: input.type,
    value: input.value,
    isActive: input.isActive,
    linkedObjects: input.linkedObjects ?? {},
  };
}
