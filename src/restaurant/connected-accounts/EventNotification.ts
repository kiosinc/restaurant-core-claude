import FirestoreObject from '../../firestore-core/core/FirestoreObject';
import ConnectedAccounts from '../roots/ConnectedAccounts';
import * as Config from '../../firestore-core/config';
import { firestore } from '../../firestore-core/firebaseApp';

export interface EventNotificationResult {
  notification: EventNotification,
  isNew: boolean
}

export class EventNotification extends FirestoreObject<string> {
  readonly businessId: string;

  readonly eventId: string;

  readonly provider: string;

  readonly type: string;

  meta: { [p: string]: any } | null;

  constructor(
    businessId: string,
    eventId: string,
    provider: string,
    type: string,
    meta: { [p: string]: any } | null = null,
    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: string,
  ) {
    super(created, updated, isDeleted, Id);
    this.businessId = businessId;
    this.eventId = eventId;
    this.provider = provider;
    this.type = type;
    this.meta = meta;
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

  static findQuery(
    businessId: string,
    provider: Config.Constants.Provider,
    eventId: string,
  ) {
    return EventNotification.collectionRef(businessId)
      .where('eventId', '==', eventId)
      .where('provider', '==', provider)
      .withConverter(EventNotification.firestoreConverter);
  }

  static find(
    businessId: string,
    provider: Config.Constants.Provider,
    eventId: string,
  ): Promise<EventNotification[]> {
    return EventNotification.findQuery(businessId,
      provider,
      eventId)
      .get()
      .then((snapshot) => snapshot.docs
        .map((doc) => doc.data() as EventNotification));
  }

  // If a notification is new, create it and return it
  // Otherwise return the existing
  static getSet(
    businessId: string,
    eventId: string,
    provider: Config.Constants.Provider,
    type: string,
    meta: { [p: string]: any } | null = null,
  ) {
    return firestore.getFirestore().runTransaction(async (t) => {
      const query = EventNotification.findQuery(businessId, provider, eventId);
      const result = await t.get(query);
      // If a notification is new, create it and return it
      if (result.empty) {
        // Log new event
        const notification = new EventNotification(
          businessId,
          eventId,
          provider,
          type,
          meta,
        );

        const id = notification.Id;
        const notificationRef = notification.collectionRef(businessId)
          .doc(id).withConverter(EventNotification.firestoreConverter);

        t.set(notificationRef, notification);
        return {
          notification,
          isNew: true,
        } as EventNotificationResult;
      }
      // Otherwise return existing
      const notifications = result.docs.map((s) => s.data() as EventNotification);
      if (notifications.length > 1) {
        console.log(`${businessId} event ${eventId} has ${notifications.length} duplicates`);
      }

      return {
        notification: notifications.pop(),
        isNew: false,
      } as EventNotificationResult;
    });
  }

  static isNew(
    businessId: string,
    eventId: string,
    provider: Config.Constants.Provider,
    type: string,
  ) {
    return firestore.getFirestore().runTransaction(async (t) => {
      const query = EventNotification.findQuery(businessId, provider, eventId);
      const result = await t.get(query);
      if (result.empty) {
        // Log new event
        const newNotification = new EventNotification(
          businessId,
          eventId,
          provider,
          type,
        );

        const id = newNotification.Id;
        const notificationRef = newNotification.collectionRef(businessId)
          .doc(id).withConverter(EventNotification.firestoreConverter);

        t.set(notificationRef, newNotification);
        return notificationRef;
      }
      return undefined;
    });
  }
  // STATICS

  static firestoreConverter = {
    toFirestore(notification: EventNotification): FirebaseFirestore.DocumentData {
      return {
        businessId: notification.Id,
        eventId: notification.eventId,
        provider: notification.provider,
        type: notification.type,
        meta: notification.meta,
        created: notification.created.toISOString(),
        updated: notification.updated.toISOString(),
        isDeleted: notification.isDeleted,
      };
    },
    fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): EventNotification {
      const data = snapshot.data();

      return new EventNotification(
        data.businessId,
        data.eventId,
        data.provider,
        data.type,
        data.meta ?? null,
        new Date(data.created),
        new Date(data.updated),
        data.isDeleted,
        snapshot.id,
      );
    },
  };
}
