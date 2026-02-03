import { describe, it, expect, afterEach } from 'vitest';
import { DomainEntity, DomainEntityProps } from '../DomainEntity';
import { IdGenerator } from '../IdGenerator';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class TestEntity extends DomainEntity {
  constructor(props: DomainEntityProps = {}) {
    super(props);
  }
}

describe('DomainEntity', () => {
  const originalGenerator = DomainEntity.getIdGenerator();

  afterEach(() => {
    DomainEntity.setIdGenerator(originalGenerator);
  });

  it('auto-generates UUID when no Id provided', () => {
    const entity = new TestEntity();
    expect(entity.Id).toMatch(UUID_V4_REGEX);
  });

  it('uses provided Id', () => {
    const entity = new TestEntity({ Id: 'custom-id' });
    expect(entity.Id).toBe('custom-id');
  });

  it('defaults created/updated to now', () => {
    const before = Date.now();
    const entity = new TestEntity();
    const after = Date.now();
    expect(entity.created.getTime()).toBeGreaterThanOrEqual(before);
    expect(entity.created.getTime()).toBeLessThanOrEqual(after);
    expect(entity.updated.getTime()).toBeGreaterThanOrEqual(before);
    expect(entity.updated.getTime()).toBeLessThanOrEqual(after);
  });

  it('uses provided dates', () => {
    const created = new Date('2020-01-01T00:00:00Z');
    const updated = new Date('2021-06-15T12:00:00Z');
    const entity = new TestEntity({ created, updated });
    expect(entity.created.getTime()).toBe(created.getTime());
    expect(entity.updated.getTime()).toBe(updated.getTime());
  });

  it('defaults isDeleted to false', () => {
    const entity = new TestEntity();
    expect(entity.isDeleted).toBe(false);
  });

  it('uses provided isDeleted', () => {
    const entity = new TestEntity({ isDeleted: true });
    expect(entity.isDeleted).toBe(true);
  });

  it('setIdGenerator replaces generator', () => {
    const mockGenerator: IdGenerator = { generate: () => 'fixed-id' };
    DomainEntity.setIdGenerator(mockGenerator);
    const entity = new TestEntity();
    expect(entity.Id).toBe('fixed-id');
  });

  it('getIdGenerator returns current', () => {
    const generator = DomainEntity.getIdGenerator();
    expect(typeof generator.generate).toBe('function');
  });

  it('updated is mutable', () => {
    const entity = new TestEntity();
    const newDate = new Date('2030-01-01T00:00:00Z');
    entity.updated = newDate;
    expect(entity.updated).toBe(newDate);
  });

  it('Id is readonly', () => {
    const entity = new TestEntity({ Id: 'original' });
    // @ts-expect-error Id is readonly
    entity.Id = 'changed';
  });

  it('instantiates without Firebase', () => {
    const entity = new TestEntity();
    expect(entity).toBeInstanceOf(DomainEntity);
  });
});
