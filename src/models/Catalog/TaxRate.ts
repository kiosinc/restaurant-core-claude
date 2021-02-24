import {FirestoreObject} from "../Core/FirestoreObject";
import * as SquareConnect from "square-connect";
import {LinkedObject, LinkedObjectSyncResult} from "../Core/LinkedObject";
import {Business} from "../Roots/Business";
import {Catalog} from "../Roots/Catalog";
import {FirestorePaths} from "../../firebaseApp";

export class TaxRate extends FirestoreObject<Id> {
    name: string
    rate: number
    isCalculatedSubTotalPhase: boolean
    isInclusive: boolean
    linkedObjects: { [Id: string]: LinkedObject }

    constructor(
        name: string,
        rate: number,
        isCalculatedSubTotalPhase: boolean,
        isInclusive: boolean,
        linkedObjects: { [Id: string]: LinkedObject },
        created?: Date,
        updated?: Date,
        isDeleted?: boolean,
        Id?: Id
    ) {
        super(created, updated, isDeleted, Id);
        this.name = name
        this.rate = rate
        this.isCalculatedSubTotalPhase = isCalculatedSubTotalPhase
        this.isInclusive = isInclusive
        this.linkedObjects = linkedObjects
    }

    readonly converter = TaxRate.firestoreConverter;

    collectionRef(businessId: Id): FirebaseFirestore.CollectionReference {
        return TaxRate.collectionRef(businessId)
    }

    metaLinks(businessId: Id): Map<string, string> {
        return new Map([
            [Catalog.docRef(businessId).path, FirestorePaths.CollectionNames.taxRates + "." + this.Id]
        ]);
    }

    metadata(): TaxRateMeta {
        return {
            name: this.name,
            rate: this.rate
        }
    }

    // STATICS

    static collectionRef(businessId: Id): FirebaseFirestore.CollectionReference {
        return Catalog.docRef(businessId).collection(FirestorePaths.CollectionNames.taxRates)
    }

    static firestoreConverter = {
        toFirestore(taxRate: TaxRate): FirebaseFirestore.DocumentData {
            return {
                name: taxRate.name,
                rate: taxRate.rate,
                isCalculatedSubTotalPhase: taxRate.isCalculatedSubTotalPhase,
                isInclusive: taxRate.isInclusive,
                linkedObjects: JSON.parse(JSON.stringify(taxRate.linkedObjects)),
                created: taxRate.created.toISOString(),
                updated: taxRate.updated.toISOString(),
                isDeleted: taxRate.isDeleted
            }
        },
        fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): TaxRate {
            const data = snapshot.data();

            return new TaxRate(
                data.name,
                data.rate,
                data.isCalculatedSubTotalPhase,
                data.isInclusive,
                data.linkedObjects,
                new Date(data.created),
                new Date(data.updated),
                data.isDeleted,
                snapshot.id
            )
        }
    }

// Find LinkedObject
    static async upsertSquareCatalogObject(object: SquareConnect.CatalogObject, businessId:Id): Promise<LinkedObjectSyncResult<TaxRate>> {
        const provider = Provider.square;

        const taxData = object.tax_data
        if (!taxData) {
            throw new Error("Tax data is missing for Tax " +  object.id);
        }

        const isSourceMarkedDelete = object.is_deleted as boolean
        let taxRate = await LinkedObject.find(object.id, provider, TaxRate.collectionRef(businessId), TaxRate.firestoreConverter)
            .then(data => data as TaxRate)

        const isSyncStop = LinkedObject.shouldStopSync(taxRate, provider, isSourceMarkedDelete, businessId) as  LinkedObjectSyncResult<TaxRate>
        if (isSyncStop) {
            return isSyncStop
        }

        const name = Object.is(taxData.name, undefined) ? "" : taxData.name as string;
        const isCalculatedSubTotalPhase = taxData.calculation_phase === "TAX_SUBTOTAL_PHASE";
        const isInclusive = taxData.inclusion_type === "INCLUSIVE";
        const rate = Object.is(taxData.percentage, undefined) ? 0 : parseFloat(taxData.percentage as string);

        if (taxRate) {
            // if exists, update
            taxRate.name = name;
            taxRate.isCalculatedSubTotalPhase = isCalculatedSubTotalPhase;
            taxRate.isInclusive = isInclusive;
            taxRate.rate = rate;
        } else {
            // if does not exist, create
            const linkedObject: LinkedObject = {
                linkedObjectId: object.id,
                isSyncActive: true
            }
            taxRate = new TaxRate(
                name,
                rate,
                isCalculatedSubTotalPhase,
                isInclusive,
                { [provider]: linkedObject}
            )
        }
        return taxRate.set(businessId).then(docRef => new LinkedObjectSyncResult(true, taxRate))
    }
}

export interface TaxRateMeta {
    name: string
    rate: number
}
