import { describe, it, expect } from 'vitest';
import { roundHalfEven } from '../money';

describe('roundHalfEven', () => {
  it.each([
    [107.5, 108],
    [108.5, 108],
    [106.5, 106],
    [34.5, 34],
    [35.5, 36],
    [0.4, 0],
    [0.6, 1],
  ])('rounds the acceptance-criteria table: %s -> %s', (input, expected) => {
    expect(roundHalfEven(input)).toBe(expected);
  });

  it('returns finite integers unchanged', () => {
    expect(roundHalfEven(0)).toBe(0);
    expect(roundHalfEven(5)).toBe(5);
    expect(roundHalfEven(108)).toBe(108);
  });

  it('breaks .5 ties toward the even integer', () => {
    expect(roundHalfEven(0.5)).toBe(0);
    expect(roundHalfEven(1.5)).toBe(2);
    expect(roundHalfEven(2.5)).toBe(2);
    expect(roundHalfEven(3.5)).toBe(4);
  });

  it('applies the same half-to-even rule to negatives (documented, not rejected)', () => {
    expect(roundHalfEven(-0.4)).toBe(0);
    expect(roundHalfEven(-0.5)).toBe(0);
    expect(roundHalfEven(-0.6)).toBe(-1);
    expect(roundHalfEven(-1.5)).toBe(-2);
    expect(roundHalfEven(-2.5)).toBe(-2);
    expect(roundHalfEven(-106.5)).toBe(-106);
    expect(roundHalfEven(-107.5)).toBe(-108);
  });

  // `toBe(0)` alone would pass for -0. A -0 fee would compare and serialize surprisingly
  // downstream, so assert the sign explicitly.
  it('returns +0, not -0, for a tie that lands on zero', () => {
    expect(Object.is(roundHalfEven(-0.5), 0)).toBe(true);
  });

  // Anti-tautology guard: Math.round agrees with half-to-even on most of the table above
  // (107.5, 35.5, 0.4, 0.6), so a lazy `Math.round` reimplementation would pass it. These two
  // inputs are where the rules diverge, and they are the reason this helper exists at all.
  it('is not Math.round', () => {
    expect(roundHalfEven(108.5)).not.toBe(Math.round(108.5));
    expect(roundHalfEven(-107.5)).not.toBe(Math.round(-107.5));
  });

  // Emergent from the arithmetic, not a special case — there is deliberately no guard, because
  // the caller's own validation owns non-finite input. Pinned so nobody "fixes" it by adding one.
  it('passes non-finite inputs through unchanged', () => {
    expect(Number.isNaN(roundHalfEven(NaN))).toBe(true);
    expect(roundHalfEven(Infinity)).toBe(Infinity);
    expect(roundHalfEven(-Infinity)).toBe(-Infinity);
  });
});
