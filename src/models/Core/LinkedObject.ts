import {Attribute} from "../Catalog/Attribute";
import {Category} from "../Catalog/Category";
import {CustomizationSet} from "../Catalog/CustomizationSet";
import {Product} from "../Catalog/Product";
import {TaxRate} from "../Catalog/TaxRate";

export class LinkedObject {
    linkedObjectId: Id
    isSyncActive: boolean

    constructor(
        linkedObjectId: Id,
        isSyncActive: boolean
    )
    {
        this.linkedObjectId = linkedObjectId
        this.isSyncActive = isSyncActive
    }

    static find(linkedObjectId: Id, provider: Provider, fromCollectionRef: FirebaseFirestore.CollectionReference, withConverter: FirebaseFirestore.FirestoreDataConverter<unknown> ): Promise<any> {
        return this.findQuery(linkedObjectId, provider, fromCollectionRef, withConverter).get()
            .then(snapshot => {
                if (snapshot.empty) {
                    return
                } else if (snapshot.docs.length > 1) {
                    throw new Error("Error: there is more than one Category with the same linkedID")
                }
                return snapshot.docs[0].data();
            })
    }

    static findQuery(linkedObjectId: Id, provider: Provider, fromCollectionRef: FirebaseFirestore.CollectionReference, withConverter: FirebaseFirestore.FirestoreDataConverter<unknown>):  FirebaseFirestore.Query<unknown> {
        return fromCollectionRef.where("linkedObjects" + "." + provider + "." + "linkedObjectId", "==", linkedObjectId)
            .withConverter(withConverter)
    }

    static isSyncActive<C extends Attribute | Category | CustomizationSet | Product | TaxRate>(object: C, provider: Provider): boolean {
        const linkedObjectProvider = object.linkedObjects[provider]
        if (linkedObjectProvider) {
            return linkedObjectProvider.isSyncActive
        }

        return false
    }

    // if the object already exists check against sync and delete flags
    static shouldStopSync<C extends Attribute | Category | CustomizationSet | Product | TaxRate>(firestoreObject: C, provider: Provider, isSourceMarkedDelete: boolean, businessId: Id) {
        // the object exists, apply sync or delete flag
        // otherwise return no result (undefined)
        if (firestoreObject) {
            const isSyncActive = LinkedObject.isSyncActive(firestoreObject, provider)

            // if no sync then exit
            // else delete the existing referenced object
            if (!isSyncActive) {
                return new LinkedObjectSyncResult(false, firestoreObject)

            } else if (isSourceMarkedDelete) {
                return firestoreObject.deletePermanent(businessId)
                    .then(() => new LinkedObjectSyncResult(false, firestoreObject))
            }
        } else if (isSourceMarkedDelete) {
            // no object
            return new LinkedObjectSyncResult(false)
        }

        return undefined
    }
}

export class LinkedObjectSyncResult<C> {
    object?: C
    isSyncActive: boolean

    constructor(
        isSyncActive: boolean,
        object?: C
    ) {
        this.object = object
        this.isSyncActive = isSyncActive
    }
}

