import { BaseEntity, baseEntityDefaults } from '../BaseEntity';

export type Catalog = BaseEntity;

export function createCatalog(input?: Partial<Catalog>): Catalog {
  return {
    ...baseEntityDefaults(input),
  };
}
