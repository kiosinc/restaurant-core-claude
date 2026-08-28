/**
 * Recursively drops every key whose value is `undefined`.
 *
 * `FirestoreRepository.set()` / `.update()` already get this from their `JSON.parse(JSON.stringify(…))`
 * round-trip, and it is that round-trip's load-bearing job (#97): businesses, childs and
 * webhook-receiver all consume the repository through their `firestoreAdapter.ts` and none of them
 * enable `ignoreUndefinedProperties`, so Firestore rejects an explicit `undefined` outright. A
 * missing key is fine; an `undefined` one is not.
 *
 * Raw writes — `transaction.set`, `batch.update` — bypass the repository and therefore bypass that
 * guarantee, which is how #199 (`MenuRebuildService`'s `version`) and kiosinc/businesses#397
 * (`productMeta`'s `dietaryPreferences`/`allergens`) each reached production. Call this immediately
 * before such a write to opt back into it. See #200.
 *
 * Two properties worth being explicit about:
 *  - Only arrays and plain objects are traversed. A `Date`, a Firestore `Timestamp` or a
 *    `FieldValue` sentinel is returned by reference, because rebuilding one from its entries would
 *    destroy it.
 *  - Array elements are mapped, not filtered: dropping an `undefined` element would silently shift
 *    every index after it, which is worse than the rejected write. Callers that can produce holey
 *    arrays should filter before writing.
 *
 * This is deliberately only the `undefined`-stripping half of #97's `sanitizeForFirestore`. The
 * Date/Timestamp-preserving half — replacing the repository's round-trip — belongs to P22.
 */
export function stripUndefined<T>(value: T): T {
  return strip(value) as T;
}

function strip(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(strip);
  if (!isPlainObject(value)) return value;

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) result[key] = strip(entry);
  }
  return result;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
