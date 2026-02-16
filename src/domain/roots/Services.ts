import { BaseEntity, baseEntityDefaults } from '../BaseEntity';
import { requireNonNegativeNumber } from '../validation';

export interface Services extends BaseEntity {
  kioskFeeRate: number;
  experiments: { [key: string]: boolean };
}

export function createServices(input: Partial<Services>): Services {
  if (input.kioskFeeRate !== undefined) requireNonNegativeNumber('kioskFeeRate', input.kioskFeeRate);
  return {
    ...baseEntityDefaults(input),
    kioskFeeRate: input.kioskFeeRate ?? 1.5,
    experiments: input.experiments ?? {},
  };
}
