// import FirestoreObject from '../../firestore-core/core/FirestoreObject';
// import { Business } from './Business';
// import * as Config from '../../firestore-core/config';

// const inventoryKey = Config.Paths.CollectionNames.locationInventory;

export const enum InventoryCountState {
  instock = 'instock',
  soldout = 'soldout',
}

export interface InventoryCount {
  timestamp?: Date,
  count: number,
  state: InventoryCountState,
  isAvailable: boolean // Is it offered at the location
}

function InventoryCountToFirestore(inventory: InventoryCount)
  : FirebaseFirestore.DocumentData {
  const data: FirebaseFirestore.DocumentData = {
    count: inventory.count,
    state: inventory.state,
    isAvailable: inventory.isAvailable,
  };

  if (inventory.timestamp) {
    data.timestamp = inventory.timestamp.toISOString();
  }

  return data;
}

function InventoryCountFromFirestore(data: any): InventoryCount {
  if (data) {
    return {
      timestamp: data.timestamp ? new Date(data.timestamp) : undefined,
      count: data.count,
      state: data.state,
      isAvailable: data.isAvailable,
    };
  }
  return {
    count: -1,
    state: InventoryCountState.instock,
    isAvailable: true,
  };
}

export function LocationInventoryToFirestore(locationInventory:
{ [locationId: string]: InventoryCount })
  : FirebaseFirestore.DocumentData {
  const result: any = {};
  Object.entries(locationInventory).forEach((value) => {
    result[value[0]] = InventoryCountToFirestore(value[1]);
  });

  return result;
}

export function LocationInventoryFromFirestore(data: any)
  : { [locationId: string]: InventoryCount } {
  if (data) {
    const result: { [locationId: string]: InventoryCount } = {};
    Object.entries(data).forEach((value) => {
      result[value[0]] = InventoryCountFromFirestore(value[1]);
    });
    return result;
  }
  return {};
}

// export class LocationInventory extends FirestoreObject<string> {
//   locationCounts: { [locationId: string]: { [Id: string]: InventoryCount } };
//
//   constructor(
//     locationCount: { [Id: string]: { [Id: string]: InventoryCount } },
//
//     created?: Date,
//     updated?: Date,
//     isDeleted?: boolean,
//     Id?: string,
//   ) {
//     super(created, updated, isDeleted, Id ?? inventoryKey);
//
//     this.locationCounts = locationCount;
//   }
//
//   // eslint-disable-next-line class-methods-use-this
//   collectionRef(businessId: string): FirebaseFirestore.CollectionReference {
//     return Business.publicCollectionRef(businessId);
//   }
//
//   // eslint-disable-next-line class-methods-use-this
//   metaLinks(): { [p: string]: string } {
//     return {};
//   }
//
//   // eslint-disable-next-line class-methods-use-this
//   metadata(): {} {
//     return {};
//   }
//
//   // STATICS
//
//   static docRef(businessId: string) : FirebaseFirestore.DocumentReference {
//     return Business.publicCollectionRef(businessId).doc(inventoryKey);
//   }
//
//   static firestoreConverter = {
//     toFirestore(inventory: LocationInventory): FirebaseFirestore.DocumentData {
//       return {
//         locationCounts: JSON.parse(JSON.stringify(inventory.locationCounts)),
//         created: inventory.created.toISOString(),
//         updated: inventory.updated.toISOString(),
//         isDeleted: inventory.isDeleted,
//       };
//     },
//     fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): LocationInventory {
//       const data = snapshot.data();
//
//       return new LocationInventory(
//         data.locationCounts,
//         new Date(data.created),
//         new Date(data.updated),
//         data.isDeleted,
//         snapshot.id,
//       );
//     },
//   };
// }
