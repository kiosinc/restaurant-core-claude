import { describe, it, expect } from 'vitest';
import {
  OrderType,
  OrderState,
  PaymentState,
  OrderTypeMeta,
} from '../OrderSymbols';

describe('OrderSymbols', () => {
  it('OrderType has expected values', () => {
    expect(OrderType.none).toBe('none');
    expect(OrderType.toGo).toBe('toGo');
    expect(OrderType.dineIn).toBe('dineIn');
  });

  it('OrderState has expected values', () => {
    expect(OrderState.open as string).toBe('open');
    expect(OrderState.new as string).toBe('new');
    expect(OrderState.inProgress as string).toBe('inProgress');
    expect(OrderState.ready as string).toBe('ready');
    expect(OrderState.completed as string).toBe('completed');
    expect(OrderState.cancelled as string).toBe('cancelled');
  });

  it('PaymentState has expected values', () => {
    expect(PaymentState.none as string).toBe('none');
    expect(PaymentState.approved as string).toBe('approved');
    expect(PaymentState.pending as string).toBe('pending');
    expect(PaymentState.completed as string).toBe('completed');
    expect(PaymentState.cancelled as string).toBe('cancelled');
    expect(PaymentState.failed as string).toBe('failed');
  });

  it('OrderTypeMeta shape works', () => {
    const meta: OrderTypeMeta = { table: 'A1' };
    expect(meta.table).toBe('A1');

    const emptyMeta: OrderTypeMeta = {};
    expect(emptyMeta.table).toBeUndefined();
  });
});
