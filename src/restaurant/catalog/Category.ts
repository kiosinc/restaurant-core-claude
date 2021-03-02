import { FirestoreObject } from "../core/FirestoreObject";
import { LinkedObject } from "../core/LinkedObject";
import { ProductMeta } from "./Product";
import { Catalog } from "../roots/Catalog";
import { FirestorePaths } from "../../firestore-config/firebaseApp";

export class Category extends FirestoreObject<Id> {
  name: string;
  products: { [Id: string]: ProductMeta };
  productDisplayOrder: Id[];

  linkedObjects: { [Id: string]: LinkedObject };

  constructor(
    name: string,
    products: { [p: string]: ProductMeta },
    productDisplayOrder: Id[],
    linkedObjects: { [p: string]: LinkedObject },
    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: Id
  ) {
    super(created, updated, isDeleted, Id);

    this.name = name;
    this.products = products;
    this.productDisplayOrder = productDisplayOrder;

    this.linkedObjects = linkedObjects;
  }

  // FirestoreAdapter

  readonly converter = Category.firestoreConverter;

  collectionRef(businessId: Id) {
    return Category.collectionRef(businessId);
  }

  metaLinks(businessId: Id): { [p: string]: string } {
    return {
      [Catalog.docRef(businessId).path]:
        FirestorePaths.CollectionNames.categories + "." + this.Id,
    };
  }

  metadata(): CategoryMeta {
    return {
      name: this.name,
    };
  }

  // STATICS

  static collectionRef(businessId: Id): FirebaseFirestore.CollectionReference {
    return Catalog.docRef(businessId).collection(
      FirestorePaths.CollectionNames.categories
    );
  }

  static firestoreConverter = {
    toFirestore(category: Category): FirebaseFirestore.DocumentData {
      return {
        name: category.name,
        products: JSON.parse(JSON.stringify(category.products)),
        productDisplayOrder: JSON.parse(
          JSON.stringify(category.productDisplayOrder)
        ),
        linkedObjects: JSON.parse(JSON.stringify(category.linkedObjects)),
        created: category.created.toISOString(),
        updated: category.updated.toISOString(),
        isDeleted: category.isDeleted,
      };
    },
    fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): Category {
      const data = snapshot.data();

      return new Category(
        data.name,
        data.products,
        data.productDisplayOrder,
        data.linkedObjects,
        new Date(data.created),
        new Date(data.updated),
        data.isDeleted,
        snapshot.id
      );
    },
  };
}

export interface CategoryMeta {
  name: string;
}
