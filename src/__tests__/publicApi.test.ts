import { describe, it, expect } from 'vitest';
import * as Lib from '../index';
import { createTestOrderInput } from '../domain/__tests__/helpers/OrderFixtures';

/**
 * Outbound-boundary tests for rcc#63 (P6 platform fee, Stage 0-1).
 *
 * These import through the package root barrel rather than the deep module
 * paths on purpose. square-gateway-claude#91 and #393 consume these two
 * symbols through the published entrypoint, so a symbol that exists in
 * `src/domain/utils/` but was never wired into `src/domain/index.ts` would
 * pass every deep-import test and still be unreachable for the consumer.
 * That is the failure this file exists to catch.
 */
describe('public API surface (#63)', () => {
  it('exposes Domain.Utils.roundHalfEven through the package root barrel', () => {
    expect(typeof Lib.Domain.Utils.roundHalfEven).toBe('function');
    // Callable AND correct — presence alone would not tell the consumer anything.
    expect(Lib.Domain.Utils.roundHalfEven(107.5)).toBe(108);
    expect(Lib.Domain.Utils.roundHalfEven(108.5)).toBe(108);
  });

  it('exposes Order.appFee through the package root barrel', () => {
    const order = Lib.Domain.Orders.createOrder(createTestOrderInput({ appFee: 34 }));
    expect(order.appFee).toBe(34);
  });

  it('leaves appFee absent on the root-barrel factory when it is not supplied', () => {
    const order = Lib.Domain.Orders.createOrder(createTestOrderInput());
    expect('appFee' in order).toBe(false);
  });
});

/**
 * Outbound-boundary tests for rcc#163 (P41 availability entries, contract rcc#162 §1).
 *
 * square-gateway-claude and businesses reach the entries repository as
 * `Domain.Services.*`, the path resolvers as `Persistence.PathResolver.*` and the
 * collection name as `Paths.CollectionNames.entries` — all through the published
 * root barrel. Same failure class as #63 above: a symbol that exists in its module
 * but never made it into `services/index.ts` would pass every deep-import test.
 */
describe('public API surface (#163)', () => {
  it('#163 exposes the entries repository through Domain.Services', () => {
    const services = Lib.Domain.Services;
    expect(typeof services.entryRef).toBe('function');
    expect(typeof services.isDefaultEntry).toBe('function');
    expect(typeof services.setEntry).toBe('function');
    expect(typeof services.setEntryCountGuarded).toBe('function');
    expect(typeof services.getEntries).toBe('function');
    expect(typeof services.deleteEntries).toBe('function');
    // Callable AND correct: the gateway#375 clause is the one a consumer is most likely to lean on.
    expect(services.isDefaultEntry({ kind: 'option', isInventoryTracked: false })).toBe(false);
    expect(services.isDefaultEntry({ kind: 'option' })).toBe(true);
    expect(services.GET_ENTRIES_CHUNK).toBe(100);
    expect(services.DELETE_ENTRIES_CHUNK).toBe(500);
    expect(services.ENTRY_WRITABLE_FIELDS).toContain('isInventoryTracked');
    expect(services.ENTRY_WRITABLE_FIELDS).not.toContain('isAvailable');
  });

  it('#163 exposes PathResolver.inventoryEntriesCollection/inventoryEntryDoc through Persistence', () => {
    // Presence only: resolving a ref would call getFirestore(), which needs an initialised app.
    expect(typeof Lib.Persistence.PathResolver.inventoryEntriesCollection).toBe('function');
    expect(typeof Lib.Persistence.PathResolver.inventoryEntryDoc).toBe('function');
  });

  it("#163 exposes Paths.CollectionNames.entries === 'entries'", () => {
    expect(Lib.Paths.CollectionNames.entries).toBe('entries');
  });
});
