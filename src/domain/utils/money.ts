/**
 * Rounds a number to the nearest integer, breaking exact `.5` ties toward the
 * **even** integer ("banker's rounding"). Used for platform-fee math shared
 * with square-gateway-claude, where always rounding ties up would bias the
 * accumulated fee upward across many orders.
 *
 * This is deliberately **not** `Math.round`: `108.5` returns `108` here, where
 * `Math.round(108.5)` is `109`.
 *
 * The half-to-even rule holds symmetrically for negatives — they are
 * documented, not rejected:
 *
 * | in       | out  | in      | out    |
 * |----------|------|---------|--------|
 * | `107.5`  | `108`| `-0.5`  | `0`    |
 * | `108.5`  | `108`| `-1.5`  | `-2`   |
 * | `106.5`  | `106`| `-2.5`  | `-2`   |
 * | `34.5`   | `34` | `-106.5`| `-106` |
 * | `35.5`   | `36` | `-107.5`| `-108` |
 *
 * A tie that lands on zero returns `+0`, never `-0` (`Object.is(roundHalfEven(-0.5), 0)`
 * is `true`), so the result is safe to compare and to serialize.
 *
 * Every finite input returns an integer. Non-finite inputs pass through
 * unchanged (`NaN -> NaN`, `Infinity -> Infinity`, `-Infinity -> -Infinity`);
 * there is no guard, because the caller's own validation owns that case.
 */
export function roundHalfEven(n: number): number {
  const f = Math.floor(n);
  const diff = n - f;
  if (diff > 0.5) return f + 1;
  if (diff < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}
