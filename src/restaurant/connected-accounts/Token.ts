import FirestoreObject from '../../firestore-core/core/FirestoreObject'
import ConnectedAccounts from '../roots/ConnectedAccounts'
import * as Paths from '../../firestore-core/Paths'

export default abstract class Token extends FirestoreObject<void> {
  createdBy: string;

  businessId: string;

  provider: string;

  protected constructor(
    createdBy: string,
    businessId: string,
    provider: string,
    Id: string,

    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
  ) {
    super(created, updated, isDeleted, Id);

    this.createdBy = createdBy;
    this.businessId = businessId;
    this.provider = provider;
  }

  // FirestoreData.FirestoreData

  collectionRef(): FirebaseFirestore.CollectionReference {
    return Token.collectionRef(this.businessId);
  }

  // STATICS

  static collectionRef(businessId: string): FirebaseFirestore.CollectionReference {
    return ConnectedAccounts.docRef(businessId).collection(Paths.CollectionNames.tokens);
  }
}
