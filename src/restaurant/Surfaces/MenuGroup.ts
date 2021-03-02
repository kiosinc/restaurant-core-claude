import { FirestoreObject } from '../core/FirestoreObject';
import { ProductMeta } from '../catalog/Product';
import { FirestorePaths } from '../../firestore-config/firebaseApp';
import { Surfaces } from '../roots/Surfaces';

export class MenuGroup extends FirestoreObject<Id> {
  // The group's name, meant to be displayable to the customer.
  name: string;
  displayName?: string;
  // Products in this group
  products: { [p: string]: ProductMeta };
  productDisplayOrder: string[];
  parentGroup?: string;
  childGroup?: string;

  constructor(
    name: string,
    products: { [p: string]: ProductMeta },
    productDisplayOrder: string[],
    displayName?: string,
    parentGroup?: string,
    childGroup?: string,
    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: Id,
  ) {
    super(created, updated, isDeleted, Id);
    this.name = name;

    this.products = products;
    this.productDisplayOrder = productDisplayOrder;

    this.displayName = displayName;

    this.parentGroup = parentGroup;
    this.childGroup = childGroup;
  }

  readonly converter = MenuGroup.firestoreConverter;

  collectionRef(businessId: Id) {
    return MenuGroup.collectionRef(businessId);
  }

  metaLinks(businessId: Id): { [p: string]: string } {
    return {
      [Surfaces.docRef(businessId).path]: FirestorePaths.CollectionNames.menuGroups + '.' + this.Id,
    };
  }

  metadata(): MenuGroupMeta {
    return {
      name: this.name,
      displayName: this.displayName,
    };
  }

  // STATICS

  static collectionRef(businessId: Id): FirebaseFirestore.CollectionReference {
    return Surfaces.docRef(businessId).collection(FirestorePaths.CollectionNames.menuGroups);
  }

  static firestoreConverter = {
    toFirestore(menuGroup: MenuGroup): FirebaseFirestore.DocumentData {
      return {
        name: menuGroup.name,
        products: JSON.parse(JSON.stringify(menuGroup.products)),
        productDisplayOrder: JSON.parse(JSON.stringify(menuGroup.productDisplayOrder)),
        displayName: menuGroup.displayName,
        parentGroup: menuGroup.parentGroup,
        childGroup: menuGroup.childGroup,
        created: menuGroup.created.toISOString(),
        updated: menuGroup.updated.toISOString(),
        isDeleted: menuGroup.isDeleted,
      };
    },
    fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): MenuGroup {
      const data = snapshot.data();

      return new MenuGroup(
        data.name,
        data.products,
        data.productDisplayOrder,
        data.displayName,
        data.parentGroup,
        data.childGroup,
        new Date(data.created),
        new Date(data.updated),
        data.isDeleted,
        snapshot.id,
      );
    },
  };
}

export interface MenuGroupMeta {
  name: string;
  displayName?: string;
}
