// Domain layer — pure models
export * as Domain from './domain';

// Persistence layer — repositories, registries, path resolver
export * as Persistence from './persistence';

// Infrastructure — Firestore path constants & enums
export * as Paths from './firestore-core/Paths';
export * as Constants from './firestore-core/Constants';
export { default as DistributedCounter } from './firestore-core/core/DistributedCounter';

// Auth & User — unchanged
export * as Authentication from './user/Authentication';
export * as Claims from './user/Claims';
export * as User from './user/User';

// Imaging — image overlay interfaces & derivative-size contract
export * as Imaging from './imaging';

// Utils — unchanged
export * as Utils from './utils';

// Reports — unchanged
export * as Reports from './reports';

// RTDB modules — not migrated, kept as-is
export { default as EventNotification } from './restaurant/connected-accounts/EventNotification';

// Firestore-based distributed lock
export { default as SemaphoreV2 } from './restaurant/vars/SemaphoreV2';
export type { LockOptions } from './restaurant/vars/SemaphoreV2';

// P42 webhook claim/lease/fence primitive — webhookClaims/{eventId} (rcc#166, contract rcc#165).
// The contract, including the `writeLegacyEventNotification` dual-write gate, is in the module.
export {
  acquireClaim,
  advancePhase,
  completeClaim,
  releaseClaim,
  failClaim,
  withClaimFence,
  completeClaimIn,
  matchAcquireResult,
  claimIdempotencyKey,
  InvalidEventIdError,
  StaleLeaseError,
  EventTooOldError,
  DEFAULT_LEASE_MS,
  CLAIM_TTL_MS,
  MAX_EVENT_AGE_MS,
  INITIAL_PHASE,
  EVENT_ID_PATTERN,
} from './restaurant/webhooks/WebhookClaim';
export type {
  WebhookClaim,
  ClaimStatus,
  AcquireResult,
  AcquireClaimInput,
  AcquireHandlers,
  ClaimFence,
} from './restaurant/webhooks/WebhookClaim';
