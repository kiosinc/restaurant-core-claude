export class ValidationError extends Error {
  readonly field: string;

  constructor(field: string, message: string) {
    super(`Validation failed for '${field}': ${message}`);
    this.name = 'ValidationError';
    this.field = field;
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

export function requireMinLessOrEqual(
  minField: string,
  minValue: number,
  maxField: string,
  maxValue: number,
): void {
  if (minValue > maxValue) {
    throw new ValidationError(
      minField,
      `must be <= ${maxField} (got ${minField}=${minValue}, ${maxField}=${maxValue})`,
    );
  }
}
