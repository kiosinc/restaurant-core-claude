import {
  parsePhoneNumberWithError, ParseError, CountryCode, PhoneNumber,
} from 'libphonenumber-js';
import { requireNonEmptyString, ValidationError } from '../validation';

export type { CountryCode };

/**
 * Normalizes a human-entered phone number to its canonical E.164 spelling
 * (`'(415) 555-0132'` -> `'+14155550132'`). E.164 is the one form Firebase Auth
 * and the P34 invitation lookups compare on, so every phone number entering the
 * domain is normalized here first rather than at each comparison site.
 *
 * `defaultCountry` is **required** on purpose. A silent `'US'` default would
 * quietly re-home a foreign national number onto the North American plan, and
 * the result feeds an identity lookup — that is the wrong person, not merely a
 * wrong format. It is consulted only when `raw` carries no calling code of its
 * own: an input that already starts with `+` keeps its own country, so
 * `toE164('+442071838750', 'US')` stays `'+442071838750'`.
 *
 * Every failure throws this repo's `ValidationError`. `libphonenumber-js`'s own
 * `ParseError` never escapes — consumers already catch `ValidationError`, and
 * leaking `ParseError` would drag `libphonenumber-js` into every consumer's type
 * graph. The parser's reason (`NOT_A_NUMBER`, `INVALID_COUNTRY`, `TOO_SHORT`,
 * `TOO_LONG`, `INVALID_LENGTH`) is carried through in the message text.
 *
 * Parsing and validity are two separate rejections and both are needed: a string
 * can parse into a `PhoneNumber` and still be invalid. `'+1 023 555 0132'` has a
 * legal North-American length, so the parser accepts it, but no US area code
 * begins with `0` — it is rejected by the `isValid()` check below, not by the
 * parser.
 *
 * Metadata: this imports the package's default entry point, which carries the
 * `min` metadata (~80 KB, loaded at import time — cold-start relevant for
 * consumers that reach this through the root barrel). `min` omits the per-type
 * digit-validation regexes that `libphonenumber-js/max` carries. That is
 * deliberate: this helper's job is canonicalization for a Firebase comparison,
 * Firebase Auth validates downstream, and `min` still rejects structurally wrong
 * numbers (verified — the `'+1 023 555 0132'` case above does fail `isValid()`
 * under `min`). Switching is a one-line change of the import specifier to
 * `'libphonenumber-js/max'`.
 */
export function toE164(raw: string, defaultCountry: CountryCode): string {
  requireNonEmptyString('raw', raw);
  const trimmed = raw.trim();

  let parsed: PhoneNumber;
  try {
    parsed = parsePhoneNumberWithError(trimmed, defaultCountry);
  } catch (err) {
    if (err instanceof ParseError) {
      throw new ValidationError('raw', `is not a parseable phone number (${err.message})`);
    }
    throw err;
  }

  if (!parsed.isValid()) {
    throw new ValidationError('raw', 'is not a valid phone number');
  }

  return parsed.number;
}
