export class ValidationError extends Error {
  readonly field: string;

  constructor(field: string, message: string) {
    super(`Validation failed for '${field}': ${message}`);
    this.name = 'ValidationError';
    this.field = field;
  }
}

export function requireString(field: string, value: unknown): void {
  if (typeof value !== 'string') {
    throw new ValidationError(field, 'must be a string');
  }
}

export function requireNonEmptyString(field: string, value: unknown): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(field, 'must be a non-empty string');
  }
}

export function requireNonNegativeNumber(field: string, value: unknown): void {
  if (typeof value !== 'number' || !(value >= 0)) {
    throw new ValidationError(field, 'must be a non-negative number');
  }
}

export function requireNonNegativeInteger(field: string, value: unknown): void {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new ValidationError(field, 'must be a non-negative integer');
  }
}

/** Like requireNonNegativeInteger but also allows -1 as a sentinel for "no constraint". */
export function requireNonNegativeIntegerOrNeg1(field: string, value: unknown): void {
  if (typeof value !== 'number' || !Number.isInteger(value) || (value < 0 && value !== -1)) {
    throw new ValidationError(field, 'must be a non-negative integer or -1');
  }
}

export function requireBoolean(field: string, value: unknown): void {
  if (typeof value !== 'boolean') {
    throw new ValidationError(field, 'must be a boolean');
  }
}

/** `value` must be one of `allowed` (strict equality; case-sensitive). */
export function requireOneOf(field: string, allowed: readonly string[], value: unknown): void {
  if (!allowed.includes(value as string)) {
    throw new ValidationError(field, `must be one of: ${allowed.map((v) => `'${v}'`).join(', ')}`);
  }
}

/**
 * E.164 *shape* only: a leading `+`, a non-zero leading digit, then up to 14 more digits.
 *
 * This is deliberately not a phone-number validity check — `Domain.Utils.toE164` is what parses a
 * raw number against real numbering plans and canonicalizes it, and write-path callers are
 * expected to have run it first. Keeping this one a regex is what lets the domain layer reject a
 * hand-built value without pulling the metadata tables into every module that stores a number.
 */
export function requireE164(field: string, value: unknown): void {
  if (typeof value !== 'string' || !/^\+[1-9]\d{1,14}$/.test(value)) {
    throw new ValidationError(field, 'must be an E.164 phone number');
  }
}

/**
 * Returns the parsed epoch millis of an ISO-8601 string. Anything else — including a `Date`,
 * a Firestore `Timestamp`, or a number — is a caller bug. Unlike the other validators this
 * returns a value: callers that go on to compare instants would otherwise parse the string twice.
 */
export function requireIsoTimestamp(field: string, value: unknown): number {
  const ms = typeof value === 'string' ? Date.parse(value) : NaN;
  if (Number.isNaN(ms)) {
    throw new ValidationError(field, 'must be an ISO-8601 string');
  }
  return ms;
}

export function requireMinLessOrEqual(
  minField: string,
  minValue: number,
  maxField: string,
  maxValue: number,
): void {
  // -1 sentinel means "no constraint" — skip comparison when either side is unconstrained
  if (minValue === -1 || maxValue === -1) return;
  if (minValue > maxValue) {
    throw new ValidationError(
      minField,
      `must be <= ${maxField} (got ${minField}=${minValue}, ${maxField}=${maxValue})`,
    );
  }
}
