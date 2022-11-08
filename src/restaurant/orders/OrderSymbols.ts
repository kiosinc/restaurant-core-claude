export const enum OrderType {
  none = 'none',
  togo = 'togo',
  dinein = 'dinein',
}

export interface OrderTypeMeta {
  table?: string,
}

export const enum OrderState {
  // Orders that are open
  open = 'open',
  // Orders awaiting action (new) that haven't been processed yet
  new = 'new',
  // Orders being prepared.
  inProgress = 'inProgress',
  // All orders ready for fulfillment
  ready = 'ready',
  // Orders that have been fulfilled
  completed = 'completed',
  // Orders that have been cancelled
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
