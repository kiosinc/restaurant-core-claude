import { FirestoreRepository, FirestoreRepositoryConfig } from './FirestoreRepository';
import { LocationsRoot } from '../../domain/roots/Locations';
import { PathResolver } from './PathResolver';

export class LocationsRootRepository extends FirestoreRepository<LocationsRoot> {
  protected config(): FirestoreRepositoryConfig<LocationsRoot> {
    return {
      collectionRef(businessId: string) {
        return PathResolver.publicCollection(businessId);
      },
      toFirestore(lr: LocationsRoot): FirebaseFirestore.DocumentData {
        return {
          locations: JSON.parse(JSON.stringify(lr.locations)),
          created: lr.created.toISOString(),
          updated: lr.updated.toISOString(),
          isDeleted: lr.isDeleted,
        };
      },
      fromFirestore(data: FirebaseFirestore.DocumentData, id: string): LocationsRoot {
        return new LocationsRoot({
          Id: id,
          locations: data.locations ?? {},
          created: new Date(data.created),
          updated: new Date(data.updated),
          isDeleted: data.isDeleted,
        });
      },
    };
  }
}
