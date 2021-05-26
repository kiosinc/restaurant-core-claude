import FirestoreObject from '../../firestore-core/core/FirestoreObject';
import * as Config from '../../firestore-core/config';
import Surfaces from '../roots/Surfaces';
import MenuGroupMeta from './MenuGroupMeta';
import ProductMeta from '../catalog/ProductMeta';

export default class MenuGroup extends FirestoreObject<string> {
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
    Id?: string,
  ) {
    super(created, updated, isDeleted, Id);
    this.name = name;

    this.products = products;
    this.productDisplayOrder = productDisplayOrder;

    this.displayName = displayName;

    this.parentGroup = parentGroup;
    this.childGroup = childGroup;
  }

  // eslint-disable-next-line class-methods-use-this
  collectionRef(businessId: string) {
    return MenuGroup.collectionRef(businessId);
  }

  metaLinks(businessId: string): { [p: string]: string } {
    return {
      [Surfaces.docRef(businessId).path]: `${Config.Paths.CollectionNames.menuGroups}.${this.Id}`,
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
    return Surfaces.docRef(businessId).collection(Config.Paths.CollectionNames.menuGroups);
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
        snapshot.createTime.toDate(),
        snapshot.updateTime.toDate(),
        data.isDeleted,
        snapshot.id,
      );
    },
  };
}
