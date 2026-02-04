import { InventoryCount, InventoryCountState, LocationInventoryMap, defaultInventoryCount }
  from '../../../domain/catalog/InventoryCount';

export function inventoryCountToFirestore(inventory: InventoryCount): FirebaseFirestore.DocumentData {
  const data: Record<string, unknown> = {
    count: inventory.count,
    state: inventory.state === InventoryCountState.inStock ? 'instock' : 'soldout',
    isAvailable: inventory.isAvailable,
  };
  if (inventory.timestamp) {
    data.timestamp = inventory.timestamp.toISOString();
  }
  return data;
}

export function inventoryCountFromFirestore(data: any): InventoryCount {
  if (!data) return defaultInventoryCount();
  return {
    count: data.count ?? -1,
    state: data.state === 'soldout' ? InventoryCountState.soldOut : InventoryCountState.inStock,
    isAvailable: data.isAvailable ?? true,
    timestamp: data.timestamp ? new Date(data.timestamp) : undefined,
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
  data: any,
): LocationInventoryMap {
  if (!data) return {};
  const result: LocationInventoryMap = {};
  for (const [locationId, inventoryData] of Object.entries(data)) {
    result[locationId] = inventoryCountFromFirestore(inventoryData);
  }
  return result;
}
