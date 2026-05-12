import { describe, it, expect } from 'vitest';
import {
  ValidationError,
  requireString,
  requireNonEmptyString,
  requireNonNegativeNumber,
  requireNonNegativeInteger,
  requireNonNegativeIntegerOrNeg1,
  requireMinLessOrEqual,
} from '../validation';

describe('ValidationError', () => {
  it('extends Error with field property', () => {
    const err = new ValidationError('name', 'must be a non-empty string');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ValidationError');
    expect(err.field).toBe('name');
    expect(err.message).toContain('name');
    expect(err.message).toContain('non-empty string');
  });
});

describe('requireString', () => {
  it('passes for non-empty string', () => {
    expect(() => requireString('name', 'Burger')).not.toThrow();
  });

  it('passes for empty string', () => {
    expect(() => requireString('name', '')).not.toThrow();
  });

  it('throws for undefined', () => {
    expect(() => requireString('name', undefined)).toThrow(ValidationError);
  });

  it('throws for null', () => {
    expect(() => requireString('name', null)).toThrow(ValidationError);
  });

  it('throws for number', () => {
    expect(() => requireString('name', 123)).toThrow(ValidationError);
  });
});

describe('requireNonEmptyString', () => {
  it('passes for non-empty string', () => {
    expect(() => requireNonEmptyString('name', 'Burger')).not.toThrow();
  });

  it('throws for empty string', () => {
    expect(() => requireNonEmptyString('name', '')).toThrow(ValidationError);
  });

  it('throws for whitespace-only string', () => {
    expect(() => requireNonEmptyString('name', '   ')).toThrow(ValidationError);
  });

  it('throws for undefined', () => {
    expect(() => requireNonEmptyString('name', undefined)).toThrow(ValidationError);
  });

  it('throws for null', () => {
    expect(() => requireNonEmptyString('name', null)).toThrow(ValidationError);
  });

  it('throws for number', () => {
    expect(() => requireNonEmptyString('name', 123)).toThrow(ValidationError);
  });
});

describe('requireNonNegativeNumber', () => {
  it('passes for zero', () => {
    expect(() => requireNonNegativeNumber('price', 0)).not.toThrow();
  });

  it('passes for positive number', () => {
    expect(() => requireNonNegativeNumber('price', 500)).not.toThrow();
  });

  it('throws for negative number', () => {
    expect(() => requireNonNegativeNumber('price', -1)).toThrow(ValidationError);
  });

  it('throws for NaN', () => {
    expect(() => requireNonNegativeNumber('price', NaN)).toThrow(ValidationError);
  });

  it('throws for string', () => {
    expect(() => requireNonNegativeNumber('price', '500')).toThrow(ValidationError);
  });

  it('throws for undefined', () => {
    expect(() => requireNonNegativeNumber('price', undefined)).toThrow(ValidationError);
  });
});

describe('requireNonNegativeInteger', () => {
  it('passes for zero', () => {
    expect(() => requireNonNegativeInteger('count', 0)).not.toThrow();
  });

  it('passes for positive integer', () => {
    expect(() => requireNonNegativeInteger('count', 5)).not.toThrow();
  });

  it('throws for float', () => {
    expect(() => requireNonNegativeInteger('count', 1.5)).toThrow(ValidationError);
  });

  it('throws for negative integer', () => {
    expect(() => requireNonNegativeInteger('count', -1)).toThrow(ValidationError);
  });

  it('throws for NaN', () => {
    expect(() => requireNonNegativeInteger('count', NaN)).toThrow(ValidationError);
  });

  it('throws for string', () => {
    expect(() => requireNonNegativeInteger('count', '5')).toThrow(ValidationError);
  });
});

describe('requireNonNegativeIntegerOrNeg1', () => {
  it('passes for zero', () => {
    expect(() => requireNonNegativeIntegerOrNeg1('sel', 0)).not.toThrow();
  });

  it('passes for positive integer', () => {
    expect(() => requireNonNegativeIntegerOrNeg1('sel', 5)).not.toThrow();
  });

  it('passes for -1 sentinel', () => {
    expect(() => requireNonNegativeIntegerOrNeg1('sel', -1)).not.toThrow();
  });

  it('throws for -2', () => {
    expect(() => requireNonNegativeIntegerOrNeg1('sel', -2)).toThrow(ValidationError);
  });

  it('throws for float', () => {
    expect(() => requireNonNegativeIntegerOrNeg1('sel', 1.5)).toThrow(ValidationError);
  });

  it('throws for NaN', () => {
    expect(() => requireNonNegativeIntegerOrNeg1('sel', NaN)).toThrow(ValidationError);
  });

  it('throws for string', () => {
    expect(() => requireNonNegativeIntegerOrNeg1('sel', '5')).toThrow(ValidationError);
  });

  it('throws for undefined', () => {
    expect(() => requireNonNegativeIntegerOrNeg1('sel', undefined)).toThrow(ValidationError);
  });
});

describe('requireMinLessOrEqual', () => {
  it('passes when min < max', () => {
    expect(() => requireMinLessOrEqual('min', 0, 'max', 10)).not.toThrow();
  });

  it('passes when min equals max', () => {
    expect(() => requireMinLessOrEqual('min', 5, 'max', 5)).not.toThrow();
  });

  it('throws when min > max', () => {
    expect(() => requireMinLessOrEqual('minPrice', 10, 'maxPrice', 5)).toThrow(ValidationError);
  });

  it('error message contains both field names and values', () => {
    expect(() => requireMinLessOrEqual('minPrice', 10, 'maxPrice', 5))
      .toThrow(/minPrice.*maxPrice/);
  });

  it('passes when min is -1 sentinel (no constraint)', () => {
    expect(() => requireMinLessOrEqual('min', -1, 'max', 5)).not.toThrow();
  });

  it('passes when max is -1 sentinel (unlimited)', () => {
    expect(() => requireMinLessOrEqual('min', 5, 'max', -1)).not.toThrow();
  });

  it('passes when both are -1 sentinel', () => {
    expect(() => requireMinLessOrEqual('min', -1, 'max', -1)).not.toThrow();
  });
});
