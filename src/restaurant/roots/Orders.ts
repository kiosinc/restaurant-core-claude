import FirestoreObject from '../../firestore-core/core/FirestoreObject';
import { Business } from './Business';
import * as Config from '../../firestore-core/config';

const ordersKey = Config.Paths.CollectionNames.orders;
const defaultGratuityRate = [10, 15, 20];

export default class Orders extends FirestoreObject<string> {
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
    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: string,
  ) {
    super(created, updated, isDeleted, Id ?? ordersKey);

    this.isSMSStateUpdate = isSMSStateUpdate;
    this.isLoyaltyAccrue = isLoyaltyAccrue;
    this.isStateAutoNewToInProgress = isStateAutoNewToInProgress;
    this.gratuityRates = gratuityRates ?? defaultGratuityRate;
    this.isSquareDiscountCodeAPI = isSquareDiscountCodeAPI ?? false;
    this.isSquareAutoApplyDiscounts = isSquareAutoApplyDiscounts ?? false;
    this.isSquareAutoApplyTaxes = isSquareAutoApplyTaxes ?? true;
    this.isKioskSessionIdleTimerOn = isKioskSessionIdleTimerOn ?? true;
    this.isFreeOrdersEnabled = isFreeOrdersEnabled ?? false;
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
  metadata(): {} {
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
        new Date(data.created),
        new Date(data.updated),
        data.isDeleted,
        snapshot.id,
      );
    },
  };
}
