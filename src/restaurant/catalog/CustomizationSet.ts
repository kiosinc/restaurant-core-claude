import { FirestoreObject } from "../core/FirestoreObject";
import { LinkedObject } from "../core/LinkedObject";
import { Catalog } from "../roots/Catalog";
import { FirestorePaths } from "../../firestore-config/firebaseApp";

export class CustomizationSet extends FirestoreObject<Id> {
  name: string;
  options: { [Id: string]: CustomizationSetOption };
  minSelection: number;
  maxSelection: number;
  preSelected: Id[];
  displayOrder: number;

  linkedObjects: { [Id: string]: LinkedObject };

  constructor(
    name: string,
    options: { [p: string]: CustomizationSetOption },
    minSelection: number,
    maxSelection: number,
    displayOrder: number,
    preSelected: Id[],
    linkedObjects: { [p: string]: LinkedObject },
    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: Id
  ) {
    super(created, updated, isDeleted, Id);

    this.name = name;
    this.options = options;
    this.minSelection = minSelection;
    this.maxSelection = maxSelection;

    this.displayOrder = displayOrder;
    this.preSelected = preSelected;
    this.linkedObjects = linkedObjects;
  }

  // FirestoreAdapter

  readonly converter = CustomizationSet.firestoreConverter;

  collectionRef(businessId: Id) {
    return CustomizationSet.collectionRef(businessId);
  }

  metaLinks(businessId: Id): { [p: string]: string } {
    return {
      [Catalog.docRef(businessId).path]:
        FirestorePaths.CollectionNames.customizationSets + "." + this.Id,
    };
  }

  metadata(): CustomizationSetMeta {
    return {
      name: this.name,
      displayOrder: this.displayOrder,
    };
  }

  // STATICS

  static collectionRef(businessId: Id): FirebaseFirestore.CollectionReference {
    return Catalog.docRef(businessId).collection(
      FirestorePaths.CollectionNames.customizationSets
    );
  }

  static firestoreConverter = {
    toFirestore(
      customizationSet: CustomizationSet
    ): FirebaseFirestore.DocumentData {
      return {
        name: customizationSet.name,
        options: JSON.parse(JSON.stringify(customizationSet.options)),
        minSelection: customizationSet.minSelection,
        maxSelection: customizationSet.maxSelection,
        displayOrder: customizationSet.displayOrder,
        preSelected: customizationSet.preSelected,
        linkedObjects: JSON.parse(
          JSON.stringify(customizationSet.linkedObjects)
        ),
        created: customizationSet.created.toISOString(),
        updated: customizationSet.updated.toISOString(),
        isDeleted: customizationSet.isDeleted,
      };
    },
    fromFirestore(
      snapshot: FirebaseFirestore.QueryDocumentSnapshot
    ): CustomizationSet {
      const data = snapshot.data();

      return new CustomizationSet(
        data.name,
        data.options,
        data.minSelection,
        data.maxSelection,
        data.displayOrder,
        data.preselected,
        data.linkedObjects,
        new Date(data.created),
        new Date(data.updated),
        data.isDeleted,
        snapshot.id
      );
    },
  };
}

export interface CustomizationSetMeta {
  name: string;
  displayOrder: number;
}

export interface CustomizationSetOption {
  name: string;
  // The additional cost of the attribute as an integer in the smallest currency unit.
  price: number;
  // Sorting order for display
  displayOrder: number;
  linkedObjects: { [Id: string]: LinkedObject };
}
