/**
 * The legacy-RTDB dual-write migration gate, in its own module **so the `false` branch is
 * reachable in tests**.
 *
 * The constant is declared un-annotated, so its type is the literal `true`; a test cannot
 * flip it by assignment. Keeping it in a one-symbol module means a test can
 * `vi.mock('../dualWriteFlag', () => ({ isDualWriteLegacyNotification: false }))` and exercise
 * the dual-write-off path that req 6 requires to be covered. `WebhookClaim` re-exports the
 * symbol, so its name and import path are unchanged for every reader.
 *
 * @packageDocumentation
 */

/**
 * Internal migration gate for the legacy RTDB dual-write (req 6).
 *
 * While `true`, an `acquired` or `resumed` claim also writes the legacy
 * `EventNotification` node, so flipping the `useClaimLease` feature flag back off is a pure
 * flag flip: the legacy gate finds the node and skips the redelivery, with no data
 * restoration.
 *
 * Not exported from `src/index.ts` on purpose — consumers must not branch on it. Flip it to
 * `false`, then delete it along with the RTDB node in **rcc#167**.
 */
export const isDualWriteLegacyNotification = true;
