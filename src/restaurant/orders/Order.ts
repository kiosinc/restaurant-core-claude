/**
 * Order class
 */
import FirestoreObject from '../../firestore-core/core/FirestoreObject';
import LinkedObject from '../../firestore-core/core/LinkedObject';
import * as Config from '../../firestore-core/config';
import Orders from '../roots/Orders';

export const enum OrderState {
  // Orders that are open
  open = 'open',
  // Orders awaiting action (new) that haven't been processed yet
  new = 'new',
  // Orders being prepared.
  inProgress = 'in_progress', // TODO: change to inProgress
  // All orders ready for fulfillment
  ready = 'ready',
  // Orders that have been fulfilled
  completed = 'completed',
  // Orders that have been cancelled
  cancelled = 'cancelled',
}

export const enum PaymentState {

  none = 'none',

  approved = 'approved',

  pending = 'pending',

  completed = 'completed',

  cancelled = 'cancelled',

  failed = 'failed',
}

/**
 * Order class extends FirestoreObject  // TODO this should be BusinessOrder
 */
export class Order extends FirestoreObject<string> {
  state: OrderState;

  source: string;

  totalAmount: number;

  contactPhoneNumber: string;

  contactEmail: string;

  contactName: string;

  linkedObjects: { [Id: string]: LinkedObject };

  paymentState: PaymentState;

  receiptUrl: string;

  /**
   * Create an Order
   */
  constructor(
    state: OrderState,
    source: string,
    totalAmount: number,
    contactPhoneNumber: string,
    contactEmail: string,
    contactName: string,
    linkedObjects: { [p: string]: LinkedObject },
    paymentState: PaymentState,
    receiptUrl: string,
    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: string,
  ) {
    super(created, updated, isDeleted, Id);
    this.state = state;
    this.source = source;
    this.totalAmount = totalAmount;
    this.contactPhoneNumber = contactPhoneNumber;
    this.contactEmail = contactEmail;
    this.contactName = contactName;
    this.linkedObjects = linkedObjects;
    this.paymentState = paymentState;
    this.receiptUrl = receiptUrl;
  }

  // FirestoreAdapter

  // eslint-disable-next-line class-methods-use-this
  collectionRef(businessId: string): FirebaseFirestore.CollectionReference {
    return Order.collectionRef(businessId);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars,class-methods-use-this
  metaLinks(businessId: string): { [p: string]: string } {
    return {};
  }

  // eslint-disable-next-line class-methods-use-this
  metadata(): {} {
    return {};
  }

  // STATICS THAT SHOULD BE IMPLEMENTED BY ALL FIRESTORE OBJECTS

  /**
   * Order class CollectionReference for given business
   */
  static collectionRef(businessId: string): FirebaseFirestore.CollectionReference {
    return Orders.docRef(businessId).collection(
      Config.Paths.CollectionNames.orders,
    );
  }

  /**
   * A converter used to convert object to and from firestore, any
   * '.data' returns an object can can simply be cast with 'as [type]'.
   * Used in conjunction with Firestore collection references or queries.
   */
  static firestoreConverter = {
    toFirestore(order: Order): FirebaseFirestore.DocumentData {
      return {
        // businessId: attribute.businessId,
        state: JSON.parse(JSON.stringify(order.state)),
        source: order.source,
        totalAmount: order.totalAmount,
        contactPhoneNumber: order.contactPhoneNumber,
        contactEmail: order.contactEmail,
        contactName: order.contactName,
        linkedObjects: JSON.parse(JSON.stringify(order.linkedObjects)),
        paymentState: JSON.parse(JSON.stringify(order.paymentState)),
        receiptUrl: order.receiptUrl ?? '',
        created: order.created.toISOString(),
        updated: order.updated.toISOString(),
        isDeleted: order.isDeleted,
      };
    },
    fromFirestore(
      snapshot: FirebaseFirestore.QueryDocumentSnapshot,
    ): Order {
      const data = snapshot.data();
      return new Order(
        data.state,
        data.source,
        data.totalAmount,
        data.contactPhoneNumber,
        data.contactEmail,
        data.contactName,
        data.linkedObjects,
        data.paymentState ?? PaymentState.none,
        data.receiptUrl ?? '',
        new Date(data.created),
        new Date(data.updated),
        data.isDeleted,
        snapshot.id,
      );
    },
  };
}
