import { FirestoreRepository, FirestoreRepositoryConfig } from './FirestoreRepository';
import { Surfaces } from '../../domain/roots/Surfaces';
import { PathResolver } from './PathResolver';

export class SurfacesRootRepository extends FirestoreRepository<Surfaces> {
  protected config(): FirestoreRepositoryConfig<Surfaces> {
    return {
      collectionRef(businessId: string) {
        return PathResolver.publicCollection(businessId);
      },
      toFirestore(surfaces: Surfaces): FirebaseFirestore.DocumentData {
        return {
          menus: JSON.parse(JSON.stringify(surfaces.menus)),
          menuGroups: JSON.parse(JSON.stringify(surfaces.menuGroups)),
          created: surfaces.created.toISOString(),
          updated: surfaces.updated.toISOString(),
          isDeleted: surfaces.isDeleted,
        };
      },
      fromFirestore(data: FirebaseFirestore.DocumentData, id: string): Surfaces {
        return new Surfaces({
          Id: id,
          menus: data.menus ?? {},
          menuGroups: data.menuGroups ?? {},
          created: new Date(data.created),
          updated: new Date(data.updated),
          isDeleted: data.isDeleted,
        });
      },
    };
  }
}
