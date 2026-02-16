import { createConverter } from './converterFactory';
import { ServiceCharge, ServiceChargeType, createServiceCharge } from '../../../domain/catalog/ServiceCharge';
import { PathResolver } from '../PathResolver';

export const serviceChargeConverter = createConverter<ServiceCharge>(
  'serviceCharge',
  (bid) => PathResolver.serviceChargesCollection(bid),
  createServiceCharge,
  {
    toFirestore: (charge) => ({
      type: charge.type === ServiceChargeType.amount ? 'number' : charge.type,
    }),
    fromFirestore: (data) => ({
      value: data.value ?? data.rate,
      type: data.type === 'number' ? ServiceChargeType.amount : data.type as ServiceChargeType,
    }),
  },
);
