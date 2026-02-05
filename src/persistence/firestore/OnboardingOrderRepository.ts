import { FirestoreRepository, FirestoreRepositoryConfig } from './FirestoreRepository';
import { OnboardingOrder } from '../../domain/onboarding/OnboardingOrder';
import { PathResolver } from './PathResolver';

export class OnboardingOrderRepository extends FirestoreRepository<OnboardingOrder> {
  protected config(): FirestoreRepositoryConfig<OnboardingOrder> {
    return {
      collectionRef(businessId: string) {
        return PathResolver.onboardingOrdersCollection(businessId);
      },
      toFirestore(oo: OnboardingOrder): FirebaseFirestore.DocumentData {
        return {
          invoiceId: oo.invoiceId,
          invoiceStatus: oo.invoiceStatus,
          shippingTrackingNumber: oo.shippingTrackingNumber,
          shipmentCarrier: oo.shipmentCarrier,
          shipmentAddress: oo.shipmentAddress,
          totalAmount: oo.totalAmount,
          orderStatus: oo.orderStatus,
          lineItems: JSON.parse(JSON.stringify(oo.lineItems)),
          created: oo.created.toISOString(),
          updated: oo.updated.toISOString(),
          isDeleted: oo.isDeleted,
        };
      },
      fromFirestore(data: FirebaseFirestore.DocumentData, id: string): OnboardingOrder {
        return new OnboardingOrder({
          Id: id,
          invoiceId: data.invoiceId,
          invoiceStatus: data.invoiceStatus,
          shippingTrackingNumber: data.shippingTrackingNumber,
          shipmentCarrier: data.shipmentCarrier,
          shipmentAddress: data.shipmentAddress,
          totalAmount: data.totalAmount,
          orderStatus: data.orderStatus,
          lineItems: data.lineItems ?? [],
          created: new Date(data.created),
          updated: new Date(data.updated),
          isDeleted: data.isDeleted,
        });
      },
    };
  }
}
