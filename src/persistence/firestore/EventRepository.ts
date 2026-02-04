import { FirestoreRepository, FirestoreRepositoryConfig } from './FirestoreRepository';
import { Event } from '../../domain/connected-accounts/Event';
import ConnectedAccounts from '../../restaurant/roots/ConnectedAccounts';
import * as Paths from '../../firestore-core/Paths';

export class EventRepository extends FirestoreRepository<Event> {
  protected config(): FirestoreRepositoryConfig<Event> {
    return {
      collectionRef(businessId: string) {
        return ConnectedAccounts.docRef(businessId)
          .collection(Paths.CollectionNames.events);
      },
      toFirestore(event: Event): FirebaseFirestore.DocumentData {
        return {
          provider: event.provider,
          type: event.type,
          isSync: event.isSync,
          queueCap: event.queueCap,
          queueCount: event.queueCount,
          timestamp: event.timestamp?.toISOString() ?? '',
          created: event.created.toISOString(),
          updated: event.updated.toISOString(),
          isDeleted: event.isDeleted,
        };
      },
      fromFirestore(data: FirebaseFirestore.DocumentData, id: string): Event {
        return new Event({
          provider: data.provider,
          type: data.type,
          isSync: data.isSync,
          queueCap: data.queueCap ?? -1,
          queueCount: data.queueCount ?? 0,
          timestamp: data.timestamp === '' ? undefined : new Date(data.timestamp),
          created: new Date(data.created),
          updated: new Date(data.updated),
          isDeleted: data.isDeleted,
          Id: id,
        });
      },
    };
  }

  /** Domain-specific query: find event by provider + type composite key */
  async findByProviderAndType(
    businessId: string,
    provider: string,
    type: string,
  ): Promise<Event | null> {
    const id = Event.identifier(provider, type);
    return this.get(businessId, id);
  }
}
