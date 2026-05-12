import { BaseEntity, baseEntityDefaults } from '../BaseEntity';
import { LocationMeta } from '../locations/Location';

export interface LocationsRoot extends BaseEntity {
  locations: { [id: string]: LocationMeta };
}

export { LocationMeta };

export function createLocationsRoot(input?: Partial<LocationsRoot>): LocationsRoot {
  return {
    ...baseEntityDefaults(input),
    locations: input?.locations ?? {},
  };
}
