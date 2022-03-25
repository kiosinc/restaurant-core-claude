import FirestoreObject from '../../firestore-core/core/FirestoreObject';
import * as Config from '../../firestore-core/config';
import Locations from '../roots/Locations';
import LocationMeta from './LocationMeta';
import Address from '../misc/Address';
import LinkedObject from '../../firestore-core/core/LinkedObject';

export default class Location extends FirestoreObject<string> {
  name: string;

  isActive: boolean;

  // isInventoryTracking: boolean;

  linkedObjects: { [Id: string]: LinkedObject };

  address: Address;

  isPrimary: boolean;

  dailyOrderCounter: number;

  constructor(
    name: string,
    isActive: boolean,
    linkedObjects: { [Id: string]: LinkedObject },
    address: Address,
    isPrimary?: boolean,
    dailyOrderCounter?: number,
    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: string,
  ) {
    super(created, updated, isDeleted, Id);

    this.name = name;
    this.isActive = isActive;
    this.linkedObjects = linkedObjects;
    this.address = address;
    this.isPrimary = isPrimary ?? false;
    this.dailyOrderCounter = dailyOrderCounter ?? 0;
  }

  // eslint-disable-next-line class-methods-use-this
  collectionRef(businessId: string) {
    return Location.collectionRef(businessId);
  }

  metaLinks(businessId: string): { [p: string]: string } {
    return {
      [Locations.docRef(businessId).path]: `${Config.Paths.CollectionNames.locations}.${this.Id}`,
    };
  }

  metadata(): LocationMeta {
    return {
      name: this.name,
      isActive: this.isActive,
    };
  }

  // STATICS

  static collectionRef(businessId: string): FirebaseFirestore.CollectionReference {
    return Locations.docRef(businessId).collection(Config.Paths.CollectionNames.locations);
  }

  static firestoreConverter = {
    toFirestore(location: Location): FirebaseFirestore.DocumentData {
      return {
        name: location.name,
        isActive: location.isActive,
        linkedObjects: JSON.parse(JSON.stringify(location.linkedObjects)),
        address: Address.firestoreConverter.toFirestore(location.address),
        isPrimary: location.isPrimary,
        dailyOrderCounter: location.dailyOrderCounter,
        created: location.created.toISOString(),
        updated: location.updated.toISOString(),
        isDeleted: location.isDeleted,
      };
    },
    fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): Location {
      const data = snapshot.data();

      return new Location(
        data.name,
        data.isActive,
        data.linkedObjects,
        data.address,
        data.isPrimary,
        data.dailyOrderCounter ?? 0,
        new Date(data.created),
        new Date(data.updated),
        data.isDeleted,
        snapshot.id,
      );
    },
  };

  static dailyOrderCounterFieldName = 'dailyOrderCounter';
}
