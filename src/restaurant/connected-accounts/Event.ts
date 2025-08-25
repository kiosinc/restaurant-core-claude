import { FirestoreObject } from '../../firestore-core'
import ConnectedAccounts from '../roots/ConnectedAccounts'
import * as Constants from '../../firestore-core/Constants'
import * as Paths from '../../firestore-core/Paths'

export default class Event extends FirestoreObject {
  readonly provider: string;

  readonly type: string;

  /** Is syncing active for this event */
  isSync: boolean;

  queueCap: number;
  queueCount: number;

  timestamp?: Date;

  constructor(
    provider: string,
    type: string,
    isSync: boolean,
    queueCap?: number,
    queueCount?: number,
    timestamp?: Date,
    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: string,
  ) {
    super({ created, updated, isDeleted, Id: Id ?? Event.identifier(provider, type) });
    this.provider = provider;
    this.type = type;
    this.isSync = isSync;

    if (queueCap === undefined) {
      this.queueCap = -1;
    } else {
      this.queueCap = queueCap;
    }

    if (queueCount === undefined) {
      this.queueCount = 0;
    } else {
      this.queueCount = queueCount;
    }

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
        queueCap: event.queueCap,
        queueCount: event.queueCount,
        timestamp: event.timestamp?.toISOString() ?? '',
        created: event.created.toISOString(),
        updated: event.updated.toISOString(),
        isDeleted: event.isDeleted,
      };
    },
    fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): Event {
      const data = snapshot.data();

      let queueCap = data.queueCap
      if (queueCap === undefined) {
        queueCap = -1;
      }
      let queueCount = data.queueCount;
      if (queueCount === undefined) {
        queueCount = 0;
      }
      return new Event(
        data.provider,
        data.type,
        data.isSync,
        queueCap,
        queueCount,
        data.timestamp === '' ? undefined : new Date(data.timestamp),
        new Date(data.created),
        new Date(data.updated),
        data.isDeleted,
        snapshot.id,
      );
    },
  };
}
