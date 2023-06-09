import { FirestoreObject } from '../../firestore-core'
import { Business } from './Business'
import MenuGroupMeta from '../surfaces/MenuGroupMeta'
import MenuMeta from '../surfaces/MenuMeta'
import * as Paths from '../../firestore-core/Paths'

const surfacesKey = Paths.CollectionNames.surfaces;

export default class Surfaces extends FirestoreObject {
  menus: { [Id: string]: MenuMeta };

  menuGroups: { [Id: string]: MenuGroupMeta };

  constructor(
    menus: { [p: string]: MenuMeta },
    menuGroups: { [Id: string]: MenuGroupMeta },

    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: string,
  ) {
    super({ created, updated, isDeleted, Id: Id ?? surfacesKey });

    this.menus = menus;
    this.menuGroups = menuGroups;
  }

  // eslint-disable-next-line class-methods-use-this
  collectionRef(businessId: string): FirebaseFirestore.CollectionReference {
    return Business.publicCollectionRef(businessId);
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

  static docRef(businessId: string) : FirebaseFirestore.DocumentReference {
    return Business.publicCollectionRef(businessId).doc(surfacesKey);
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
        snapshot.id,
      );
    },
  };
}
