import { FirestoreObject } from '../core/FirestoreObject';
import { Surfaces } from '../roots/Surfaces';
import { FirestorePaths } from '../../firestore-config/firebaseApp';
import { MenuGroupMeta } from './MenuGroup';

export class Menu extends FirestoreObject<Id> {
  name: string;
  displayName?: string;
  groups: { [Id: string]: MenuGroupMeta };
  groupDisplayOrder: string[];
  isProductAvailable: { [p: string]: boolean };

  constructor(
    name: string,
    groups: { [p: string]: MenuGroupMeta },
    groupDisplayOrder: string[],
    isProductAvailable: { [p: string]: boolean },
    displayName?: string,
    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: Id,
  ) {
    super(created, updated, isDeleted, Id);

    this.name = name;
    this.groups = groups;
    this.groupDisplayOrder = groupDisplayOrder;

    this.isProductAvailable = isProductAvailable;
    this.displayName = displayName;
  }

  // FirestoreAdapter

  readonly converter = Menu.firestoreConverter;

  collectionRef(businessId: Id) {
    return Menu.collectionRef(businessId);
  }

  metaLinks(businessId: Id): { [p: string]: string } {
    return {
      [Surfaces.docRef(businessId).path]: FirestorePaths.CollectionNames.menus + '.' + this.Id,
    };
  }

  metadata(): MenuMeta {
    return {
      name: this.name,
      displayName: this.displayName,
    };
  }

  // STATICS

  static collectionRef(businessId: Id): FirebaseFirestore.CollectionReference {
    return Surfaces.docRef(businessId).collection(FirestorePaths.CollectionNames.menus);
  }

  static firestoreConverter = {
    toFirestore(menu: Menu): FirebaseFirestore.DocumentData {
      return {
        name: menu.name,
        displayName: menu.displayName,
        groups: JSON.parse(JSON.stringify(menu.groups)),
        groupDisplayOrder: JSON.parse(JSON.stringify(menu.groupDisplayOrder)),
        isProductAvailable: JSON.parse(JSON.stringify(menu.isProductAvailable)),
        created: menu.created.toISOString(),
        updated: menu.updated.toISOString(),
        isDeleted: menu.isDeleted,
      };
    },
    fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): Menu {
      const data = snapshot.data();

      return new Menu(
        data.name,
        data.groups,
        data.groupDisplayOrder,
        data.isProductAvailable,
        data.displayName,
        new Date(data.created),
        new Date(data.updated),
        data.isDeleted,
        snapshot.id,
      );
    },
  };
}

export interface MenuMeta {
  name: string;
  displayName?: string;
}
