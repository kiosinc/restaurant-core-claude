import FirestoreObject from '../../firestore-core/core/FirestoreObject';
import ConnectedAccounts from '../roots/ConnectedAccounts';
import * as Config from '../../firestore-core/config';

export default abstract class Token extends FirestoreObject<void> {
  createdBy: string;

  businessId: string;

  provider: string;

  token: {};

  protected constructor(
    createdBy: string,
    businessId: string,
    token: {},
    provider: string,
    Id: string,

    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
  ) {
    super(created, updated, isDeleted, Id);

    this.createdBy = createdBy;
    this.businessId = businessId;
    this.token = token;
    this.provider = provider;
  }

  // FirestoreData.FirestoreData

  collectionRef(): FirebaseFirestore.CollectionReference {
    return Token.collectionRef(this.businessId);
  }

  // STATICS

  static collectionRef(businessId: string): FirebaseFirestore.CollectionReference {
    return ConnectedAccounts.docRef(businessId).collection(Config.Paths.CollectionNames.tokens);
  }
}
