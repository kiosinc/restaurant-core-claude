/**
 * OptionSet class
 * @deprecated Use Domain.Catalog.OptionSet instead.
 */
import { FirestoreObject } from '../../firestore-core'
import LinkedObject from '../../firestore-core/core/LinkedObject'
import Catalog from '../roots/Catalog'
import OptionMeta from './OptionMeta'
import {
  InventoryCount,
  LocationInventoryFromFirestore,
  LocationInventoryToFirestore,
} from './InventoryCount'
import OptionSetMeta from './OptionSetMeta'
import * as Paths from '../../firestore-core/Paths'

export interface OptionSetSelection {
  minSelection: number
  maxSelection: number
  preSelected: string[]
  isActive: boolean // TODO Delete or revise- this is actually isEnabledOnItem flag;
  // or can remove if sync disregards adding
  // It's only worth keeping this flag if you want to preserve
  // the override functionality- no if ubiquitous set selections apply
}

export default class OptionSet extends FirestoreObject {
  name: string;

  options: { [Id: string]: OptionMeta };

  minSelection: number;

  maxSelection: number;

  displayOrder: number;

  displayTier: number;

  optionDisplayOrder: string[];

  preselectedOptionIds: string[];

  // -- Deprecate
  imageUrls: URL[];

  imageGsls: URL[]

  locationInventory: { [p: string]: InventoryCount };

  isActive: boolean;

  linkedObjects: { [Id: string]: LinkedObject };

  /**
   * Create OptionSet
   */
  constructor(
    name: string,
    options: { [p: string]: OptionMeta },
    minSelection: number,
    maxSelection: number,
    displayOrder: number,
    displayTier: number,
    optionDisplayOrder: string[],
    preselectedOptionIds: string[],
    imageUrls: URL[],
    imageGsls: URL[],
    locationInventory: { [p: string]: InventoryCount },
    isActive: boolean,
    linkedObjects: { [p: string]: LinkedObject },
    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: string,
  ) {
    super({created, updated, isDeleted, Id});

    this.name = name;
    this.options = options;
    this.minSelection = minSelection;
    this.maxSelection = maxSelection;

    this.displayOrder = displayOrder;
    this.displayTier = displayTier;
    this.optionDisplayOrder = optionDisplayOrder;
    this.preselectedOptionIds = preselectedOptionIds;
    this.imageUrls = imageUrls;
    this.imageGsls = imageGsls
    this.locationInventory = locationInventory;
    this.isActive = isActive;
    this.linkedObjects = linkedObjects;
  }

  // eslint-disable-next-line class-methods-use-this
  collectionRef(businessId: string) {
    return OptionSet.collectionRef(businessId);
  }

  // eslint-disable-next-line class-methods-use-this
  metaLinks(): { [p: string]: string } {
    return {};
  }

  metadata(): OptionSetMeta {
    return {
      name: this.name,
      displayOrder: this.displayOrder,
      displayTier: this.displayTier,
    };
  }

  // STATICS THAT SHOULD BE IMPLEMENTED BY ALL FIRESTORE OBJECTS

  /**
     * OptionSet class CollectionReference for given business
     */
  static collectionRef(businessId: string): FirebaseFirestore.CollectionReference {
    return Catalog.docRef(businessId).collection(Paths.CollectionNames.optionSets);
  }

  /**
     * A converter used to convert object to and from firestore, any
     * '.data' returns an object can can simply be cast with 'as [type]'.
     * Used in conjunction with Firestore collection references or queries.
     */
  static firestoreConverter = {
    toFirestore(optionSet: OptionSet): FirebaseFirestore.DocumentData {
      return {
        name: optionSet.name,
        options: JSON.parse(JSON.stringify(optionSet.options)),
        minSelection: optionSet.minSelection,
        maxSelection: optionSet.maxSelection,
        displayOrder: optionSet.displayOrder,
        displayTier: optionSet.displayTier,
        optionDisplayOrder: JSON.parse(JSON.stringify(optionSet.optionDisplayOrder)),
        preselectedOptionIds: JSON.parse(JSON.stringify(optionSet.preselectedOptionIds)),
        imageUrls: JSON.parse(JSON.stringify(optionSet.imageUrls)),
        imageGsls: JSON.parse(JSON.stringify(optionSet.imageGsls)),
        locationInventory: JSON.parse(JSON.stringify(
          LocationInventoryToFirestore(optionSet.locationInventory),
        )),
        isActive: optionSet.isActive,
        linkedObjects: JSON.parse(JSON.stringify(optionSet.linkedObjects)),
        created: optionSet.created.toISOString(),
        updated: optionSet.updated.toISOString(),
        isDeleted: optionSet.isDeleted,
      };
    },
    fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): OptionSet {
      const data = snapshot.data();

      return new OptionSet(
        data.name,
        data.options,
        data.minSelection,
        data.maxSelection,
        data.displayOrder,
        data.displayTier,
        data.optionDisplayOrder ?? [],
        data.preselectedOptionIds ?? [],
        data.imageUrls ?? [],
        data.imageGsls ?? [],
        LocationInventoryFromFirestore(data.locationInventory),
        data.isActive,
        data.linkedObjects,
        new Date(data.created),
        new Date(data.updated),
        data.isDeleted,
        snapshot.id,
      );
    },
  };
}
