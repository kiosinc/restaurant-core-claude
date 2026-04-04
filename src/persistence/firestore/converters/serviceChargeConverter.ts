import { createConverter } from './converterFactory';
import { ServiceCharge, ServiceChargeType, createServiceCharge } from '../../../domain/catalog/ServiceCharge';
import { PathResolver } from '../PathResolver';

/** Firestore-persisted type values (legacy: 'amount' stored as 'number'). */
const ServiceChargeFirestoreType = {
  amount: 'number',
} as const;

export const serviceChargeConverter = createConverter<ServiceCharge>(
  'serviceCharge',
  (bid) => PathResolver.serviceChargesCollection(bid),
  createServiceCharge,
  {
    toFirestore: (charge) => ({
      type: charge.type === ServiceChargeType.amount ? ServiceChargeFirestoreType.amount : charge.type,
    }),
    fromFirestore: (data) => ({
      value: data.value ?? data.rate,
      type: data.type === ServiceChargeFirestoreType.amount ? ServiceChargeType.amount : data.type as ServiceChargeType,
    }),
  },
);
