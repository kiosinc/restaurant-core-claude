import FirestoreObject from '../../firestore-core/core/FirestoreObject';
import { Business } from './Business';
import * as Config from '../../firestore-core/config';
import MenuGroupMeta from '../surfaces/MenuGroupMeta';
import MenuMeta from '../surfaces/MenuMeta';

const surfacesKey = Config.Paths.CollectionNames.surfaces;

export default class Surfaces extends FirestoreObject<string> {
  menus: { [Id: string]: MenuMeta };

  menuGroups: { [Id: string]: MenuGroupMeta };

  constructor(
    menus: { [p: string]: MenuGroupMeta },
    menuGroups: { [Id: string]: MenuGroupMeta },

    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: string,
  ) {
    super(created, updated, isDeleted, Id ?? surfacesKey);

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
  metadata(): {} {
    return {};
  }

  // STATICS

  static docRef(businessId: string) : FirebaseFirestore.DocumentReference {
    return Business.publicCollectionRef(businessId).doc(Config.Paths.CollectionNames.surfaces);
  }

  static firestoreConverter = {
    toFirestore(surfaces: Surfaces): FirebaseFirestore.DocumentData {
      return {
        menus: JSON.parse(JSON.stringify(surfaces.menus)),
        menuGroups: JSON.parse(JSON.stringify(surfaces.menuGroups)),
        isDeleted: surfaces.isDeleted,
      };
    },
    fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): Surfaces {
      const data = snapshot.data();

      return new Surfaces(
        data.menus,
        data.menuGroups,
        snapshot.createTime.toDate(),
        snapshot.updateTime.toDate(),
        data.isDeleted,
        snapshot.id,
      );
    },
  };
}
