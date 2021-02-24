import {FirestoreObject} from "../Core/FirestoreObject";
import * as SquareConnect from "square-connect";
import {LinkedObject, LinkedObjectSyncResult} from "../Core/LinkedObject";
import {ProductMeta} from "./Product";
import {Catalog} from "../Roots/Catalog";
import {Business} from "../Roots/Business";
import {FirestorePaths} from "../../firebaseApp";

export class Category extends FirestoreObject<Id> {
    name: string
    products: {[Id: string]: ProductMeta}
    productDisplayOrder: Id[]

    linkedObjects: { [Id: string]: LinkedObject }

    constructor(
        name: string,
        products: { [p: string]: ProductMeta },
        productDisplayOrder: Id[],
        linkedObjects: { [p: string]: LinkedObject },
        created?: Date,
        updated?: Date,
        isDeleted?: boolean,
        Id?: Id
    )
    {
        super(created, updated, isDeleted, Id)

        this.name = name;
        this.products = products;
        this.productDisplayOrder = productDisplayOrder

        this.linkedObjects = linkedObjects;
    }

    // FirestoreAdapter

    readonly converter = Category.firestoreConverter;

    collectionRef(businessId: Id) {
        return Category.collectionRef(businessId);
    }

    metaLinks(businessId: Id): Map<string, string> {
        return new Map([
            [Catalog.docRef(businessId).path, FirestorePaths.CollectionNames.categories + "." + this.Id]
        ]);
    }

    metadata(): CategoryMeta {
        return {
            name: this.name
        }
    }

    // STATICS

    static collectionRef(businessId: Id): FirebaseFirestore.CollectionReference {
        return Catalog.docRef(businessId).collection(FirestorePaths.CollectionNames.categories)
    }

    static firestoreConverter = {
        toFirestore(category: Category): FirebaseFirestore.DocumentData {
            return {
                name: category.name,
                products: JSON.parse(JSON.stringify(category.products)),
                productDisplayOrder: JSON.parse(JSON.stringify(category.productDisplayOrder)),
                linkedObjects: JSON.parse(JSON.stringify(category.linkedObjects)),
                created: category.created.toISOString(),
                updated: category.updated.toISOString(),
                isDeleted: category.isDeleted
            }
        },
        fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): Category {
            const data = snapshot.data();

            return new Category(
                data.name,
                data.products,
                data.productDisplayOrder,
                data.linkedObjects,
                new Date(data.created),
                new Date(data.updated),
                data.isDeleted,
                snapshot.id)
        }
    }


    // LinkedObject
    static async upsertSquareCatalogObject(object: SquareConnect.CatalogObject, businessId:Id): Promise<LinkedObjectSyncResult<Category>> {
        const provider = Provider.square

        const categoryData = object.category_data
        if (!categoryData) {
            throw new Error("Category data is missing for Category " +  object.id);
        }

        const isSourceMarkedDelete = object.is_deleted as boolean
        let category = await LinkedObject.find(object.id, provider, Category.collectionRef(businessId), Category.firestoreConverter)
            .then(data => data as Category)

        const isSyncStop = LinkedObject.shouldStopSync(category, provider, isSourceMarkedDelete, businessId) as  LinkedObjectSyncResult<Category>
        if (isSyncStop) {
            return isSyncStop
        }

        // Perform Upsert
        const name = Object.is(categoryData.name, undefined) ? "" : categoryData.name as string;

        if (category) {

            // if category exists, update
            category.name = name
        } else {
            // if category does not exist, create
            const linkedObject: LinkedObject = {
                linkedObjectId: object.id,
                isSyncActive: true
            }
            category = new Category(name, {}, [], {[provider]: linkedObject})
        }
        return category.set(businessId)
            .then(() => new LinkedObjectSyncResult(true, category))
    }
}

export interface CategoryMeta {
    name: string
}