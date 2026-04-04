import { createConverter } from './converterFactory';
import { OrderSettings, createOrderSettings } from '../../../domain/roots/Orders';
import { PathResolver } from '../PathResolver';

export const orderSettingsConverter = createConverter<OrderSettings>(
  'orderSettings',
  (bid) => PathResolver.privateCollection(bid),
  createOrderSettings,
  {
    fromFirestore: (data) => ({
      isLoyaltyAccrue: data.isLoyaltyAccrue ?? true,
      isStateAutoNewToInProgress: data.isStateAutoNewToInProgress ?? false,
    }),
  },
);
