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

  constructor(
    isSMSStateUpdate: boolean,
    isLoyaltyAccrue: boolean,
    isStateAutoNewToInProgress: boolean,
    gratuityRates: number[] | null,
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
  }

  // eslint-disable-next-line class-methods-use-this
  collectionRef(businessId: string): FirebaseFirestore.CollectionReference {
    return Business.publicCollectionRef(businessId);
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
    return Business.publicCollectionRef(businessId).doc(ordersKey);
  }

  static firestoreConverter = {
    toFirestore(orders: Orders): FirebaseFirestore.DocumentData {
      return {
        isSMSStateUpdate: orders.isSMSStateUpdate,
        isLoyaltyAccrue: orders.isLoyaltyAccrue,
        isStateAutoNewToInProgress: orders.isStateAutoNewToInProgress,
        gratuityRates: JSON.parse(JSON.stringify(orders.gratuityRates)),
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
        new Date(data.created),
        new Date(data.updated),
        data.isDeleted,
        snapshot.id,
      );
    },
  };
}
