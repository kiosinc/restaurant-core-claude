import { describe, it, expect } from 'vitest';
import { OrderType, OrderState, PaymentState } from '../OrderSymbols';
import {
  OrderType as DomainOrderType,
  OrderState as DomainOrderState,
  PaymentState as DomainPaymentState,
} from '../../../domain/orders/OrderSymbols';

describe('OrderSymbols backward compatibility', () => {
  it('old import path re-exports OrderType', () => {
    expect(OrderType.none).toBe('none');
    expect(OrderType.toGo).toBe('toGo');
    expect(OrderType.dineIn).toBe('dineIn');
    expect(OrderType).toBe(DomainOrderType);
  });

  it('old import path re-exports OrderState', () => {
    expect(OrderState.open as string).toBe(DomainOrderState.open as string);
    expect(OrderState.new as string).toBe(DomainOrderState.new as string);
    expect(OrderState.completed as string).toBe(DomainOrderState.completed as string);
  });

  it('old import path re-exports PaymentState', () => {
    expect(PaymentState.none as string).toBe(DomainPaymentState.none as string);
    expect(PaymentState.approved as string).toBe(DomainPaymentState.approved as string);
    expect(PaymentState.completed as string).toBe(DomainPaymentState.completed as string);
  });
});
