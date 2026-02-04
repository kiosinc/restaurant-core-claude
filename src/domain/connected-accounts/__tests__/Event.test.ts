import { describe, it, expect } from 'vitest';
import { Event } from '../Event';
import { DomainEntity } from '../../DomainEntity';
import { createTestEventProps } from '../../__tests__/helpers/EventFixtures';

describe('Event (domain)', () => {
  it('constructs with all props', () => {
    const now = new Date('2024-01-15T10:00:00Z');
    const event = new Event({
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
    const event = new Event(createTestEventProps());
    expect(event.Id).toBe('square.catalog');
  });

  it('uses provided Id when given', () => {
    const event = new Event(createTestEventProps({ Id: 'custom-id' }));
    expect(event.Id).toBe('custom-id');
  });

  it('defaults queueCap to -1', () => {
    const event = new Event(createTestEventProps());
    expect(event.queueCap).toBe(-1);
  });

  it('defaults queueCount to 0', () => {
    const event = new Event(createTestEventProps());
    expect(event.queueCount).toBe(0);
  });

  it('uses provided queueCap/queueCount', () => {
    const event = new Event(createTestEventProps({ queueCap: 10, queueCount: 7 }));
    expect(event.queueCap).toBe(10);
    expect(event.queueCount).toBe(7);
  });

  it('timestamp is optional (undefined)', () => {
    const event = new Event(createTestEventProps());
    expect(event.timestamp).toBeUndefined();
  });

  it('timestamp accepts Date', () => {
    const ts = new Date('2024-06-01T12:00:00Z');
    const event = new Event(createTestEventProps({ timestamp: ts }));
    expect(event.timestamp).toBe(ts);
  });

  it('inherits DomainEntity fields', () => {
    const event = new Event(createTestEventProps());
    expect(event).toBeInstanceOf(DomainEntity);
    expect(event).toHaveProperty('created');
    expect(event).toHaveProperty('updated');
    expect(event).toHaveProperty('isDeleted');
  });

  it('defaults created/updated to now', () => {
    const before = Date.now();
    const event = new Event(createTestEventProps());
    const after = Date.now();

    expect(event.created.getTime()).toBeGreaterThanOrEqual(before);
    expect(event.created.getTime()).toBeLessThanOrEqual(after);
    expect(event.updated.getTime()).toBeGreaterThanOrEqual(before);
    expect(event.updated.getTime()).toBeLessThanOrEqual(after);
  });

  it('defaults isDeleted to false', () => {
    const event = new Event(createTestEventProps());
    expect(event.isDeleted).toBe(false);
  });

  it('identifier() returns provider.type', () => {
    expect(Event.identifier('square', 'catalog')).toBe('square.catalog');
    expect(Event.identifier('system', 'inventory')).toBe('system.inventory');
  });

  it('instantiates without Firebase', () => {
    // Test passing = proof that no Firebase imports are required
    const event = new Event(createTestEventProps());
    expect(event).toBeDefined();
  });

  it('isSync is mutable', () => {
    const event = new Event(createTestEventProps({ isSync: true }));
    event.isSync = false;
    expect(event.isSync).toBe(false);
  });

  it('queueCap is mutable', () => {
    const event = new Event(createTestEventProps());
    event.queueCap = 10;
    expect(event.queueCap).toBe(10);
  });

  it('queueCount is mutable', () => {
    const event = new Event(createTestEventProps());
    event.queueCount = 5;
    expect(event.queueCount).toBe(5);
  });
});
