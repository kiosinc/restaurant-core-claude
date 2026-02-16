import { Event, createEvent } from '../../../domain/connected-accounts/Event';
import { PathResolver } from '../PathResolver';
import { createConverter, FieldTransform } from './converterFactory';

const eventTransform: FieldTransform<Event> = {
  toFirestore: (event) => ({ timestamp: event.timestamp?.toISOString() ?? '' }),
  fromFirestore: (data) => ({ timestamp: data.timestamp === '' ? undefined : new Date(data.timestamp) }),
};

export const eventConverter = createConverter<Event>(
  'event',
  (bid) => PathResolver.eventsCollection(bid),
  createEvent,
  eventTransform,
);
