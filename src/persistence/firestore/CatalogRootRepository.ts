import { FirestoreRepository, FirestoreRepositoryConfig } from './FirestoreRepository';
import { Catalog } from '../../domain/roots/Catalog';
import { PathResolver } from './PathResolver';

export class CatalogRootRepository extends FirestoreRepository<Catalog> {
  protected config(): FirestoreRepositoryConfig<Catalog> {
    return {
      collectionRef(businessId: string) {
        return PathResolver.publicCollection(businessId);
      },
      toFirestore(catalog: Catalog): FirebaseFirestore.DocumentData {
        return {
          created: catalog.created.toISOString(),
          updated: catalog.updated.toISOString(),
          isDeleted: catalog.isDeleted,
        };
      },
      fromFirestore(data: FirebaseFirestore.DocumentData, id: string): Catalog {
        return new Catalog({
          Id: id,
          created: new Date(data.created),
          updated: new Date(data.updated),
          isDeleted: data.isDeleted,
        });
      },
    };
  }
}
