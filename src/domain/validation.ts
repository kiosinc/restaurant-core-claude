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
