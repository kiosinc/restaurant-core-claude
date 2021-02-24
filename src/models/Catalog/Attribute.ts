import {FirestoreObject} from "../Core/FirestoreObject";
import * as SquareConnect from "square-connect";
import {LinkedObject, LinkedObjectSyncResult} from "../Core/LinkedObject";
import {Catalog} from "../Roots/Catalog";
import {FirestorePaths} from "../../firebaseApp";

export class Attribute extends FirestoreObject<Id> {
    name: string
    values: {[Id: string]: AttributeValue }

    displayOrder: number
    isActive: boolean

    linkedObjects: { [Id: string]: LinkedObject }

    constructor(
        name: string,
        values: { [p: string]: AttributeValue },
        displayOrder: number,
        isActive: boolean,
        linkedObjects: { [p: string]: LinkedObject },
        created?: Date,
        updated?: Date,
        isDeleted?: boolean,
        Id?: Id
    )
    {
        super(created, updated, isDeleted, Id)
        this.name = name
        this.values = values

        this.displayOrder = displayOrder
        this.isActive = isActive

        this.linkedObjects = linkedObjects
    }

    // FirestoreAdapter

    readonly converter = Attribute.firestoreConverter;

    collectionRef(businessId: Id): FirebaseFirestore.CollectionReference {
        return Attribute.collectionRef(businessId)
    }

    metaLinks(businessId: Id): Map<string, string> {
        return new Map([
            [Catalog.docRef(businessId).path, FirestorePaths.CollectionNames.attributes + "." + this.Id]
        ]);    }

    metadata(): AttributeMeta {
        return {
            name: this.name,
            isActive: this.isActive,
            displayOrder: this.displayOrder
        }
    }

    // STATICS

    static collectionRef(businessId: Id): FirebaseFirestore.CollectionReference {
        return Catalog.docRef(businessId).collection(FirestorePaths.CollectionNames.attributes)
    }

    static firestoreConverter = {
        toFirestore(attribute: Attribute): FirebaseFirestore.DocumentData {
            return {
                // businessId: attribute.businessId,
                name: attribute.name,
                values: JSON.parse(JSON.stringify(attribute.values)),
                displayOrder: attribute.displayOrder,
                isActive: attribute.isActive,
                linkedObjects: JSON.parse(JSON.stringify(attribute.linkedObjects)),
                created: attribute.created.toISOString(),
                updated: attribute.updated.toISOString(),
                isDeleted: attribute.isDeleted
            }
        },
        fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): Attribute {
            const data = snapshot.data();
            return new Attribute(
                data.name,
                data.values,
                data.displayOrder,
                data.isActive as boolean,
                data.linkedObjects,
                new Date(data.created),
                new Date(data.updated),
                data.isDeleted,
                snapshot.id)
        },
        fromDocumentData(documentId: Id, data: FirebaseFirestore.DocumentData): Attribute {
            return new Attribute(
                data.name,
                data.values,
                data.displayOrder,
                data.isActive as boolean,
                data.linkedObjects,
                new Date(data.created),
                new Date(data.updated),
                data.isDeleted,
                documentId)
        }
    }

    static async upsertSquareCatalogObject(object: SquareConnect.CatalogObject, businessId:Id): Promise<LinkedObjectSyncResult<Attribute>> {
        const provider = Provider.square

        const variations = object.item_data?.variations

        if (!variations) {
            throw new Error("Variations are missing for Item " + object.id);
        }

        if(variations.filter(variation => variation.type !== "ITEM_VARIATION").length > 0) {
            throw new Error("Variations are not type 'ITEM_VARIATION' for Object ID " + object.id);
        }

        const isSourceMarkedDelete = object.is_deleted as boolean
        let attribute = await LinkedObject.find(object.id, provider, Attribute.collectionRef(businessId), Attribute.firestoreConverter)
            .then(data => data as Attribute)

        const isSyncStop = LinkedObject.shouldStopSync(attribute, provider, isSourceMarkedDelete, businessId) as  LinkedObjectSyncResult<Attribute>
        if (isSyncStop) {
            return isSyncStop
        }

        let values: {[Id: string]: AttributeValue } = {};
        const displayOrder = 0  // There is only one variation in Square

        variations.forEach(variation => {
            const variationData = variation.item_variation_data
            if (variationData) {
                // General variables
                const name = Object.is(variationData.name, undefined) ? "" : variationData.name as string;
                const valueDisplayOrder = Object.is(variationData.ordinal, undefined) ? -1 : variationData.ordinal as number;
                const price = Object.is(variationData.price_money?.amount, undefined) ? 0 : variationData.price_money?.amount as number;
                const linkedObject = new LinkedObject(variation.id, true)

                values[Attribute.collectionRef(businessId).doc().id] = {
                    name: name,
                    price: price,
                    isPreSelected: false,
                    displayOrder: valueDisplayOrder,
                    isActive: true,
                    linkedObjects: { [provider]: linkedObject },
                }
            } else {
                throw new Error("Variation data not found for Object ID " + object.id);
            }
        })

        if (Object.keys(values).length > 0) {
            // Square quirk- display order starts either at 0 (update made on POS) or 1 (update made on web)
            // Re-index ordinal
            const displayOrders = Object.keys(values).map(valueId => values[valueId].displayOrder).sort((a, b) => a - b)
            const indexAdjustment = Math.abs(displayOrders[0]);   // Calc index adjustment -- absolute to correct both negative and positive re-indexing
            if (indexAdjustment > 0) {
                // Re-index in place by applying the indexAdjustment to every displayOrder
                Object.keys(values).map(valueId => [valueId, values[valueId].displayOrder - indexAdjustment]).forEach(tuple => values[tuple[0]].displayOrder = tuple[1] as number);
            }
            // Reset pre-selected to the first indexed (or 0)
            Object.keys(values).filter(valueId => values[valueId].displayOrder === 0).forEach(valueId => values[valueId].isPreSelected = true);
        }

        // Perform Upsert
        if (attribute) {
            // const isSyncActive = LinkedObject.isSyncActive(attribute, Provider.square)
            // if (!isSyncActive) {
            //     return new LinkedObjectSyncResult(isSyncActive, attribute)
            // }

            // if exists, update
            // attribute.name = name   // Skip
            attribute.values = values
            attribute.displayOrder = displayOrder;
        } else {
            // if Product does not exist, create
            const linkedObject: LinkedObject = {
                linkedObjectId: object.id,
                isSyncActive: true
            }

            attribute = new Attribute("", values, displayOrder, true, {[provider]: linkedObject})
        }

        return attribute.set(businessId)
            .then(() => new LinkedObjectSyncResult(true, attribute));
    }
}

export interface AttributeMeta {
    name: string,
    isActive: boolean,
    displayOrder: number
}

export interface AttributeValue {
    name: string
    price: number

    displayOrder: number
    isPreSelected: boolean
    isActive: boolean

    linkedObjects: { [Id: string]: LinkedObject }
}