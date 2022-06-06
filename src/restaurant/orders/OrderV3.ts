/**
 * Order class
 */
import FirestoreObject from '../../firestore-core/core/FirestoreObject';
import LinkedObject from '../../firestore-core/core/LinkedObject';
import * as Config from '../../firestore-core/config';
import Orders from '../roots/Orders';
import { Constants } from '../../firestore-core/config';

const VERSION = '3';

export const enum OrderType {
  none = 'none',
  togo = 'togo',
  dinein = 'dinein',
}

export interface OrderTypeMeta {
  table?: string,
}

export const enum OrderState {
  // Orders that are open
  open = 'open',
  // Orders awaiting action (new) that haven't been processed yet
  new = 'new',
  // Orders being prepared.
  inProgress = 'inProgress',
  // All orders ready for fulfillment
  ready = 'ready',
  // Orders that have been fulfilled
  completed = 'completed',
  // Orders that have been cancelled
  cancelled = 'cancelled',
}

export interface SelectedValue {
  optionId: string,
  name: string, // Name of the OptionSet Option
  price: number, // Price of the OptionSet Option
  ordinal: number, // Zero based ordinal of the value
}

export interface OptionSetSelected {
  optionSetId: string,
  name: string,
  selectedValues: SelectedValue[], // OptionSet Option Id key: The values selected
  ordinal: number, // Zero based ordinal of the option set
}

export interface OrderItem {
  readonly productId: string,
  readonly productName: string,
  readonly optionSetsSelected: OptionSetSelected[],
  readonly price: number
}

export interface OrderPriceAdjustmentMeta {
  id: string,
  name: string,
  value: number, // Applied monetary amount or value fo the adjustment
}

export interface OrderLineItem {
  readonly Id: string,
  item: OrderItem,
  quantity: number,
  taxes: OrderPriceAdjustmentMeta[],
  discounts: OrderPriceAdjustmentMeta[],
  surcharges: OrderPriceAdjustmentMeta[],
  note: string | null,
}

export interface OrderFulfillmentContact {
  phoneNumber: string | null,
  email: string | null,
  name: string | null,
}

export interface OrderFulfillment {
  type: OrderType,
  typeMetaData: OrderTypeMeta | null, // { table: string }
  scheduledTime: Date | null; // null for ASAP
  contact: OrderFulfillmentContact | null;
  displayId: string | null;
}

export interface OrderPayment {
  paymentState: PaymentState;
  paymentTimestamp: Date;
  receiptUrl: string | null;
}

export const enum PaymentState {
  none = 'none',

  approved = 'approved',

  pending = 'pending',

  completed = 'completed',

  cancelled = 'cancelled',

  failed = 'failed',
}

// function findQuery(businessId: string, orderId: string) {
//   // eslint-disable-next-line @typescript-eslint/no-use-before-define
//   return Order.collectionRef(businessId).doc(orderId).withConverter(Order.firestoreConverter);
// }

/**
 * Order class extends FirestoreObject
 */
export class Order extends FirestoreObject<string> {
  readonly version: string;

  businessId: string;

  locationId: string;

  menuId: string;

  timestamp: Date;

  channel: string;

  agent: string;

  posProvider: Constants.Provider;

  totalAmount: number;

  totalDiscountAmount: number;

  totalTaxAmount: number;

  totalSurchargeAmount: number;

  customerId: string | null;

  fulfillment: OrderFulfillment;

  lineItems: OrderLineItem[];

  taxes: OrderPriceAdjustmentMeta[];

  discounts: OrderPriceAdjustmentMeta[];

  surcharges: OrderPriceAdjustmentMeta[];

  state: OrderState;

  note: string | null;

  payment: OrderPayment | null;

  linkedObjects: { [Id: string]: LinkedObject } | null;

  isAvailable: boolean;

  /**
   * Create an Order
   */
  constructor(
    businessId: string,
    locationId: string,
    menuId: string,
    timestamp: Date | null,
    channel: string,
    agent: string,
    posProvider: Constants.Provider | null,
    totalAmount: number,
    totalDiscountAmount: number,
    totalTaxAmount: number,
    totalSurchargeAmount: number,
    customerId: string | null,
    fulfillment: OrderFulfillment,
    lineItems: OrderLineItem[],
    taxes: OrderPriceAdjustmentMeta[],
    discounts: OrderPriceAdjustmentMeta[],
    surcharges: OrderPriceAdjustmentMeta[],
    note: string | null,
    payment: OrderPayment | null,
    linkedObjects: { [Id: string]: LinkedObject } | null,
    state: OrderState | null,
    version?: string,
    isAvailable?: boolean,
    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: string,
  ) {
    super(created, updated, isDeleted, Id);

    this.posProvider = posProvider ?? Constants.Provider.system;
    this.state = state ?? OrderState.new;
    this.version = version ?? VERSION;
    this.isAvailable = isAvailable ?? true;
    this.timestamp = timestamp ?? new Date();

    this.businessId = businessId;
    this.locationId = locationId;
    this.menuId = menuId;
    this.channel = channel;
    this.agent = agent;
    this.totalAmount = totalAmount;
    this.totalDiscountAmount = totalDiscountAmount;
    this.totalTaxAmount = totalTaxAmount;
    this.totalSurchargeAmount = totalSurchargeAmount;
    this.customerId = customerId;
    this.fulfillment = fulfillment;
    this.lineItems = lineItems;
    this.taxes = taxes;
    this.discounts = discounts;
    this.surcharges = surcharges;
    this.note = note;
    this.payment = payment;
    this.linkedObjects = linkedObjects;
  }

  docRef(businessId: string): FirebaseFirestore.DocumentReference {
    return this.collectionRef(businessId).doc(this.Id).withConverter(Order.firestoreConverter);
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
        businessId: order.businessId,
        locationId: order.locationId,
        menuId: order.menuId,
        timestamp: order.timestamp.toISOString(),
        channel: order.channel,
        agent: order.agent,
        posProvider: order.posProvider,
        totalAmount: order.totalAmount,
        totalDiscountAmount: order.totalDiscountAmount,
        totalTaxAmount: order.totalTaxAmount,
        totalSurchargeAmount: order.totalSurchargeAmount,
        customerId: order.customerId,
        fulfillment: JSON.parse(JSON.stringify(order.fulfillment)),
        lineItems: JSON.parse(JSON.stringify(order.lineItems)),
        taxes: JSON.parse(JSON.stringify(order.taxes)),
        discounts: JSON.parse(JSON.stringify(order.discounts)),
        surcharges: JSON.parse(JSON.stringify(order.surcharges)),
        note: order.note,
        payment: JSON.parse(JSON.stringify(order.payment)),
        linkedObjects: JSON.parse(JSON.stringify(order.linkedObjects)),
        state: order.state,
        version: order.version,
        isAvailable: order.isAvailable,
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
        data.businessId,
        data.locationId,
        data.menuId,
        new Date(data.timestamp),
        data.channel,
        data.agent,
        data.posProvider,
        data.totalAmount,
        data.totalDiscountAmount,
        data.totalTaxAmount,
        data.totalSurchargeAmount,
        data.customerId,
        data.fulfillment,
        data.lineItems,
        data.taxes,
        data.discounts,
        data.surcharges,
        data.note,
        data.payment,
        data.linkedObjects,
        data.state,
        data.version,
        data.isAvailable,
        new Date(data.created),
        new Date(data.updated),
        data.isDeleted,
        snapshot.id,
      );
    },
  };
}
