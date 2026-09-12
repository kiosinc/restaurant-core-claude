import { describe, it, expect } from 'vitest';
import { ParseError, type CountryCode } from 'libphonenumber-js';
import { toE164 } from '../phone';
import { ValidationError } from '../../validation';

// Every accepted spelling of the same US number, plus one number that carries its own
// calling code. Reused by the canonicalization and idempotence tests below.
const ACCEPTED: ReadonlyArray<[string, CountryCode, string]> = [
  ['4155550132', 'US', '+14155550132'],
  ['(415) 555-0132', 'US', '+14155550132'],
  ['  415 555 0132  ', 'US', '+14155550132'],
  ['1 415 555 0132', 'US', '+14155550132'],
  ['+14155550132', 'US', '+14155550132'],
  ['+442071838750', 'US', '+442071838750'],
];

// Label, input, default country, and a fragment of the expected message. The fragments in
// parentheses are `libphonenumber-js`'s own `ParseError.message` values, carried through by
// `toE164` — each one was executed against the installed metadata, not assumed.
const REJECTED: ReadonlyArray<[string, unknown, CountryCode, string]> = [
  ['a non-string', 42, 'US', 'must be a non-empty string'],
  ['an empty string', '', 'US', 'must be a non-empty string'],
  ['a whitespace-only string', '   ', 'US', 'must be a non-empty string'],
  ['text with no digits', 'not a phone', 'US', '(NOT_A_NUMBER)'],
  ['a single digit', '+1', 'US', '(TOO_SHORT)'],
  ['an over-long number', '+1234567890123456789012', 'US', '(TOO_LONG)'],
  ['an unsupported default country', '4155550132', 'ZZ' as unknown as CountryCode, '(INVALID_COUNTRY)'],
  // Verified against the installed `min` metadata: the parser *accepts* both of these and
  // returns an unusable number rather than throwing, so they are rejected by the `isValid()`
  // branch. (`'+1 415'` in particular does not raise `TOO_SHORT` — `'+1'` above is the value
  // that actually does.)
  ['a truncated number the parser accepts', '+1 415', 'US', 'is not a valid phone number'],
  ['a number with an impossible area code', '+1 023 555 0132', 'US', 'is not a valid phone number'],
];

describe('toE164', () => {
  it.each(ACCEPTED)('normalizes %s (%s) to %s', (raw, country, expected) => {
    expect(toE164(raw, country)).toBe(expected);
  });

  it('is idempotent — a normalized value normalizes to itself', () => {
    for (const [raw, country] of ACCEPTED) {
      const once = toE164(raw, country);
      expect(toE164(once, country)).toBe(once);
    }
  });

  // The point of the helper: every accepted spelling collapses to one comparable string, in
  // the shape Firebase Auth and the invitation lookups expect.
  it('emits canonical E.164 for every accepted spelling', () => {
    for (const [raw, country] of ACCEPTED) {
      expect(toE164(raw, country)).toMatch(/^\+[1-9]\d{1,14}$/);
    }
  });

  // `defaultCountry` is required precisely so a foreign number is never re-homed onto the
  // North American plan — but it must also stay ignored when the input says its own country.
  it('ignores defaultCountry when the input carries a calling code', () => {
    expect(toE164('+44 20 7183 8750', 'US')).toBe('+442071838750');
    expect(toE164('+44 20 7183 8750', 'DE')).toBe('+442071838750');
    expect(toE164('+1 (415) 555-0132', 'GB')).toBe('+14155550132');
  });

  it.each(REJECTED)('throws ValidationError for %s', (_label, raw, country, fragment) => {
    expect(() => toE164(raw as string, country)).toThrow(ValidationError);
    expect(() => toE164(raw as string, country)).toThrow(fragment);
  });

  // `ParseError` must never reach a consumer: they catch `ValidationError`, and a leaked
  // `ParseError` would pull `libphonenumber-js` into their type graph.
  it('never leaks ParseError for any rejected input', () => {
    for (const [label, raw, country] of REJECTED) {
      let thrown: unknown;
      try {
        toE164(raw as string, country);
      } catch (err) {
        thrown = err;
      }
      expect(thrown, label).toBeInstanceOf(ValidationError);
      expect(thrown, label).not.toBeInstanceOf(ParseError);
    }
  });

  // Anti-tautology guard for the `isValid()` branch. Both values below parse cleanly — the
  // parser throws nothing — so catching `ParseError` alone would let them through. Delete the
  // `!parsed.isValid()` check in phone.ts and only these assertions fail; every other
  // rejection above still passes.
  it('rejects numbers that parse but are not valid', () => {
    expect(() => toE164('+1 023 555 0132', 'US')).toThrow('is not a valid phone number');
    expect(() => toE164('+1 415', 'US')).toThrow('is not a valid phone number');
  });

  it('names the offending argument on every ValidationError', () => {
    try {
      toE164('not a phone', 'US');
      expect.unreachable();
    } catch (err) {
      expect((err as ValidationError).field).toBe('raw');
    }
  });
});
