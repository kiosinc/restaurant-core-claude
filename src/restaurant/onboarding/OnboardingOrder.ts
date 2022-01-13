import FirestoreObject from '../../firestore-core/core/FirestoreObject';
import Address from '../misc/Address';
import { OrderState } from '../orders/Order';
import OrderLineItem from '../misc/OrderLineItem';
import { Onboarding } from '../roots/Onboarding';
import * as Config from '../../firestore-core/config';

// draft- The starting status for all invoices. You can still edit the invoice at
// this point. You can finalize the invoice to open, or delete it if it’s a one-off.

// open- The invoice has been finalized, and is awaiting customer payment.You can
// no longer edit the invoice. Send or pay the invoice. You can also void or mark it uncollectible.

// paid- This invoice was paid. No actions possible.

// void- This invoice was a mistake, and must be canceled. No actions possible.

// uncollectible- The customer is unlikely to pay this invoice (treat it as bad
// debt in your accounting process). You can void or pay the invoice.

export const enum InvoiceStatus {
  draft = 'draft',
  open = 'open',
  paid = 'paid',
  void = 'void',
  uncollectible = 'uncollectible',
}

export class OnboardingOrder extends FirestoreObject<string> {
  invoiceId: string;

  invoiceStatus: InvoiceStatus;

  shippingTrackingNumber: string;

  shipmentCarrier: string;

  shipmentAddress: Address;

  totalAmount: number;

  orderStatus: OrderState;

  lineItems: OrderLineItem[];

  constructor(
    invoiceId: string,
    invoiceStatus: InvoiceStatus,
    shippingTrackingNumber: string,
    shipmentCarrier: string,
    shipmentAddress: Address,
    totalAmount: number,
    orderStatus: OrderState,
    lineItems: OrderLineItem[],
    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: string,
  ) {
    super(created, updated, isDeleted, Id);
    this.invoiceId = invoiceId;
    this.invoiceStatus = invoiceStatus;
    this.shippingTrackingNumber = shippingTrackingNumber;
    this.shipmentCarrier = shipmentCarrier;
    this.shipmentAddress = shipmentAddress;
    this.totalAmount = totalAmount;
    this.orderStatus = orderStatus;
    this.lineItems = lineItems;
  }

  // FirestoreAdapter

  // eslint-disable-next-line class-methods-use-this
  collectionRef(businessId: string): FirebaseFirestore.CollectionReference {
    return OnboardingOrder.collectionRef(businessId);
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
    return Onboarding.docRef(businessId).collection(Config.Paths.CollectionNames.onboardingOrders);
  }

  /**
   * A converter used to convert object to and from firestore, any
   * '.data' returns an object can can simply be cast with 'as [type]'.
   * Used in conjunction with Firestore collection references or queries.
   */
  static firestoreConverter = {
    toFirestore(onboardingOrder: OnboardingOrder): FirebaseFirestore.DocumentData {
      return {
        invoiceId: onboardingOrder.invoiceId,
        invoiceStatus: JSON.parse(JSON.stringify(onboardingOrder.invoiceStatus)),
        shippingTrackingNumber: onboardingOrder.shippingTrackingNumber,
        shipmentCarrier: onboardingOrder.shipmentCarrier,
        shipmentAddress: Address.firestoreConverter.toFirestore(onboardingOrder.shipmentAddress),
        totalAmount: onboardingOrder.totalAmount,
        orderStatus: JSON.parse(JSON.stringify(onboardingOrder.orderStatus)),
        lineItems: JSON.parse(JSON.stringify(onboardingOrder.lineItems)),
        created: onboardingOrder.created.toISOString(),
        updated: onboardingOrder.updated.toISOString(),
        isDeleted: onboardingOrder.isDeleted,
      };
    },
    fromFirestore(
      snapshot: FirebaseFirestore.QueryDocumentSnapshot,
    ): OnboardingOrder {
      const data = snapshot.data();
      return new OnboardingOrder(
        data.invoiceId,
        data.invoiceStatus,
        data.shippingTrackingNumber,
        data.shipmentCarrier,
        data.shipmentAddress,
        data.totalAmount,
        data.orderStatus,
        data.lineItems,
        new Date(data.created),
        new Date(data.updated),
        data.isDeleted,
        snapshot.id,
      );
    },
  };
}
