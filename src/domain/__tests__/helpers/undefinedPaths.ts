/**
 * Every path under `value` whose value is `undefined` — exactly the condition Firestore rejects
 * when `ignoreUndefinedProperties` is off, which is how businesses, childs and webhook-receiver
 * all configure it.
 *
 * Returns paths rather than a boolean so a failing assertion names the offending field instead of
 * reporting only that one exists. See #200.
 */
export function undefinedPaths(value: unknown, prefix = ''): string[] {
  if (value === undefined) return [prefix || '<root>'];
  if (value === null || typeof value !== 'object') return [];
  if (Array.isArray(value)) {
    return value.flatMap((entry, i) => undefinedPaths(entry, `${prefix}[${i}]`));
  }
  // Only plain objects are traversed: a Date or a Firestore Timestamp has no own enumerable
  // entries, so recursing into one would report nothing and cost a walk.
  if (Object.getPrototypeOf(value) !== Object.prototype) return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) =>
    undefinedPaths(entry, prefix ? `${prefix}.${key}` : key),
  );
}
