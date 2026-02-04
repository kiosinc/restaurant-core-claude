import { FirestoreRepository, FirestoreRepositoryConfig } from './FirestoreRepository';
import { KioskConfiguration } from '../../domain/surfaces/KioskConfiguration';
import Surfaces from '../../restaurant/roots/Surfaces';

export class KioskConfigurationRepository extends FirestoreRepository<KioskConfiguration> {
  protected config(): FirestoreRepositoryConfig<KioskConfiguration> {
    return {
      collectionRef(businessId: string) {
        return Surfaces.docRef(businessId).collection('kioskConfigurations');
      },
      toFirestore(kc: KioskConfiguration): FirebaseFirestore.DocumentData {
        return {
          name: kc.name,
          unlockCode: kc.unlockCode,
          checkoutOptionId: kc.checkoutOptionId,
          version: kc.version,
          created: kc.created.toISOString(),
          updated: kc.updated.toISOString(),
          isDeleted: kc.isDeleted,
        };
      },
      fromFirestore(data: FirebaseFirestore.DocumentData, id: string): KioskConfiguration {
        return new KioskConfiguration({
          Id: id,
          name: data.name,
          unlockCode: data.unlockCode ?? null,
          checkoutOptionId: data.checkoutOptionId ?? null,
          version: data.version,
          created: new Date(data.created),
          updated: new Date(data.updated),
          isDeleted: data.isDeleted,
        });
      },
    };
  }
}
