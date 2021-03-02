import { FirestorePaths } from "../../firestore-config/firebaseApp";
import { FirestoreObject } from "../Core/FirestoreObject";
import { Business } from "./Business";
import { MenuGroupMeta } from "../Surfaces/MenuGroup";
import { MenuMeta } from "../Surfaces/Menu";

const surfacesKey = FirestorePaths.CollectionNames.surfaces;

export class Surfaces extends FirestoreObject<Id> {
  menus: { [Id: string]: MenuMeta };
  menuGroups: { [Id: string]: MenuGroupMeta };

  constructor(
    menus: { [p: string]: MenuGroupMeta },
    menuGroups: { [Id: string]: MenuGroupMeta },

    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: string
  ) {
    super(created, updated, isDeleted, Id ?? surfacesKey);

    this.menus = menus;
    this.menuGroups = menuGroups;
  }

  // FirebaseAdapter

  readonly converter = Surfaces.firestoreConverter;

  collectionRef(businessId: Id): FirebaseFirestore.CollectionReference {
    return Business.publicCollectionRef(businessId);
  }

  metaLinks(): { [p: string]: string } {
    return {};
  }

  metadata(): {} {
    return {};
  }

  // STATICS

  static docRef(businessId: Id): FirebaseFirestore.DocumentReference {
    return Business.publicCollectionRef(businessId).doc(
      FirestorePaths.CollectionNames.surfaces
    );
  }

  static firestoreConverter = {
    toFirestore(surfaces: Surfaces): FirebaseFirestore.DocumentData {
      return {
        menus: JSON.parse(JSON.stringify(surfaces.menus)),
        menuGroups: JSON.parse(JSON.stringify(surfaces.menuGroups)),

        created: surfaces.created.toISOString(),
        updated: surfaces.updated.toISOString(),
        isDeleted: surfaces.isDeleted,
      };
    },
    fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): Surfaces {
      const data = snapshot.data();

      return new Surfaces(
        data.menus,
        data.menuGroups,

        new Date(data.created),
        new Date(data.updated),
        data.isDeleted,
        snapshot.id
      );
    },
  };
}
