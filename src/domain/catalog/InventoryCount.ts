/**
 * Stock state for a product/option at a location.
 */
export enum InventoryCountState {
  inStock = 'inStock',
  soldOut = 'soldOut',
}

/**
 * Inventory tracking for a single location.
 */
export interface InventoryCount {
  timestamp?: Date;
  count: number;
  state: InventoryCountState;
  isAvailable: boolean;
}

/**
 * Map of locationId to inventory data.
 * Used by Product, Option, and OptionSet.
 */
export type LocationInventoryMap = { [locationId: string]: InventoryCount };

/**
 * Returns a default InventoryCount (available, unlimited stock).
 */
export function defaultInventoryCount(): InventoryCount {
  return { count: -1, state: InventoryCountState.inStock, isAvailable: true };
}
