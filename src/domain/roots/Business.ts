import { BaseEntity, baseEntityDefaults } from '../BaseEntity';
import { requireNonEmptyString } from '../validation';
import { BusinessProfile } from '../misc/BusinessProfile';

export enum BusinessType {
  restaurant = 'restaurant',
}

export enum Role {
  sysadmin = 'sysadmin',
  owner = 'owner',
}

export interface Business extends BaseEntity {
  agent: string;
  createdBy: string;
  type: BusinessType;
  businessProfile: BusinessProfile;
  roles: { [uid: string]: Role };
}

export function createBusinessRoot(input: Partial<Business> & {
  agent: string;
  createdBy: string;
  type: BusinessType;
  businessProfile: BusinessProfile;
}): Business {
  requireNonEmptyString('agent', input.agent);
  requireNonEmptyString('createdBy', input.createdBy);
  return {
    ...baseEntityDefaults(input),
    agent: input.agent,
    createdBy: input.createdBy,
    type: input.type,
    businessProfile: input.businessProfile,
    roles: input.roles ?? {},
  };
}
