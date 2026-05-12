import { describe, it, expect } from 'vitest';
import { createEvent, eventIdentifier } from '../Event';
import { createTestEventInput } from '../../__tests__/helpers/EventFixtures';
import { ValidationError } from '../../validation';

describe('Event (domain)', () => {
  it('constructs with all props', () => {
    const now = new Date('2024-01-15T10:00:00Z');
    const event = createEvent({
      provider: 'square',
      type: 'catalog',
      isSync: true,
      queueCap: 5,
      queueCount: 3,
      timestamp: now,
      created: now,
      updated: now,
      isDeleted: false,
      Id: 'custom-id',
    });

    expect(event.provider).toBe('square');
    expect(event.type).toBe('catalog');
    expect(event.isSync).toBe(true);
    expect(event.queueCap).toBe(5);
    expect(event.queueCount).toBe(3);
    expect(event.timestamp).toBe(now);
    expect(event.created).toBe(now);
    expect(event.updated).toBe(now);
    expect(event.isDeleted).toBe(false);
    expect(event.Id).toBe('custom-id');
  });

  it('defaults Id to provider.type composite', () => {
    const event = createEvent(createTestEventInput());
    expect(event.Id).toBe('square.catalog');
  });

  it('uses provided Id when given', () => {
    const event = createEvent(createTestEventInput({ Id: 'custom-id' }));
    expect(event.Id).toBe('custom-id');
  });

  it('defaults queueCap to -1', () => {
    const event = createEvent(createTestEventInput());
    expect(event.queueCap).toBe(-1);
  });

  it('defaults queueCount to 0', () => {
    const event = createEvent(createTestEventInput());
    expect(event.queueCount).toBe(0);
  });

  it('uses provided queueCap/queueCount', () => {
    const event = createEvent(createTestEventInput({ queueCap: 10, queueCount: 7 }));
    expect(event.queueCap).toBe(10);
    expect(event.queueCount).toBe(7);
  });

  it('timestamp is optional (undefined)', () => {
    const event = createEvent(createTestEventInput());
    expect(event.timestamp).toBeUndefined();
  });

  it('timestamp accepts Date', () => {
    const ts = new Date('2024-06-01T12:00:00Z');
    const event = createEvent(createTestEventInput({ timestamp: ts }));
    expect(event.timestamp).toBe(ts);
  });

  it('eventIdentifier() returns provider.type', () => {
    expect(eventIdentifier('square', 'catalog')).toBe('square.catalog');
    expect(eventIdentifier('system', 'inventory')).toBe('system.inventory');
  });

  it('isSync is mutable', () => {
    const event = createEvent(createTestEventInput({ isSync: true }));
    event.isSync = false;
    expect(event.isSync).toBe(false);
  });

  it('queueCap is mutable', () => {
    const event = createEvent(createTestEventInput());
    event.queueCap = 10;
    expect(event.queueCap).toBe(10);
  });

  it('queueCount is mutable', () => {
    const event = createEvent(createTestEventInput());
    event.queueCount = 5;
    expect(event.queueCount).toBe(5);
  });

  describe('validation', () => {
    it('throws for empty provider', () => {
      expect(() => createEvent(createTestEventInput({ provider: '' }))).toThrow(ValidationError);
    });

    it('throws for empty type', () => {
      expect(() => createEvent(createTestEventInput({ type: '' }))).toThrow(ValidationError);
    });
  });
});
