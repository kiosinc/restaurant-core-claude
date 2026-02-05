import { FirestoreRepository, FirestoreRepositoryConfig } from './FirestoreRepository';
import { TaxRate } from '../../domain/catalog/TaxRate';
import { PathResolver } from './PathResolver';

export class TaxRateRepository extends FirestoreRepository<TaxRate> {
  protected config(): FirestoreRepositoryConfig<TaxRate> {
    return {
      collectionRef(businessId: string) {
        return PathResolver.taxRatesCollection(businessId);
      },
      toFirestore(taxRate: TaxRate): FirebaseFirestore.DocumentData {
        return {
          name: taxRate.name,
          rate: taxRate.rate,
          isCalculatedSubTotalPhase: taxRate.isCalculatedSubTotalPhase,
          isInclusive: taxRate.isInclusive,
          linkedObjects: JSON.parse(JSON.stringify(taxRate.linkedObjects)),
          created: taxRate.created.toISOString(),
          updated: taxRate.updated.toISOString(),
          isDeleted: taxRate.isDeleted,
        };
      },
      fromFirestore(data: FirebaseFirestore.DocumentData, id: string): TaxRate {
        return new TaxRate({
          Id: id,
          name: data.name,
          rate: data.rate,
          isCalculatedSubTotalPhase: data.isCalculatedSubTotalPhase,
          isInclusive: data.isInclusive,
          linkedObjects: data.linkedObjects ?? {},
          created: new Date(data.created),
          updated: new Date(data.updated),
          isDeleted: data.isDeleted,
        });
      },
    };
  }
}
