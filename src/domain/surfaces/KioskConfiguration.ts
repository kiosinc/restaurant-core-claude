import { BaseEntity, baseEntityDefaults } from '../BaseEntity';
import { requireString } from '../validation';

export interface KioskConfiguration extends BaseEntity {
  name: string;
  unlockCode: string | null;
  checkoutOptionId: string | null;
  version: string;
}

export function createKioskConfiguration(input: Partial<KioskConfiguration> & { name: string }): KioskConfiguration {
  requireString('name', input.name);
  return {
    ...baseEntityDefaults(input),
    name: input.name,
    unlockCode: input.unlockCode ?? null,
    checkoutOptionId: input.checkoutOptionId ?? null,
    version: input.version ?? '1.0',
  };
}
