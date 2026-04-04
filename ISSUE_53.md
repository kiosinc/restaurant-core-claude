# Issue #53: Add heartbeat/TTL fields to SemaphoreV2 lock document

## Overview

Extend `SemaphoreV2` to support heartbeat-based TTL expiry directly on the semaphore document. The lock becomes self-describing: it stores when it was last heartbeated, when it expires, the TTL duration, and a trace ID linking it to the sync operation.

## Document Schema Changes

`semaphores/{businessId}_{type}` gains optional fields:

| Field | Type | When set | When cleared |
|---|---|---|---|
| `lastHeartbeat` | `Timestamp` (server) | `lock()` with options, `updateHeartbeat()` | `release()`, `forceRelease()` |
| `expiresAt` | `Timestamp` (computed) | `lock()` with options, `updateHeartbeat()` | `release()`, `forceRelease()` |
| `heartbeatTtlMs` | `number` | `lock()` with options | `release()`, `forceRelease()` |
| `syncTraceId` | `string` | `lock()` with options, `updateHeartbeat()` | `release()`, `forceRelease()` |

Without options, `lock()` behaves identically to today.

## Implementation

### 1. `SemaphoreV2.ts` — Add `LockOptions` interface

```typescript
export interface LockOptions {
  heartbeatTtlMs?: number;
  syncTraceId?: string;
}
```

### 2. Extend constructor and instance properties

Add optional: `lastHeartbeat?: Date`, `expiresAt?: Date`, `heartbeatTtlMs?: number`, `syncTraceId?: string`.

### 3. Extend `lock()` signature

```typescript
static async lock(businessId: string, type: string, options?: LockOptions): Promise<boolean>
```

When `options?.heartbeatTtlMs` provided, add to write data:
- `lastHeartbeat = FieldValue.serverTimestamp()`
- `expiresAt = new Date(Date.now() + heartbeatTtlMs)`
- `heartbeatTtlMs = options.heartbeatTtlMs`

When `options?.syncTraceId` provided, add `syncTraceId`.

### 4. Update `release()` to clear heartbeat fields

Add `FieldValue.delete()` for `lastHeartbeat`, `expiresAt`, `heartbeatTtlMs`, `syncTraceId`.

### 5. Add `updateHeartbeat()`

```typescript
static async updateHeartbeat(businessId: string, type: string, syncTraceId: string): Promise<boolean>
```

- Transaction: read doc
- Return `false` if: doc doesn't exist, `isAvailable === true`, no `heartbeatTtlMs`, or `syncTraceId` doesn't match
- Write: `lastHeartbeat = serverTimestamp()`, `expiresAt = new Date(now + heartbeatTtlMs)`, `updated = serverTimestamp()`, `syncTraceId`
- Return `true`

### 6. Add `isExpired()`

```typescript
static async isExpired(businessId: string, type: string): Promise<boolean>
```

- Plain read (no transaction)
- Return `false` if: doc doesn't exist, `isAvailable === true`, no `expiresAt`
- Return `expiresAt.toDate() < new Date()`

### 7. Add `forceRelease()`

```typescript
static async forceRelease(businessId: string, type: string): Promise<boolean>
```

- Transaction: read doc
- Return `false` if doc doesn't exist
- Write: `isAvailable = true`, `updated = serverTimestamp()`, clear all heartbeat fields with `FieldValue.delete()`
- Always writes regardless of current `isAvailable` state (unlike `release()`)

### 8. Update `firestoreConverter`

Handle optional heartbeat fields in both `toFirestore` and `fromFirestore`.

### 9. Update `src/index.ts`

Export `LockOptions` type alongside `SemaphoreV2`.

## Test Plan

File: `src/restaurant/vars/__tests__/SemaphoreV2.test.ts`

### lock() with options
- `lock() writes heartbeat fields when options.heartbeatTtlMs is provided`
- `lock() omits heartbeat fields when no options provided` (regression)
- `lock() writes syncTraceId even without heartbeatTtlMs`

### updateHeartbeat()
- `updateHeartbeat() extends expiresAt on active lock with matching traceId`
- `updateHeartbeat() returns false when doc does not exist`
- `updateHeartbeat() returns false when lock is available`
- `updateHeartbeat() returns false when no heartbeatTtlMs on doc`
- `updateHeartbeat() returns false when syncTraceId does not match`

### isExpired()
- `isExpired() returns true when expiresAt is in the past`
- `isExpired() returns false when expiresAt is in the future`
- `isExpired() returns false when doc does not exist`
- `isExpired() returns false when lock is available`
- `isExpired() returns false when expiresAt is not set`

### forceRelease()
- `forceRelease() clears all heartbeat fields and sets isAvailable to true`
- `forceRelease() releases even when lock is already available`
- `forceRelease() returns false when doc does not exist`

### release() regression
- `release() clears heartbeat fields when releasing a lock`

### firestoreConverter
- `firestoreConverter round-trips heartbeat fields`
- `firestoreConverter handles missing heartbeat fields gracefully`

## Implementation Sequence

1. Extend constructor + instance properties
2. Update firestoreConverter
3. Extend lock() with options
4. Update release() to clear heartbeat fields
5. Implement updateHeartbeat()
6. Implement isExpired()
7. Implement forceRelease()
8. Update index.ts export
9. Write all tests
10. Run type check + test suite

## Manual Verification

1. `npm test` — all tests pass
2. `npx tsc --noEmit` — no type errors
3. Calling `lock()` without options still works identically to today
