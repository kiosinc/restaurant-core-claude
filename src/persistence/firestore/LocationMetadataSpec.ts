import { createMetadataSpec } from '../../domain/MetadataSpec';
import { Location, LocationMeta, locationMeta } from '../../domain/locations/Location';
import { PathResolver } from './PathResolver';
import * as Paths from '../../firestore-core/Paths';

export const locationMetadataSpec = createMetadataSpec<Location, LocationMeta>(
  locationMeta,
  (entity, businessId) => [{
    documentPath: PathResolver.locationsDoc(businessId).path,
    fieldPath: `${Paths.CollectionNames.locations}.${entity.Id}`,
  }],
);
