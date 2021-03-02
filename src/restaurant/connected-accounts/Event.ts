import { FirestoreObject } from '../core/FirestoreObject';
import { ConnectedAccounts } from '../roots/ConnectedAccounts';
import { FirestorePaths } from '../../firestore-config/firebaseApp';

export class Event extends FirestoreObject<Id> {
  readonly provider: string;
  readonly type: string;
  timestamp: Date;

  constructor(
    provider: string,
    type: string,
    timestamp: Date,
    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: string,
  ) {
    super(created, updated, isDeleted, Id ?? Event.identifier(provider, type));
    this.provider = provider;
    this.type = type;
    this.timestamp = timestamp;
  }

  // FirestoreAdapter

  readonly converter = Event.firestoreConverter;

  collectionRef(businessId: Id): FirebaseFirestore.CollectionReference {
    return Event.collectionRef(businessId);
  }

  metaLinks(businessId: Id): { [p: string]: string } {
    return {};
  }

  metadata(): {} {
    return {};
  }

  // STATICS

  static collectionRef(businessId: Id) {
    return ConnectedAccounts.docRef(businessId).collection(FirestorePaths.CollectionNames.events);
  }

  static identifier(provider: string, type: string): string {
    return `${provider}.${type}`;
  }

  static find(businessId: Id, provider: Provider, type: string): Promise<Event | void> {
    const docId = Event.identifier(provider, type);
    return Event.collectionRef(businessId)
      .doc(docId)
      .withConverter(Event.firestoreConverter)
      .get()
      .then((snapshot) => {
        if (!snapshot.exists) {
          return;
        }
        return snapshot.data() as Event;
      });
  }

  static firestoreConverter = {
    toFirestore(event: Event): FirebaseFirestore.DocumentData {
      return {
        provider: event.provider,
        type: event.type,
        timestamp: event.timestamp.toISOString(),
        created: event.created.toISOString(),
        updated: event.updated.toISOString(),
        isDeleted: event.isDeleted,
      };
    },
    fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): Event {
      const data = snapshot.data();

      return new Event(
        data.provider,
        data.type,
        new Date(data.timestamp),
        new Date(data.created),
        new Date(data.updated),
        data.isDeleted,
        snapshot.id,
      );
    },
  };
}
