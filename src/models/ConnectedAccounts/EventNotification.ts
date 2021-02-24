import {FirestoreObject} from "../Core/FirestoreObject";
import {ConnectedAccounts} from "../Roots/ConnectedAccounts";
import {FirestorePaths} from "../../firebaseApp";

export class EventNotification extends FirestoreObject<Id>{
    readonly eventId: string
    readonly provider: string
    readonly type: string

    constructor(
        eventId: string,
        provider: string,
        type: string,
        created?: Date,
        updated?: Date,
        isDeleted?: boolean,
        Id?: string
    ) {
        super(created, updated, isDeleted, Id)
        this.eventId = eventId
        this.provider = provider
        this.type = type
    }

    // FirestoreAdapter

    readonly converter = EventNotification.firestoreConverter

    collectionRef(businessId: Id): FirebaseFirestore.CollectionReference {
        return EventNotification.collectionRef(businessId)
    }

    metaLinks(businessId: Id): Map<string, string> {
        return new Map();
    }

    metadata(): {} {
        return {}
    }


    // STATICS

    static collectionRef(businessId: Id) {
        return ConnectedAccounts.docRef(businessId).collection(FirestorePaths.CollectionNames.eventNotifications)
    }

    static find(businessId: Id, provider: Provider, eventId: Id): Promise<EventNotification[]> {
        return EventNotification.collectionRef(businessId)
            .where("eventId", "==", eventId)
            .where("provider", "==", provider).withConverter(EventNotification.firestoreConverter).get().then(snapshot => {
                return snapshot.docs.map(doc => doc.data() as EventNotification)
            })
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
                isDeleted: notification.isDeleted
            }
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
                snapshot.id
            )
        }
    }
}