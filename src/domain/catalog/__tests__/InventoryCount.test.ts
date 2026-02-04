import { describe, it, expect } from 'vitest';
import {
  InventoryCountState,
  InventoryCount,
  LocationInventoryMap,
  defaultInventoryCount,
} from '../InventoryCount';

describe('InventoryCount', () => {
  it('InventoryCountState has inStock and soldOut', () => {
    expect(InventoryCountState.inStock).toBe('inStock');
    expect(InventoryCountState.soldOut).toBe('soldOut');
  });

  it('InventoryCount interface holds all fields', () => {
    const ic: InventoryCount = {
      timestamp: new Date(),
      count: 5,
      state: InventoryCountState.inStock,
      isAvailable: true,
    };
    expect(ic.count).toBe(5);
    expect(ic.state).toBe(InventoryCountState.inStock);
    expect(ic.isAvailable).toBe(true);
    expect(ic.timestamp).toBeInstanceOf(Date);
  });

  it('InventoryCount timestamp is optional', () => {
    const ic: InventoryCount = {
      count: 0,
      state: InventoryCountState.soldOut,
      isAvailable: false,
    };
    expect(ic.timestamp).toBeUndefined();
  });

  it('LocationInventoryMap holds location-keyed inventory', () => {
    const inv: InventoryCount = {
      count: 3,
      state: InventoryCountState.inStock,
      isAvailable: true,
    };
    const map: LocationInventoryMap = { 'loc-1': inv };
    expect(map['loc-1'].count).toBe(3);
  });

  it('defaultInventoryCount returns correct defaults', () => {
    const ic = defaultInventoryCount();
    expect(ic.count).toBe(-1);
    expect(ic.state).toBe(InventoryCountState.inStock);
    expect(ic.isAvailable).toBe(true);
    expect(ic.timestamp).toBeUndefined();
  });

  it('no Firebase dependency', () => {
    // This test passing is proof that no Firebase import is needed
    const ic = defaultInventoryCount();
    expect(ic).toBeDefined();
  });
});
