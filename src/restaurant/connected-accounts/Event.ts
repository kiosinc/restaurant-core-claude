import FirestoreObject from '../../firestore-core/core/FirestoreObject'
import ConnectedAccounts from '../roots/ConnectedAccounts'
import * as Constants from '../../firestore-core/Constants'
import * as Paths from '../../firestore-core/Paths'

export default class Event extends FirestoreObject<string> {
  readonly provider: string;

  readonly type: string;

  /** Is syncing active for this event */
  isSync: boolean;

  timestamp?: Date;

  constructor(
    provider: string,
    type: string,
    isSync: boolean,
    timestamp?: Date,
    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: string,
  ) {
    super(created, updated, isDeleted, Id ?? Event.identifier(provider, type));
    this.provider = provider;
    this.type = type;
    this.isSync = isSync;
    this.timestamp = timestamp;
  }

  // eslint-disable-next-line class-methods-use-this
  collectionRef(businessId: string): FirebaseFirestore.CollectionReference {
    return Event.collectionRef(businessId);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars,class-methods-use-this
  metaLinks(businessId: string): { [p: string]: string } {
    return {};
  }

  // eslint-disable-next-line class-methods-use-this
  metadata(): Record<string, never> {
    return {};
  }

  // STATICS

  static collectionRef(businessId: string) {
    return ConnectedAccounts.docRef(businessId).collection(Paths.CollectionNames.events);
  }

  static identifier(provider: string, type: string): string {
    return `${provider}.${type}`;
  }

  static find(
    businessId: string,
    provider: Constants.Provider,
    type: string,
  ) {
    const docId = Event.identifier(provider, type);
    return Event.collectionRef(businessId).doc(docId).withConverter(Event.firestoreConverter).get()
      .then((snapshot) => {
        if (snapshot.exists) {
          return snapshot.data() as Event;
        }
        return undefined;
      });
  }

  static firestoreConverter = {
    toFirestore(event: Event): FirebaseFirestore.DocumentData {
      return {
        provider: event.provider,
        type: event.type,
        isSync: event.isSync,
        timestamp: event.timestamp?.toISOString() ?? '',
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
        data.isSync,
        data.timestamp === '' ? undefined : new Date(data.timestamp),
        new Date(data.created),
        new Date(data.updated),
        data.isDeleted,
        snapshot.id,
      );
    },
  };
}
