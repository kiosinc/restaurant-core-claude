import { FirestoreObject } from "../Core/FirestoreObject";
import { firestoreApp } from "../../firestore-config/firebaseApp";
import { BusinessProfile } from "../Misc/BusinessProfile";
import { FirestorePaths } from "../../firestore-config/firebaseApp";
import { User } from "../../user/User";
import { Address } from "../Misc/Address";
import { Catalog } from "./Catalog";
import { ConnectedAccounts } from "./ConnectedAccounts";
import { Surfaces } from "./Surfaces";

export enum BusinessType {
  restaurant = "restaurant",
}

export class Business extends FirestoreObject<void> {
  agent: string;
  createdBy: string;
  type: BusinessType;
  businessProfile: BusinessProfile;
  roles: { [uid: string]: Role };

  constructor(
    agent: string,
    createdBy: string,
    type: BusinessType,
    businessProfile: BusinessProfile,
    roles: { [uid: string]: Role },
    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: Id
  ) {
    super(created, updated, isDeleted, Id);
    this.agent = agent;
    this.createdBy = createdBy;
    this.type = type;
    this.businessProfile = businessProfile;
    this.roles = roles;
  }

  // FirebaseAdapter

  readonly converter = Business.firestoreConverter;

  collectionRef(): FirebaseFirestore.CollectionReference {
    return Business.collectionRef();
  }

  metaLinks(): { [p: string]: string } {
    return {};
  }

  metadata(): {} {
    return {};
  }

  // STATICS

  static docRef(businessId: Id): FirebaseFirestore.DocumentReference {
    return this.collectionRef().doc(businessId);
  }

  static collectionRef(): FirebaseFirestore.CollectionReference {
    return firestoreApp.collection(FirestorePaths.CollectionNames.businesses);
  }

  static firestoreConverter = {
    toFirestore(account: Business): FirebaseFirestore.DocumentData {
      return {
        agent: account.agent,
        createdBy: account.createdBy,
        type: JSON.parse(JSON.stringify(account.type)),
        businessProfile: BusinessProfile.firestoreConverter.toFirestore(
          account.businessProfile
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
        snapshot.id
      );
    },
  };

  static publicCollectionRef(
    businessId: Id
  ): FirebaseFirestore.CollectionReference {
    return Business.docRef(businessId).collection(
      FirestorePaths.Environment.public
    );
  }

  static privateCollectionRef(
    businessId: Id
  ): FirebaseFirestore.CollectionReference {
    return Business.docRef(businessId).collection(
      FirestorePaths.Environment.private
    );
  }

  static sandboxCollectionRef(
    businessId: Id
  ): FirebaseFirestore.CollectionReference {
    return Business.docRef(businessId).collection(
      FirestorePaths.Environment.sandbox
    );
  }

  static create(user: User, type: BusinessType, device: string) {
    const profile: BusinessProfile = new BusinessProfile("", new Address());

    const uid = user.token.uid;
    let newBusiness = new Business(device, uid, type, profile, {
      [uid]: Role.owner,
    });

    let newCatalog = new Catalog({}, {}, {}, {}, {});
    let newConnectedAccounts = new ConnectedAccounts({}, {});
    let newSurface = new Surfaces({}, {});

    // TODO security is disabled
    // Need to have cloud function on user create to update claims
    return (
      newBusiness
        .set()
        // .then(() => {
        //     let claims = user.claims
        //     claims.businessRole[newBusiness.Id] = Role.owner
        //     return auth().setCustomUserClaims(uid, Claims.wrapper(claims))
        // })
        .then(() => {
          const batch = firestoreApp.batch();

          batch.set(
            Catalog.docRef(newBusiness.Id).withConverter(
              Catalog.firestoreConverter
            ),
            newCatalog
          );
          batch.set(
            ConnectedAccounts.docRef(newBusiness.Id).withConverter(
              ConnectedAccounts.firestoreConverter
            ),
            newConnectedAccounts
          );
          batch.set(
            Surfaces.docRef(newBusiness.Id).withConverter(
              Surfaces.firestoreConverter
            ),
            newSurface
          );
          return batch.commit();
        })
        .then(() => {
          return newBusiness.Id;
        })
    );
  }
}
