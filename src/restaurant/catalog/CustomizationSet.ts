/**
 * CustomizationSet class
 */
import FirestoreObject from '../../firestore-core/core/FirestoreObject';
import LinkedObject from '../../firestore-core/core/LinkedObject';
import Catalog from '../Roots/Catalog';
import * as Config from '../../firestore-core/config';
import CustomizationSetMeta from './CustomizationSetMeta';

export class CustomizationSet extends FirestoreObject<string> {
  name: string;

  options: { [Id: string]: CustomizationSetOption };

  minSelection: number;

  maxSelection: number;

  preSelected: string[];

  displayOrder: number;

  linkedObjects: { [Id: string]: LinkedObject };

  /**
   * Create CusotmizationSet
   */
  constructor(
    name: string,
    options: { [p: string]: CustomizationSetOption },
    minSelection: number,
    maxSelection: number,
    displayOrder: number,
    preSelected: string[],
    linkedObjects: { [p: string]: LinkedObject },
    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: string,
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

  // eslint-disable-next-line class-methods-use-this
  collectionRef(businessId: string) {
    return CustomizationSet.collectionRef(businessId);
  }

  metaLinks(businessId: string): { [p: string]: string } {
    return {
      [Catalog.docRef(businessId).path]: `${Config.Paths.CollectionNames.customizationSets}.${this.Id}`,
    };
  }

  metadata(): CustomizationSetMeta {
    return {
      name: this.name,
      displayOrder: this.displayOrder,
    };
  }

  // STATICS THAT SHOULD BE IMPLEMENTED BY ALL FIRESTORE OBJECTS

  /**
     * CustomizationSet class CollectionReference for given business
     */
  static collectionRef(businessId: string): FirebaseFirestore.CollectionReference {
    return Catalog.docRef(businessId).collection(Config.Paths.CollectionNames.customizationSets);
  }

  /**
     * A converter used to convert object to and from firestore, any
     * '.data' returns an object can can simply be cast with 'as [type]'.
     * Used in conjunction with Firestore collection references or queries.
     */
  static firestoreConverter = {
    toFirestore(customizationSet: CustomizationSet): FirebaseFirestore.DocumentData {
      return {
        name: customizationSet.name,
        options: JSON.parse(JSON.stringify(customizationSet.options)),
        minSelection: customizationSet.minSelection,
        maxSelection: customizationSet.maxSelection,
        displayOrder: customizationSet.displayOrder,
        preSelected: customizationSet.preSelected,
        linkedObjects: JSON.parse(JSON.stringify(customizationSet.linkedObjects)),
        created: customizationSet.created.toISOString(),
        updated: customizationSet.updated.toISOString(),
        isDeleted: customizationSet.isDeleted,
      };
    },
    fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): CustomizationSet {
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
        snapshot.id,
      );
    },
  };
}

export interface CustomizationSetOption {
  name: string
  // The additional cost of the attribute as an integer in the smallest currency unit.
  price: number
  // Sorting order for display
  displayOrder: number
  linkedObjects: { [Id: string]: LinkedObject }
}
