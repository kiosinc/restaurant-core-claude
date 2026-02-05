import { FirestoreRepository, FirestoreRepositoryConfig } from './FirestoreRepository';
import { CheckoutOptions } from '../../domain/surfaces/CheckoutOptions';
import { PathResolver } from './PathResolver';

export class CheckoutOptionsRepository extends FirestoreRepository<CheckoutOptions> {
  protected config(): FirestoreRepositoryConfig<CheckoutOptions> {
    return {
      collectionRef(businessId: string) {
        return PathResolver.checkoutOptionsCollection(businessId);
      },
      toFirestore(co: CheckoutOptions): FirebaseFirestore.DocumentData {
        return {
          name: co.name,
          discounts: co.discounts,
          giftCards: co.giftCards,
          referralCodes: co.referralCodes,
          tipOptions: co.tipOptions,
          fulfillmentOptions: JSON.parse(JSON.stringify(co.fulfillmentOptions)),
          created: co.created.toISOString(),
          updated: co.updated.toISOString(),
          isDeleted: co.isDeleted,
        };
      },
      fromFirestore(data: FirebaseFirestore.DocumentData, id: string): CheckoutOptions {
        return new CheckoutOptions({
          Id: id,
          name: data.name,
          discounts: data.discounts,
          giftCards: data.giftCards,
          referralCodes: data.referralCodes,
          tipOptions: data.tipOptions ?? null,
          fulfillmentOptions: data.fulfillmentOptions ?? {},
          created: new Date(data.created),
          updated: new Date(data.updated),
          isDeleted: data.isDeleted,
        });
      },
    };
  }
}
