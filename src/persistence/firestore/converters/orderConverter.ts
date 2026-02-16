import { createConverter } from './converterFactory';
import { Order, createOrder } from '../../../domain/orders/Order';
import { PathResolver } from '../PathResolver';

export const orderConverter = createConverter<Order>(
  'order',
  (bid) => PathResolver.ordersCollection(bid),
  createOrder,
  {
    toFirestore: (order) => ({ timestamp: order.timestamp.toISOString() }),
    fromFirestore: (data) => ({
      timestamp: new Date(data.timestamp),
      totalTipAmount: data.totalTipAmount ?? 0,
      referralCode: data.referralCode ?? null,
      source: data.source ?? null,
      tags: data.tags ?? null,
    }),
  },
);
