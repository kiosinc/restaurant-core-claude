import { createConverter } from './converterFactory';
import { Location, createLocation } from '../../../domain/locations/Location';
import { PathResolver } from '../PathResolver';

export const locationConverter = createConverter<Location>(
  'location',
  (bid) => PathResolver.locationsCollection(bid),
  createLocation,
  {
    fromFirestore: (data, businessId) => ({
      businessId,
      linkedObjects: data.linkedObjects ?? {},
    }),
  },
);
