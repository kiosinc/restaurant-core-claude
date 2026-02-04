import { FirestoreRepository, FirestoreRepositoryConfig } from './FirestoreRepository';
import { ServiceCharge, ServiceChargeType } from '../../domain/catalog/ServiceCharge';
import Catalog from '../../restaurant/roots/Catalog';
import * as Paths from '../../firestore-core/Paths';

export class ServiceChargeRepository extends FirestoreRepository<ServiceCharge> {
  protected config(): FirestoreRepositoryConfig<ServiceCharge> {
    return {
      collectionRef(businessId: string) {
        // FIX: Old code incorrectly used 'taxRates' collection.
        return Catalog.docRef(businessId).collection(Paths.CollectionNames.serviceCharges);
      },
      toFirestore(charge: ServiceCharge): FirebaseFirestore.DocumentData {
        return {
          name: charge.name,
          value: charge.value,
          type: charge.type === ServiceChargeType.amount ? 'number' : charge.type,
          isCalculatedSubTotalPhase: charge.isCalculatedSubTotalPhase,
          isTaxable: charge.isTaxable,
          linkedObjects: JSON.parse(JSON.stringify(charge.linkedObjects)),
          created: charge.created.toISOString(),
          updated: charge.updated.toISOString(),
          isDeleted: charge.isDeleted,
        };
      },
      fromFirestore(data: FirebaseFirestore.DocumentData, id: string): ServiceCharge {
        return new ServiceCharge({
          Id: id,
          name: data.name,
          value: data.value ?? data.rate,  // Handles old 'rate' field name
          type: data.type === 'number'
            ? ServiceChargeType.amount
            : data.type as ServiceChargeType,
          isCalculatedSubTotalPhase: data.isCalculatedSubTotalPhase,
          isTaxable: data.isTaxable,
          linkedObjects: data.linkedObjects ?? {},
          created: new Date(data.created),
          updated: new Date(data.updated),
          isDeleted: data.isDeleted,
        });
      },
    };
  }
}
