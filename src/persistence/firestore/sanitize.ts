/**
 * Recursively drops every key whose value is `undefined` — the one shape Firestore rejects outright
 * unless the consumer has enabled `ignoreUndefinedProperties`. A missing key is fine; an `undefined`
 * one is not.
 *
 * The topology, because it is the opposite of what it looks like: businesses, childs and
 * webhook-receiver never instantiate `FirestoreRepository`. They reach Firestore through
 * `.withConverter()` and a thin adapter (`src/utils/firestoreAdapter.ts` in each) that calls
 * `config.toFirestore(entity)` directly, and none of them set `ignoreUndefinedProperties` — so
 * converter output lands in Firestore exactly as produced. square-gateway-claude is the only service
 * that instantiates the repository, and it is also the only one setting `ignoreUndefinedProperties:
 * true`. The services that would be killed by an `undefined` are precisely the ones the repository's
 * `JSON.parse(JSON.stringify(…))` round-trip (#97) never protected.
 *
 * As of #204 `converterFactory.toFirestore` strips, so every converter-derived write is covered at
 * the serialization boundary itself; `FirestoreRepository.set()` / `.update()`'s round-trip is now a
 * second scrub on top of that rather than the only one. Exception: `tokenConverter` is hand-written
 * and does not go through `createConverter`, so it is outside that boundary.
 *
 * Calling this explicitly is still required for raw writes whose payload is *not* converter output —
 * the metadata fan-out in `FirestoreRepository`, cascade `fieldsToSet`, hand-built availability and
 * feature-list payloads. Those bypass `toFirestore` entirely, which is how #199
 * (`MenuRebuildService`'s `version`) and kiosinc/businesses#397 (`productMeta`'s
 * `dietaryPreferences`/`allergens`) each reached production. See #200 and #204.
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
  return strip(value, '', new WeakSet()) as T;
}

/** The only two shapes `strip` traverses, and therefore the only ones that can close a cycle. */
type Container = Record<string, unknown> | unknown[];

/**
 * `ancestors` holds the containers on the *current* recursion path only — added on entry, removed on
 * exit — so a value reached twice as siblings (a DAG, which serializes fine) is not mistaken for a
 * cycle. Without the guard a self-referential payload recursed until `RangeError: Maximum call stack
 * size exceeded`, which names neither the field nor the cause; `path` exists so the thrown message
 * can, using the same `<root>` convention as the `undefinedPaths` test helper.
 */
function strip(value: unknown, path: string, ancestors: WeakSet<Container>): unknown {
  const isArray = Array.isArray(value);
  if (!isArray && !isPlainObject(value)) return value;

  const container = value as Container;
  if (ancestors.has(container)) {
    throw new Error(`stripUndefined: circular reference at ${path || '<root>'}`);
  }
  ancestors.add(container);
  try {
    if (isArray) {
      return (value as unknown[]).map((entry, i) => strip(entry, `${path}[${i}]`, ancestors));
    }
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(container as Record<string, unknown>)) {
      if (entry !== undefined) result[key] = strip(entry, path ? `${path}.${key}` : key, ancestors);
    }
    return result;
  } finally {
    ancestors.delete(container);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
