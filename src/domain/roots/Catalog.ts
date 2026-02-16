import { BaseEntity, baseEntityDefaults } from '../BaseEntity';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface Catalog extends BaseEntity {}

export function createCatalog(input?: Partial<Catalog>): Catalog {
  return {
    ...baseEntityDefaults(input),
  };
}
