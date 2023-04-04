import * as firestore from 'firebase-admin/firestore'
import FirestoreObject from '../../firestore-core/core/FirestoreObject'
import * as Constants from '../../firestore-core/Constants'
import BusinessProfile from '../misc/BusinessProfile'
import * as Paths from '../../firestore-core/Paths'

export enum BusinessType {
  restaurant = 'restaurant',
}

export class Business extends FirestoreObject<void> {
  agent: string;

  createdBy: string;

  type: BusinessType;

  businessProfile: BusinessProfile;

  roles: { [uid: string]: Constants.Role };

  constructor(
    agent: string,
    createdBy: string,
    type: BusinessType,
    businessProfile: BusinessProfile,
    roles: { [uid: string]: Constants.Role },
    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: string,
  ) {
    super(created, updated, isDeleted, Id);
    this.agent = agent;
    this.createdBy = createdBy;
    this.type = type;
    this.businessProfile = businessProfile;
    this.roles = roles;
  }

  // eslint-disable-next-line class-methods-use-this
  collectionRef(): FirebaseFirestore.CollectionReference {
    return Business.collectionRef();
  }

  // eslint-disable-next-line class-methods-use-this
  metaLinks(): { [p: string]: string } {
    return {};
  }

  // eslint-disable-next-line class-methods-use-this
  metadata(): Record<string, never> {
    return {};
  }

  // STATICS

  static docRef(businessId: string): FirebaseFirestore.DocumentReference {
    return this.collectionRef().doc(businessId);
  }

  static collectionRef(): FirebaseFirestore.CollectionReference {
    return firestore.getFirestore().collection(Paths.CollectionNames.businesses);
  }

  static firestoreConverter = {
    toFirestore(account: Business): FirebaseFirestore.DocumentData {
      return {
        agent: account.agent,
        createdBy: account.createdBy,
        type: JSON.parse(JSON.stringify(account.type)),
        businessProfile: BusinessProfile.firestoreConverter.toFirestore(
          account.businessProfile,
        ),
        roles: JSON.parse(JSON.stringify(account.roles)),
        created: account.created.toISOString(),
        updated: account.updated.toISOString(),
        isDeleted: account.isDeleted,
      };
    },
    fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): Business {
      const data = snapshot.data();

      return new Business(
        data.agent,
        data.createdBy,
        data.type,
        data.businessProfile,
        data.roles,
        new Date(data.created),
        new Date(data.updated),
        data.isDeleted,
        snapshot.id,
      );
    },
  };

  static publicCollectionRef(businessId: string): FirebaseFirestore.CollectionReference {
    return Business.docRef(businessId)
      .collection(Paths.Environment.public);
  }

  static privateCollectionRef(businessId: string): FirebaseFirestore.CollectionReference {
    return Business.docRef(businessId)
      .collection(Paths.Environment.private);
  }

  static sandboxCollectionRef(businessId: string): FirebaseFirestore.CollectionReference {
    return Business.docRef(businessId)
      .collection(Paths.Environment.sandbox);
  }
}
