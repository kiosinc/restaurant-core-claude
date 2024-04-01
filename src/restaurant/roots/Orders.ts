import { FirestoreObject } from '../../firestore-core'
import { Business } from './Business'
import { OrderType } from '../orders/OrderSymbols'
import * as Paths from '../../firestore-core/Paths'

const ordersKey = Paths.CollectionNames.orders;
const defaultGratuityRate = [10, 15, 20];

export default class Orders extends FirestoreObject {
  isSMSStateUpdate: boolean;

  isLoyaltyAccrue: boolean;

  isStateAutoNewToInProgress: boolean;

  gratuityRates: number[];

  isSquareDiscountCodeAPI: boolean;

  // If Discounts are auto applied then manual catalog discounts are not eligible
  isSquareAutoApplyDiscounts: boolean;

  isSquareAutoApplyTaxes: boolean;

  isKioskSessionIdleTimerOn: boolean;

  isFreeOrdersEnabled: boolean;

  isSingleLineItemsOnly: boolean

  ticketHeaderFormat: { [key in OrderType]: string } | null;

  smsReadyTextFormat: { [key in OrderType]: string } | null;

  smsReceiptTextFormat: { [key in OrderType]: string } | null;

  constructor(
    isSMSStateUpdate: boolean,
    isLoyaltyAccrue: boolean,
    isStateAutoNewToInProgress: boolean,
    gratuityRates: number[] | null,
    isSquareDiscountCodeAPI: boolean | null,
    isSquareAutoApplyDiscounts: boolean | null,
    isSquareAutoApplyTaxes: boolean | null,
    isKioskSessionIdleTimerOn: boolean | null,
    isFreeOrdersEnabled: boolean | null,
    isSingleLineItemsOnly: boolean | null,
    ticketHeaderFormat: { [key in OrderType]: string } | null,
    smsReadyTextFormat: { [key in OrderType]: string } | null,
    smsReceiptTextFormat: { [key in OrderType]: string } | null,
    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: string,
  ) {
    super({ created, updated, isDeleted, Id: Id ?? ordersKey });

    this.isSMSStateUpdate = isSMSStateUpdate;
    this.isLoyaltyAccrue = isLoyaltyAccrue;
    this.isStateAutoNewToInProgress = isStateAutoNewToInProgress;
    this.gratuityRates = gratuityRates ?? defaultGratuityRate;
    this.isSquareDiscountCodeAPI = isSquareDiscountCodeAPI ?? false;
    this.isSquareAutoApplyDiscounts = isSquareAutoApplyDiscounts ?? false;
    this.isSquareAutoApplyTaxes = isSquareAutoApplyTaxes ?? true;
    this.isKioskSessionIdleTimerOn = isKioskSessionIdleTimerOn ?? true;
    this.isFreeOrdersEnabled = isFreeOrdersEnabled ?? true;
    this.isSingleLineItemsOnly = isSingleLineItemsOnly ?? false;
    this.ticketHeaderFormat = ticketHeaderFormat;
    this.smsReadyTextFormat = smsReadyTextFormat;
    this.smsReceiptTextFormat = smsReceiptTextFormat;
  }

  // eslint-disable-next-line class-methods-use-this
  collectionRef(businessId: string): FirebaseFirestore.CollectionReference {
    return Business.privateCollectionRef(businessId);
  }

  // eslint-disable-next-line class-methods-use-this
  metaLinks(): { [p: string]: string } {
    return {};
  }

  // eslint-disable-next-line class-methods-use-this
  metadata(): Record<string, never> {
    return {};
  }

  // STATICS

  static docRef(businessId: string) : FirebaseFirestore.DocumentReference {
    return Business.privateCollectionRef(businessId).doc(ordersKey);
  }

  static firestoreConverter = {
    toFirestore(orders: Orders): FirebaseFirestore.DocumentData {
      return {
        isSMSStateUpdate: orders.isSMSStateUpdate,
        isLoyaltyAccrue: orders.isLoyaltyAccrue,
        isStateAutoNewToInProgress: orders.isStateAutoNewToInProgress,
        gratuityRates: JSON.parse(JSON.stringify(orders.gratuityRates)),
        isSquareDiscountCodeAPI: orders.isSquareDiscountCodeAPI,
        isSquareAutoApplyDiscounts: orders.isSquareAutoApplyDiscounts,
        isSquareAutoApplyTaxes: orders.isSquareAutoApplyTaxes,
        isKioskSessionIdleTimerOn: orders.isKioskSessionIdleTimerOn,
        isFreeOrdersEnabled: orders.isFreeOrdersEnabled,
        isSingleLineItemsOnly: orders.isSingleLineItemsOnly,
        ticketHeaderFormat: orders.ticketHeaderFormat,
        smsReadyTextFormat: orders.smsReadyTextFormat,
        smsReceiptTextFormat: orders.smsReceiptTextFormat,
        created: orders.created.toISOString(),
        updated: orders.updated.toISOString(),
        isDeleted: orders.isDeleted,
      };
    },
    fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): Orders {
      const data = snapshot.data();

      return new Orders(
        data.isSMSStateUpdate,
        data.isLoyaltyAccrue ?? true,
        data.isStateAutoNewToInProgress ?? false,
        data.gratuityRates ?? null,
        data.isSquareDiscountCodeAPI ?? null,
        data.isSquareAutoApplyDiscounts ?? null,
        data.isSquareAutoApplyTaxes ?? null,
        data.isKioskSessionIdleTimerOn ?? null,
        data.isFreeOrdersEnabled ?? null,
        data.isSingleLineItemsOnly ?? null,
        data.ticketHeaderFormat ?? null,
        data.smsReadyTextFormat ?? null,
        data.smsReceiptTextFormat ?? null,
        new Date(data.created),
        new Date(data.updated),
        data.isDeleted,
        snapshot.id,
      );
    },
  };
}
