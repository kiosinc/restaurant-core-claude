import { FirestoreObject } from '../../firestore-core'
import Surfaces from '../roots/Surfaces'
import MenuGroupMeta from './MenuGroupMeta'
import ProductMeta from '../catalog/ProductMeta'
import * as Paths from '../../firestore-core/Paths'

export default class MenuGroup extends FirestoreObject {
  // The group's name, meant to be displayable to the customer.
  name: string;

  displayName: string | null;

  // Products in this group
  products: { [p: string]: ProductMeta };

  productDisplayOrder: string[];

  parentGroup: string | null;

  childGroup: string | null;

  mirrorCategoryId: string | null;

  constructor(
    name: string,
    products: { [p: string]: ProductMeta },
    productDisplayOrder: string[],
    displayName: string | null,
    parentGroup: string | null,
    childGroup: string | null,
    mirrorCategoryId: string | null,
    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: string,
  ) {
    super({created, updated, isDeleted, Id});
    this.name = name;

    this.products = products;
    this.productDisplayOrder = productDisplayOrder;

    this.displayName = displayName ?? '';

    this.parentGroup = parentGroup;
    this.childGroup = childGroup;

    this.mirrorCategoryId = mirrorCategoryId;
  }

  // eslint-disable-next-line class-methods-use-this
  collectionRef(businessId: string) {
    return MenuGroup.collectionRef(businessId);
  }

  metaLinks(businessId: string): { [p: string]: string } {
    return {
      [Surfaces.docRef(businessId).path]: `${Paths.CollectionNames.menuGroups}.${this.Id}`,
    };
  }

  metadata(): MenuGroupMeta {
    return {
      name: this.name,
      displayName: this.displayName,
    };
  }

  // STATICS

  static collectionRef(businessId: string): FirebaseFirestore.CollectionReference {
    return Surfaces.docRef(businessId).collection(Paths.CollectionNames.menuGroups);
  }

  static firestoreConverter = {
    toFirestore(menuGroup: MenuGroup): FirebaseFirestore.DocumentData {
      return {
        name: menuGroup.name,
        products: JSON.parse(JSON.stringify(menuGroup.products)),
        productDisplayOrder: JSON.parse(JSON.stringify(menuGroup.productDisplayOrder)),
        displayName: menuGroup.displayName ?? null,
        parentGroup: menuGroup.parentGroup ?? null,
        childGroup: menuGroup.childGroup ?? null,
        mirrorCategoryId: menuGroup.mirrorCategoryId ?? null,
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
        data.displayName ?? null,
        data.parentGroup ?? null,
        data.childGroup ?? null,
        data.mirrorCategoryId ?? null,
        new Date(data.created),
        new Date(data.updated),
        data.isDeleted,
        snapshot.id,
      );
    },
  };
}
