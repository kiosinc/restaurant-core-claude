import { FirestoreRepository, FirestoreRepositoryConfig } from './FirestoreRepository';
import { OrderSettings } from '../../domain/roots/Orders';
import { PathResolver } from './PathResolver';

export class OrderSettingsRepository extends FirestoreRepository<OrderSettings> {
  protected config(): FirestoreRepositoryConfig<OrderSettings> {
    return {
      collectionRef(businessId: string) {
        return PathResolver.privateCollection(businessId);
      },
      toFirestore(os: OrderSettings): FirebaseFirestore.DocumentData {
        return {
          isSMSStateUpdate: os.isSMSStateUpdate,
          isLoyaltyAccrue: os.isLoyaltyAccrue,
          isStateAutoNewToInProgress: os.isStateAutoNewToInProgress,
          gratuityRates: JSON.parse(JSON.stringify(os.gratuityRates)),
          isSquareDiscountCodeAPI: os.isSquareDiscountCodeAPI,
          isSquareAutoApplyDiscounts: os.isSquareAutoApplyDiscounts,
          isSquareAutoApplyTaxes: os.isSquareAutoApplyTaxes,
          isSquareDiscountCodeAutoEnabled: os.isSquareDiscountCodeAutoEnabled,
          isKioskSessionIdleTimerOn: os.isKioskSessionIdleTimerOn,
          isFreeOrdersEnabled: os.isFreeOrdersEnabled,
          isSingleLineItemsOnly: os.isSingleLineItemsOnly,
          ticketHeaderFormat: os.ticketHeaderFormat,
          smsReadyTextFormat: os.smsReadyTextFormat,
          smsReceiptTextFormat: os.smsReceiptTextFormat,
          created: os.created.toISOString(),
          updated: os.updated.toISOString(),
          isDeleted: os.isDeleted,
        };
      },
      fromFirestore(data: FirebaseFirestore.DocumentData, id: string): OrderSettings {
        return new OrderSettings({
          Id: id,
          isSMSStateUpdate: data.isSMSStateUpdate,
          isLoyaltyAccrue: data.isLoyaltyAccrue ?? true,
          isStateAutoNewToInProgress: data.isStateAutoNewToInProgress ?? false,
          gratuityRates: data.gratuityRates ?? null,
          isSquareDiscountCodeAPI: data.isSquareDiscountCodeAPI ?? null,
          isSquareAutoApplyDiscounts: data.isSquareAutoApplyDiscounts ?? null,
          isSquareAutoApplyTaxes: data.isSquareAutoApplyTaxes ?? null,
          isSquareDiscountCodeAutoEnabled: data.isSquareDiscountCodeAutoEnabled ?? null,
          isKioskSessionIdleTimerOn: data.isKioskSessionIdleTimerOn ?? null,
          isFreeOrdersEnabled: data.isFreeOrdersEnabled ?? null,
          isSingleLineItemsOnly: data.isSingleLineItemsOnly ?? null,
          ticketHeaderFormat: data.ticketHeaderFormat ?? null,
          smsReadyTextFormat: data.smsReadyTextFormat ?? null,
          smsReceiptTextFormat: data.smsReceiptTextFormat ?? null,
          created: new Date(data.created),
          updated: new Date(data.updated),
          isDeleted: data.isDeleted,
        });
      },
    };
  }
}
