import {ObtainTokenResponse} from "square-connect";
import {Token} from "./Token";
import {Business} from "../Roots/Business";
import {FirestorePaths} from "../../firebaseApp";
import {ConnectedAccounts} from "../Roots/ConnectedAccounts";

export class SquareAuthToken extends Token {

    token: ObtainTokenResponse

    constructor(
        createdBy: string,
        businessId: string,
        token: ObtainTokenResponse,
        provider?: string,
        created?: Date,
        updated?: Date,
        isDeleted?: boolean,
        Id?: Id
    ) {
        super(createdBy, businessId, token, provider ?? SquareAuthToken.provider, Id ?? SquareAuthToken.provider, created, updated)
        this.token = token
    }

    // FirestoreData.FirestoreData

    readonly converter = SquareAuthToken.firestoreConverter;

    metaLinks(): Map<string, string> {
        return new Map([
            [ConnectedAccounts.docRef(this.businessId).path, FirestorePaths.CollectionNames.tokens + "." + SquareAuthToken.provider]
        ]);
    }

    metadata(): SquareAuthTokenMeta {
        return {
                merchantId: this.token.merchant_id as string,
                accessToken: this.token.access_token as string,
                expires: new Date(this.token.expires_at as string)
        }
    }

    // STATICS

    static provider = Provider.square;

    static firestoreConverter = {
        toFirestore(token: SquareAuthToken): FirebaseFirestore.DocumentData {
            return {
                createdBy: token.createdBy,
                businessId: token.businessId,
                token: JSON.parse(JSON.stringify(token.token)),
                provider: token.provider,
                created: token.created.toISOString(),
                updated: token.updated.toISOString(),
                isDeleted: token.isDeleted
            }
        },
        fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): SquareAuthToken {
            const data = snapshot.data();
            return new SquareAuthToken(
                data.createdBy,
                data.businessId,
                data.token,
                data.provider,
                new Date(data.created),
                new Date(data.updated),
                data.isDeleted,
                snapshot.id
            )
        }
    }

    static find(businessId: Id): Promise<SquareAuthToken | void> {
        return SquareAuthToken.collectionRef(businessId)
            .doc(SquareAuthToken.provider)
            .withConverter(SquareAuthToken.firestoreConverter).get()
            .then(snapshot => {
                if (!snapshot.exists) {
                    return
                }
                return snapshot.data() as SquareAuthToken
            })
    }
}

export interface SquareAuthTokenMeta {
    accessToken: string
    merchantId: Id
    expires: Date
}