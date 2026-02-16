import { describe, it, expect } from 'vitest';
import { generateId, baseEntityDefaults } from '../BaseEntity';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('BaseEntity', () => {
  it('generateId() produces UUID v4', () => {
    expect(generateId()).toMatch(UUID_REGEX);
  });

  it('generateId() produces unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateId());
    }
    expect(ids.size).toBe(100);
  });

  it('baseEntityDefaults fills all fields', () => {
    const entity = baseEntityDefaults();
    expect(entity.Id).toMatch(UUID_REGEX);
    expect(entity.created).toBeInstanceOf(Date);
    expect(entity.updated).toBeInstanceOf(Date);
    expect(entity.isDeleted).toBe(false);
  });

  it('baseEntityDefaults respects overrides', () => {
    const d = new Date('2024-01-01');
    const entity = baseEntityDefaults({ Id: 'custom', created: d, updated: d, isDeleted: true });
    expect(entity.Id).toBe('custom');
    expect(entity.created).toBe(d);
    expect(entity.isDeleted).toBe(true);
  });
});
