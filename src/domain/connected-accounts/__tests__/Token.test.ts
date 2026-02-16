import { describe, it, expect } from 'vitest';
import { createToken } from '../Token';
import { createTestTokenInput } from '../../__tests__/helpers/SurfacesFixtures';
import { ValidationError } from '../../validation';

describe('Token (domain)', () => {
  it('constructs with all props', () => {
    const now = new Date('2024-01-15T10:00:00Z');
    const token = createToken(createTestTokenInput({
      Id: 'tok-1',
      createdBy: 'admin',
      businessId: 'biz-99',
      provider: 'stripe',
      created: now,
      updated: now,
    }));

    expect(token.Id).toBe('tok-1');
    expect(token.createdBy).toBe('admin');
    expect(token.businessId).toBe('biz-99');
    expect(token.provider).toBe('stripe');
  });

  it('stores businessId', () => {
    const token = createToken(createTestTokenInput({ businessId: 'biz-123' }));
    expect(token.businessId).toBe('biz-123');
  });

  it('stores provider', () => {
    const token = createToken(createTestTokenInput({ provider: 'square' }));
    expect(token.provider).toBe('square');
  });

  it('stores createdBy', () => {
    const token = createToken(createTestTokenInput({ createdBy: 'user-42' }));
    expect(token.createdBy).toBe('user-42');
  });

  describe('validation', () => {
    it('throws for empty createdBy', () => {
      expect(() => createToken(createTestTokenInput({ createdBy: '' }))).toThrow(ValidationError);
    });

    it('throws for empty businessId', () => {
      expect(() => createToken(createTestTokenInput({ businessId: '' }))).toThrow(ValidationError);
    });

    it('throws for empty provider', () => {
      expect(() => createToken(createTestTokenInput({ provider: '' }))).toThrow(ValidationError);
    });
  });

});
