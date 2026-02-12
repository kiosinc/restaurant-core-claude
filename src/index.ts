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

// Utils — unchanged
export * as Utils from './utils';

// Reports — unchanged
export * as Reports from './reports';

// RTDB modules — not migrated, kept as-is
export { default as EventNotification } from './restaurant/connected-accounts/EventNotification';
export { default as SemaphoreV2 } from './restaurant/vars/SemaphoreV2';
