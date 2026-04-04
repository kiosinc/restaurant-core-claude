import { Event, createEvent } from '../../../domain/connected-accounts/Event';
import { PathResolver } from '../PathResolver';
import { createConverter, FieldTransform } from './converterFactory';
import { toDateSafe } from './baseFields';

const eventTransform: FieldTransform<Event> = {
  toFirestore: (event) => ({ timestamp: event.timestamp?.toISOString() ?? '' }),
  fromFirestore: (data) => ({ timestamp: data.timestamp === '' ? undefined : toDateSafe(data.timestamp) }),
};

export const eventConverter = createConverter<Event>(
  'event',
  (bid) => PathResolver.eventsCollection(bid),
  createEvent,
  eventTransform,
);
