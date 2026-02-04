import { describe, it, expect } from 'vitest';
import { Token, TokenProps } from '../Token';
import { createTestTokenProps } from '../../__tests__/helpers/SurfacesFixtures';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class ConcreteToken extends Token {
  constructor(props: TokenProps) {
    super(props);
  }
}

describe('Token (domain)', () => {
  it('concrete subclass constructs with all props', () => {
    const now = new Date('2024-01-15T10:00:00Z');
    const token = new ConcreteToken(createTestTokenProps({
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

  it('auto-generates UUID', () => {
    const token = new ConcreteToken(createTestTokenProps());
    expect(token.Id).toMatch(UUID_REGEX);
  });

  it('stores businessId', () => {
    const token = new ConcreteToken(createTestTokenProps({ businessId: 'biz-123' }));
    expect(token.businessId).toBe('biz-123');
  });

  it('stores provider', () => {
    const token = new ConcreteToken(createTestTokenProps({ provider: 'square' }));
    expect(token.provider).toBe('square');
  });

  it('stores createdBy', () => {
    const token = new ConcreteToken(createTestTokenProps({ createdBy: 'user-42' }));
    expect(token.createdBy).toBe('user-42');
  });

  it('inherits DomainEntity fields', () => {
    const now = new Date('2024-06-01T12:00:00Z');
    const token = new ConcreteToken(createTestTokenProps({ created: now, updated: now, isDeleted: true }));
    expect(token.created).toEqual(now);
    expect(token.updated).toEqual(now);
    expect(token.isDeleted).toBe(true);
  });

  it('instantiates without Firebase', () => {
    const token = new ConcreteToken(createTestTokenProps());
    expect(token).toBeDefined();
  });
});
