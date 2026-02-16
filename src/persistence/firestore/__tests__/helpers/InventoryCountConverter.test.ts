import { describe, it, expect } from 'vitest';
import {
  inventoryCountToFirestore,
  inventoryCountFromFirestore,
  locationInventoryToFirestore,
  locationInventoryFromFirestore,
} from '../../converters/inventoryCountHelper';
import { InventoryCountState, InventoryCount } from '../../../../domain/catalog/InventoryCount';

describe('InventoryCountConverter', () => {
  it('inventoryCountToFirestore serializes correctly', () => {
    const ic: InventoryCount = {
      count: 5,
      state: InventoryCountState.inStock,
      isAvailable: true,
    };
    const result = inventoryCountToFirestore(ic);
    expect(result.count).toBe(5);
    expect(result.state).toBe('instock');
    expect(result.isAvailable).toBe(true);
  });

  it('inventoryCountToFirestore maps inStock to instock', () => {
    const ic: InventoryCount = { count: 1, state: InventoryCountState.inStock, isAvailable: true };
    expect(inventoryCountToFirestore(ic).state).toBe('instock');
  });

  it('inventoryCountToFirestore maps soldOut to soldout', () => {
    const ic: InventoryCount = { count: 0, state: InventoryCountState.soldOut, isAvailable: false };
    expect(inventoryCountToFirestore(ic).state).toBe('soldout');
  });

  it('inventoryCountToFirestore includes timestamp as ISO string', () => {
    const ts = new Date('2024-06-01T12:00:00Z');
    const ic: InventoryCount = { count: 1, state: InventoryCountState.inStock, isAvailable: true, timestamp: ts };
    const result = inventoryCountToFirestore(ic);
    expect(result.timestamp).toBe('2024-06-01T12:00:00.000Z');
  });

  it('inventoryCountToFirestore omits timestamp when undefined', () => {
    const ic: InventoryCount = { count: 1, state: InventoryCountState.inStock, isAvailable: true };
    const result = inventoryCountToFirestore(ic);
    expect(result.timestamp).toBeUndefined();
  });

  it('inventoryCountFromFirestore deserializes correctly', () => {
    const data = { count: 5, state: 'instock', isAvailable: true, timestamp: '2024-06-01T12:00:00.000Z' };
    const result = inventoryCountFromFirestore(data);
    expect(result.count).toBe(5);
    expect(result.state).toBe(InventoryCountState.inStock);
    expect(result.isAvailable).toBe(true);
    expect(result.timestamp).toEqual(new Date('2024-06-01T12:00:00.000Z'));
  });

  it('inventoryCountFromFirestore maps instock to inStock', () => {
    const data = { count: 1, state: 'instock', isAvailable: true };
    expect(inventoryCountFromFirestore(data).state).toBe(InventoryCountState.inStock);
  });

  it('inventoryCountFromFirestore maps soldout to soldOut', () => {
    const data = { count: 0, state: 'soldout', isAvailable: false };
    expect(inventoryCountFromFirestore(data).state).toBe(InventoryCountState.soldOut);
  });

  it('inventoryCountFromFirestore returns default on null', () => {
    const result = inventoryCountFromFirestore(null);
    expect(result.count).toBe(-1);
    expect(result.state).toBe(InventoryCountState.inStock);
    expect(result.isAvailable).toBe(true);
  });

  it('locationInventoryToFirestore iterates all locations', () => {
    const map = {
      'loc-1': { count: 5, state: InventoryCountState.inStock, isAvailable: true } as InventoryCount,
      'loc-2': { count: 0, state: InventoryCountState.soldOut, isAvailable: false } as InventoryCount,
    };
    const result = locationInventoryToFirestore(map);
    expect(result['loc-1']).toBeDefined();
    expect(result['loc-2']).toBeDefined();
    expect((result['loc-1'] as any).state).toBe('instock');
    expect((result['loc-2'] as any).state).toBe('soldout');
  });

  it('locationInventoryFromFirestore iterates all locations', () => {
    const data = {
      'loc-1': { count: 5, state: 'instock', isAvailable: true },
      'loc-2': { count: 0, state: 'soldout', isAvailable: false },
    };
    const result = locationInventoryFromFirestore(data);
    expect(result['loc-1'].state).toBe(InventoryCountState.inStock);
    expect(result['loc-2'].state).toBe(InventoryCountState.soldOut);
  });

  it('locationInventoryFromFirestore returns {} on null', () => {
    const result = locationInventoryFromFirestore(null);
    expect(result).toEqual({});
  });
});
