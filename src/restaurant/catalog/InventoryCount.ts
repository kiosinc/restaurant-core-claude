// import FirestoreObject from '../../firestore-core/core/FirestoreObject';
// import { Business } from './Business';
// import * as Config from '../../firestore-core/config';

// const inventoryKey = Config.Paths.CollectionNames.locationInventory;

// TODO change to camel case
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
