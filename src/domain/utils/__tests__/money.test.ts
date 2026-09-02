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

  it('returns +0, not -0, for a tie that lands on zero', () => {
    expect(Object.is(roundHalfEven(-0.5), 0)).toBe(true);
  });

  it('is not Math.round', () => {
    expect(roundHalfEven(108.5)).not.toBe(Math.round(108.5));
    expect(roundHalfEven(-107.5)).not.toBe(Math.round(-107.5));
  });

  it('passes non-finite inputs through unchanged', () => {
    expect(Number.isNaN(roundHalfEven(NaN))).toBe(true);
    expect(roundHalfEven(Infinity)).toBe(Infinity);
    expect(roundHalfEven(-Infinity)).toBe(-Infinity);
  });
});
