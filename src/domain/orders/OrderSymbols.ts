export enum OrderType {
  none = 'none',
  toGo = 'toGo',
  dineIn = 'dineIn',
}

export interface OrderTypeMeta {
  table?: string,
}

export const enum OrderState {
  open = 'open',
  new = 'new',
  inProgress = 'inProgress',
  ready = 'ready',
  completed = 'completed',
  cancelled = 'cancelled',
}

export const enum PaymentState {
  none = 'none',
  approved = 'approved',
  pending = 'pending',
  completed = 'completed',
  cancelled = 'cancelled',
  failed = 'failed',
}
