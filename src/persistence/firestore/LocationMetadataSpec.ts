import { MetadataSpec, MetaLinkDeclaration } from '../../domain/MetadataSpec';
import { Location, LocationMeta } from '../../domain/locations/Location';
import Locations from '../../restaurant/roots/Locations';
import * as Paths from '../../firestore-core/Paths';

export class LocationMetadataSpec implements MetadataSpec<Location, LocationMeta> {
  getMetadata(entity: Location): LocationMeta {
    return entity.metadata();
  }

  getMetaLinks(entity: Location, businessId: string): MetaLinkDeclaration[] {
    return [
      {
        documentPath: Locations.docRef(businessId).path,
        fieldPath: `${Paths.CollectionNames.locations}.${entity.Id}`,
      },
    ];
  }
}
