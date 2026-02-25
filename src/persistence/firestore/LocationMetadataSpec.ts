import { Location, LocationMeta, locationMeta } from '../../domain/locations/Location';
import { PathResolver } from './PathResolver';
import { CollectionNames } from '../../firestore-core/Paths';
import { createRootMetadataSpec } from './createRootMetadataSpec';

export const locationMetadataSpec = createRootMetadataSpec<Location, LocationMeta>(
  locationMeta,
  (businessId) => PathResolver.locationsDoc(businessId),
  CollectionNames.locations,
);
