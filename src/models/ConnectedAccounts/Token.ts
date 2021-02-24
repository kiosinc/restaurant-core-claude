import {FirestoreObject} from "../Core/FirestoreObject";
import {ConnectedAccounts} from "../Roots/ConnectedAccounts";
import {FirestorePaths} from "../../firebaseApp";

export abstract class Token extends FirestoreObject<void> {
    createdBy: string;
    businessId: string;
    provider: string;
    token: {}

    protected constructor(
        createdBy: string,
        businessId: string,
        token: {},
        provider: string,
        Id: Id,

        created?: Date,
        updated?: Date,
        isDeleted?: boolean
    ) {
        super(created, updated, isDeleted, Id);

        this.createdBy = createdBy;
        this.businessId = businessId;
        this.token = token;
        this.provider = provider;
    }

    // FirestoreData.FirestoreData

    collectionRef(): FirebaseFirestore.CollectionReference {
        return Token.collectionRef(this.businessId)
    }

    // STATICS

    static collectionRef(businessId: Id): FirebaseFirestore.CollectionReference {
        return ConnectedAccounts.docRef(businessId).collection(FirestorePaths.CollectionNames.tokens)
    }
}