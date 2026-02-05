import { FirestoreRepository, FirestoreRepositoryConfig } from './FirestoreRepository';
import { Services } from '../../domain/roots/Services';
import { PathResolver } from './PathResolver';

export class ServicesRepository extends FirestoreRepository<Services> {
  protected config(): FirestoreRepositoryConfig<Services> {
    return {
      collectionRef(businessId: string) {
        return PathResolver.privateCollection(businessId);
      },
      toFirestore(svc: Services): FirebaseFirestore.DocumentData {
        return {
          kioskFeeRate: svc.kioskFeeRate,
          experiments: svc.experiments,
          created: svc.created.toISOString(),
          updated: svc.updated.toISOString(),
          isDeleted: svc.isDeleted,
        };
      },
      fromFirestore(data: FirebaseFirestore.DocumentData, id: string): Services {
        return new Services({
          Id: id,
          kioskFeeRate: data.kioskFeeRate,
          experiments: data.experiments ?? {},
          created: new Date(data.created),
          updated: new Date(data.updated),
          isDeleted: data.isDeleted,
        });
      },
    };
  }
}
