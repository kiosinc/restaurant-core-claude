import { BaseEntity, baseEntityDefaults } from '../BaseEntity';
import { requireNonEmptyString } from '../validation';

export interface Token extends BaseEntity {
  createdBy: string;
  businessId: string;
  provider: string;
}

export function createToken(input: Partial<Token> & { createdBy: string; businessId: string; provider: string }): Token {
  requireNonEmptyString('createdBy', input.createdBy);
  requireNonEmptyString('businessId', input.businessId);
  requireNonEmptyString('provider', input.provider);
  return {
    ...baseEntityDefaults(input),
    createdBy: input.createdBy,
    businessId: input.businessId,
    provider: input.provider,
  };
}
