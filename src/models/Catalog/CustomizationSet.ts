import {FirestoreObject} from "../Core/FirestoreObject";
import * as SquareConnect from "square-connect";
import {Business} from "../Roots/Business";
import {LinkedObject, LinkedObjectSyncResult} from "../Core/LinkedObject";
import {Catalog} from "../Roots/Catalog";
import {FirestorePaths} from "../../firebaseApp";

export class CustomizationSet extends FirestoreObject<Id> {
    name: string
    options: { [Id: string]: CustomizationSetOption }
    minSelection: number
    maxSelection: number
    preSelected: Id[]
    displayOrder: number

    linkedObjects: { [Id: string]: LinkedObject }

    constructor(
        name: string,
        options: { [p: string]: CustomizationSetOption },
        minSelection: number,
        maxSelection: number,
        displayOrder: number,
        preSelected: Id[],
        linkedObjects: { [p: string]: LinkedObject },
        created?: Date,
        updated?: Date,
        isDeleted?: boolean,
        Id?: Id)
    {
        super(created, updated, isDeleted, Id)

        this.name = name;
        this.options = options;
        this.minSelection = minSelection;
        this.maxSelection = maxSelection;

        this.displayOrder = displayOrder;
        this.preSelected = preSelected;
        this.linkedObjects = linkedObjects;
    }

    // FirestoreAdapter

    readonly converter = CustomizationSet.firestoreConverter;

    collectionRef(businessId: Id) {
        return CustomizationSet.collectionRef(businessId);
    }

    metaLinks(businessId: Id): Map<string, string> {
        return new Map([
            [Catalog.docRef(businessId).path, FirestorePaths.CollectionNames.customizationSets + "." + this.Id]
        ]);
    }

    metadata(): CustomizationSetMeta {
        return {
            name: this.name
        }
    }

    // STATICS

    static collectionRef(businessId: Id): FirebaseFirestore.CollectionReference {
        return Catalog.docRef(businessId).collection(FirestorePaths.CollectionNames.customizationSets)
    }

    static firestoreConverter = {
        toFirestore(customizationSet: CustomizationSet): FirebaseFirestore.DocumentData {
            return {
                name: customizationSet.name,
                options: JSON.parse(JSON.stringify(customizationSet.options)),
                minSelection: customizationSet.minSelection,
                maxSelection: customizationSet.maxSelection,
                displayOrder: customizationSet.displayOrder,
                preSelected: customizationSet.preSelected,
                linkedObjects: JSON.parse(JSON.stringify(customizationSet.linkedObjects)),
                created: customizationSet.created.toISOString(),
                updated: customizationSet.updated.toISOString(),
                isDeleted: customizationSet.isDeleted
            }
        },
        fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): CustomizationSet {
            const data = snapshot.data();

            return new CustomizationSet(data.name, data.options, data.minSelection, data.maxSelection, data.displayOrder, data.preselected, data.linkedObjects, new Date(data.created), new Date(data.updated), data.isDeleted, snapshot.id)
        }
    }

    static async upsertSquareCatalogObject(object: SquareConnect.CatalogObject, businessId:Id): Promise<LinkedObjectSyncResult<CustomizationSet>> {
        const provider = Provider.square

        const modifierListData = object.modifier_list_data
        if (!modifierListData) {
            throw new Error("Modifier List data is missing for Modifier List " +  object.id);
        }

        const isSourceMarkedDelete = object.is_deleted as boolean
        let customizationSet = await LinkedObject.find(object.id, provider, CustomizationSet.collectionRef(businessId), CustomizationSet.firestoreConverter)
            .then(data => data as CustomizationSet)

        const isSyncStop = LinkedObject.shouldStopSync(customizationSet, provider, isSourceMarkedDelete, businessId) as  LinkedObjectSyncResult<CustomizationSet>
        if (isSyncStop) {
            return isSyncStop
        }

        // Find and update or create new
        // Get modifier list properties
        const name = Object.is(modifierListData.name, undefined) ? "" : modifierListData.name as string;
        const displayOrder = Object.is(modifierListData.ordinal, undefined) ? -1 : modifierListData.ordinal as number;   // 'Untouched' modifier lists via squareup.com return 'undefined'

        // Create modifier list modifiers aka Customization Set Options
        let options: { [Id: string]: CustomizationSetOption } = {};
        if (modifierListData.modifiers) {
            modifierListData.modifiers.forEach(modifier => {
                const data = modifier.modifier_data
                if (!data) {
                    throw new Error("Modifier data is missing for Modifier " + modifier.id + " in Modifier List " + object.id);
                }

                const linkedObject: LinkedObject = {
                    linkedObjectId: modifier.id,
                    isSyncActive: true
                }

                const option: CustomizationSetOption = {
                    name: Object.is(data.name, undefined) ? "" : data.name as string,
                    // The additional cost of the attribute as an integer in the smallest currency unit.
                    price: Object.is(data.price_money?.amount, undefined) ? 0 : data.price_money?.amount as number,
                    // Sorting order for display
                    displayOrder: Object.is(data.ordinal, undefined) ? -1 : data.ordinal as number,
                    linkedObjects: {[provider]: linkedObject}
                }

                const Id = CustomizationSet.collectionRef(businessId).doc().id as string;
                options[Id] = option
            })
        }

        let minSelection: number = -1
        let maxSelection: number = -1
        let preSelected: string[] = []

        // Single selection pre-selection override
        if (modifierListData.selection_type === "SINGLE") {
            minSelection = 0
            maxSelection = 1

            // Sort to get first element
            const sorted = Object.entries(options)
                .sort((a, b) => a[1].displayOrder - b[1].displayOrder)
                .map((value) => value[0])

            preSelected = sorted[0] ? [sorted[0]] : []
        }

        // TODO normalize display order for options, and for the customizationSet itself?

        if (customizationSet) {
            // if CustomizationSet exists, update
            customizationSet.name = name
            customizationSet.displayOrder = displayOrder
            customizationSet.options = options
            customizationSet.minSelection = minSelection
            customizationSet.maxSelection = maxSelection
            customizationSet.preSelected = preSelected

        } else {
            // if CustomizationSet does not exist, create
            const linkedObject: LinkedObject = {
                linkedObjectId: object.id,
                isSyncActive: true
            }
            customizationSet = new CustomizationSet(name, options, minSelection, maxSelection, displayOrder, preSelected, {[provider]: linkedObject})
        }

        return customizationSet.set(businessId)
            .then(() => new LinkedObjectSyncResult(true, customizationSet))
    }
}

export interface CustomizationSetMeta {
    name: string;
}

export interface CustomizationSetOption {
    name: string
    // The additional cost of the attribute as an integer in the smallest currency unit.
    price: number
    // Sorting order for display
    displayOrder: number
    linkedObjects: { [Id: string]: LinkedObject }
}
