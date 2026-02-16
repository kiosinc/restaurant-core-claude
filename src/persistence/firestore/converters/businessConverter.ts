import { createConverter } from './converterFactory';
import { Business, createBusinessRoot } from '../../../domain/roots/Business';
import { PathResolver } from '../PathResolver';

export const businessConverter = createConverter<Business>(
  'business',
  () => PathResolver.businessCollection(),
  createBusinessRoot,
  {
    toFirestore: (business) => ({
      businessProfile: {
        name: business.businessProfile.name,
        address: business.businessProfile.address ?? null,
        shippingAddress: business.businessProfile.shippingAddress ?? null,
      },
    }),
    fromFirestore: (data) => ({
      businessProfile: {
        name: data.businessProfile?.name ?? '',
        address: data.businessProfile?.address,
        shippingAddress: data.businessProfile?.shippingAddress,
      },
    }),
  },
);
