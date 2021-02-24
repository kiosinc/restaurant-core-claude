import {FirestoreObject} from "../Core/FirestoreObject";
import {Business} from "./Business";
import {FirestorePaths} from "../../firebaseApp";
import {CategoryMeta} from "../Catalog/Category";
import {CustomizationSetMeta} from "../Catalog/CustomizationSet";
import {ProductMeta} from "../Catalog/Product";
import {TaxRateMeta} from "../Catalog/TaxRate";
import {AttributeMeta} from "../Catalog/Attribute";

const catalogKey = FirestorePaths.CollectionNames.catalog

export class Catalog extends FirestoreObject<Id> {
    categories: { [Id: string]: CategoryMeta }
    customizationSets: { [Id: string]: CustomizationSetMeta }
    products: { [Id: string]: ProductMeta }
    taxRates: { [Id: string]: TaxRateMeta }
    attributes: { [Id: string]: AttributeMeta }

    constructor(
        categories: { [p: string]: CategoryMeta },
        attributes: { [Id: string]: AttributeMeta } = {},
        customizationSets: { [p: string]: CustomizationSetMeta },
        products: { [p: string]: ProductMeta },
        taxRates: { [p: string]: TaxRateMeta },
        created?: Date,
        updated?: Date,
        isDeleted?: boolean,
        Id?: string) {

        super(created, updated, isDeleted, Id ?? catalogKey);

        this.categories = categories
        this.attributes = attributes
        this.customizationSets = customizationSets
        this.products = products
        this.taxRates = taxRates
    }

    // FirebaseAdapter

    readonly converter = Catalog.firestoreConverter;

    collectionRef(businessId: Id): FirebaseFirestore.CollectionReference {
        return Business.publicCollectionRef(businessId)
    }

    metaLinks(): Map<string, string> {
        return new Map();
    }

    metadata(): {} {
        return {};
    }

    // STATICS

    static docRef(businessId: Id) : FirebaseFirestore.DocumentReference {
        return Business.publicCollectionRef(businessId).doc(FirestorePaths.CollectionNames.catalog)
    }

    static firestoreConverter = {
        toFirestore(catalog: Catalog): FirebaseFirestore.DocumentData {
            return {
                categories: JSON.parse(JSON.stringify(catalog.categories)),
                customizationSets: JSON.parse(JSON.stringify(catalog.customizationSets)),
                attributes: JSON.parse(JSON.stringify(catalog.attributes)),
                products: JSON.parse(JSON.stringify(catalog.products)),
                taxRates: JSON.parse(JSON.stringify(catalog.taxRates)),
                created: catalog.created.toISOString(),
                updated: catalog.updated.toISOString(),
                isDeleted: catalog.isDeleted
            }
        },
        fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): Catalog {
            const data = snapshot.data();

            return new Catalog(data.categories, data.attributes, data.customizationsSets, data.products, data.taxRates, new Date(data.created), new Date(data.updated), data.isDeleted, snapshot.id)
        }
    }
}