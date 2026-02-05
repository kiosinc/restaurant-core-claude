import { FirestoreRepository, FirestoreRepositoryConfig } from './FirestoreRepository';
import { SurfaceConfiguration } from '../../domain/surfaces/SurfaceConfiguration';
import { PathResolver } from './PathResolver';

export class SurfaceConfigurationRepository extends FirestoreRepository<SurfaceConfiguration> {
  protected config(): FirestoreRepositoryConfig<SurfaceConfiguration> {
    return {
      collectionRef(businessId: string) {
        return PathResolver.surfaceConfigurationsCollection(businessId);
      },
      toFirestore(sc: SurfaceConfiguration): FirebaseFirestore.DocumentData {
        return {
          name: sc.name,
          isChargeCustomerServiceFee: sc.isChargeCustomerServiceFee,
          coverConfiguration: sc.coverConfiguration,
          tipConfiguration: sc.tipConfiguration,
          checkoutFlowConfiguration: sc.checkoutFlowConfiguration,
          version: sc.version,
          created: sc.created.toISOString(),
          updated: sc.updated.toISOString(),
          isDeleted: sc.isDeleted,
        };
      },
      fromFirestore(data: FirebaseFirestore.DocumentData, id: string): SurfaceConfiguration {
        return new SurfaceConfiguration({
          Id: id,
          name: data.name,
          isChargeCustomerServiceFee: data.isChargeCustomerServiceFee,
          coverConfiguration: data.coverConfiguration ?? null,
          tipConfiguration: data.tipConfiguration ?? null,
          checkoutFlowConfiguration: data.checkoutFlowConfiguration ?? null,
          version: data.version,
          created: new Date(data.created),
          updated: new Date(data.updated),
          isDeleted: data.isDeleted,
        });
      },
    };
  }
}
