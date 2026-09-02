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
