import FirestoreObject from '../../firestore-core/core/FirestoreObject';
import ConnectedAccounts from '../roots/ConnectedAccounts';
import * as Config from '../../firestore-core/config';

export default class EventNotification extends FirestoreObject<string> {
  readonly eventId: string;

  readonly provider: string;

  readonly type: string;

  constructor(
    eventId: string,
    provider: string,
    type: string,
    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: string,
  ) {
    super(created, updated, isDeleted, Id);
    this.eventId = eventId;
    this.provider = provider;
    this.type = type;
  }

  // eslint-disable-next-line class-methods-use-this
  collectionRef(businessId: string): FirebaseFirestore.CollectionReference {
    return EventNotification.collectionRef(businessId);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars,class-methods-use-this
  metaLinks(businessId: string): { [p: string]: string } {
    return {};
  }

  // eslint-disable-next-line class-methods-use-this
  metadata(): {} {
    return {};
  }

  // STATICS

  static collectionRef(businessId: string) {
    return ConnectedAccounts.docRef(businessId)
      .collection(Config.Paths.CollectionNames.eventNotifications);
  }

  static find(
    businessId: string,
    provider: Config.Constants.Provider,
    eventId: string,
  ): Promise<EventNotification[]> {
    return EventNotification.collectionRef(businessId)
      .where('eventId', '==', eventId)
      .where('provider', '==', provider)
      .withConverter(EventNotification.firestoreConverter)
      .get()
      .then((snapshot) => snapshot.docs
        .map((doc) => doc.data() as EventNotification));
  }

  // STATICS

  static firestoreConverter = {
    toFirestore(notification: EventNotification): FirebaseFirestore.DocumentData {
      return {
        eventId: notification.eventId,
        provider: notification.provider,
        type: notification.type,
        created: notification.created.toISOString(),
        updated: notification.updated.toISOString(),
        isDeleted: notification.isDeleted,
      };
    },
    fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): EventNotification {
      const data = snapshot.data();

      return new EventNotification(
        data.eventId,
        data.provider,
        data.type,
        new Date(data.created),
        new Date(data.updated),
        data.isDeleted,
        snapshot.id,
      );
    },
  };
}
