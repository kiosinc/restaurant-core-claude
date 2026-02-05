import { FirestoreRepository, FirestoreRepositoryConfig } from './FirestoreRepository';
import { Order } from '../../domain/orders/Order';
import { PathResolver } from './PathResolver';

export class OrderRepository extends FirestoreRepository<Order> {
  protected config(): FirestoreRepositoryConfig<Order> {
    return {
      collectionRef(businessId: string) {
        return PathResolver.ordersCollection(businessId);
      },
      toFirestore(order: Order): FirebaseFirestore.DocumentData {
        return {
          businessId: order.businessId,
          locationId: order.locationId,
          menuId: order.menuId,
          timestamp: order.timestamp.toISOString(),
          channel: order.channel,
          agent: order.agent,
          deviceId: order.deviceId ?? null,
          posProvider: order.posProvider,
          totalAmount: order.totalAmount,
          totalDiscountAmount: order.totalDiscountAmount,
          totalTaxAmount: order.totalTaxAmount,
          totalSurchargeAmount: order.totalSurchargeAmount,
          totalTipAmount: order.totalTipAmount ?? 0,
          customerId: order.customerId,
          fulfillment: JSON.parse(JSON.stringify(order.fulfillment)),
          lineItems: JSON.parse(JSON.stringify(order.lineItems)),
          currency: order.currency,
          taxes: JSON.parse(JSON.stringify(order.taxes)),
          discounts: JSON.parse(JSON.stringify(order.discounts)),
          surcharges: JSON.parse(JSON.stringify(order.surcharges)),
          note: order.note,
          payment: JSON.parse(JSON.stringify(order.payment)),
          linkedObjects: JSON.parse(JSON.stringify(order.linkedObjects)),
          state: order.state,
          referralCode: order.referralCode,
          source: order.source,
          tags: order.tags ?? null,
          version: order.version,
          isAvailable: order.isAvailable,
          created: order.created.toISOString(),
          updated: order.updated.toISOString(),
          isDeleted: order.isDeleted,
        };
      },
      fromFirestore(data: FirebaseFirestore.DocumentData, id: string): Order {
        return new Order({
          businessId: data.businessId,
          locationId: data.locationId,
          menuId: data.menuId,
          timestamp: new Date(data.timestamp),
          channel: data.channel,
          agent: data.agent,
          deviceId: data.deviceId ?? null,
          posProvider: data.posProvider,
          totalAmount: data.totalAmount,
          totalDiscountAmount: data.totalDiscountAmount,
          totalTaxAmount: data.totalTaxAmount,
          totalSurchargeAmount: data.totalSurchargeAmount,
          totalTipAmount: data.totalTipAmount ?? 0,
          customerId: data.customerId,
          fulfillment: data.fulfillment,
          lineItems: data.lineItems,
          currency: data.currency,
          taxes: data.taxes,
          discounts: data.discounts,
          surcharges: data.surcharges,
          note: data.note,
          payment: data.payment,
          linkedObjects: data.linkedObjects,
          state: data.state,
          referralCode: data.referralCode ?? null,
          source: data.source ?? null,
          tags: data.tags ?? null,
          version: data.version,
          isAvailable: data.isAvailable,
          created: new Date(data.created),
          updated: new Date(data.updated),
          isDeleted: data.isDeleted,
          Id: id,
        });
      },
    };
  }
}
