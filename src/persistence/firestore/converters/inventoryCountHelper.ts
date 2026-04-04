import { InventoryCount, InventoryCountState, LocationInventoryMap, defaultInventoryCount }
  from '../../../domain/catalog/InventoryCount';
import { toDateSafe } from './baseFields';

/** Firestore-persisted state values (lowercase, no camelCase). */
const InventoryCountFirestoreState = {
  inStock: 'instock',
  soldOut: 'soldout',
} as const;

export function inventoryCountToFirestore(inventory: InventoryCount): FirebaseFirestore.DocumentData {
  const data: Record<string, unknown> = {
    count: inventory.count,
    state: inventory.state === InventoryCountState.inStock ? InventoryCountFirestoreState.inStock : InventoryCountFirestoreState.soldOut,
    isAvailable: inventory.isAvailable,
  };
  if (inventory.timestamp) {
    data.timestamp = inventory.timestamp.toISOString();
  }
  return data;
}

export function inventoryCountFromFirestore(data: FirebaseFirestore.DocumentData): InventoryCount {
  if (!data) return defaultInventoryCount();
  return {
    count: data.count ?? -1,
    state: data.state === InventoryCountFirestoreState.soldOut ? InventoryCountState.soldOut : InventoryCountState.inStock,
    isAvailable: data.isAvailable ?? true,
    timestamp: data.timestamp ? toDateSafe(data.timestamp) : undefined,
  };
}

export function locationInventoryToFirestore(
  locationInventory: LocationInventoryMap,
): FirebaseFirestore.DocumentData {
  const result: Record<string, unknown> = {};
  for (const [locationId, inventory] of Object.entries(locationInventory)) {
    result[locationId] = inventoryCountToFirestore(inventory);
  }
  return result;
}

export function locationInventoryFromFirestore(
  data: FirebaseFirestore.DocumentData,
): LocationInventoryMap {
  if (!data) return {};
  const result: LocationInventoryMap = {};
  for (const [locationId, inventoryData] of Object.entries(data)) {
    result[locationId] = inventoryCountFromFirestore(inventoryData);
  }
  return result;
}
