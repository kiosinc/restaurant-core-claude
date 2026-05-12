import { describe, it, expect, beforeEach } from 'vitest';
import { RelationshipHandlerRegistry } from '../RelationshipHandlerRegistry';
import { RelationshipHandler } from '../RelationshipHandler';
import { BaseEntity } from '../../../../domain/BaseEntity';

interface TestEntity extends BaseEntity {
  name: string;
}

const stubHandler: RelationshipHandler<TestEntity> = {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async onSet() {},
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async onDelete() {},
};

describe('RelationshipHandlerRegistry', () => {
  let registry: RelationshipHandlerRegistry;

  beforeEach(() => {
    registry = new RelationshipHandlerRegistry();
  });

  it('register and resolve by string key', () => {
    registry.register('TestEntity', stubHandler);
    expect(registry.resolve('TestEntity')).toBe(stubHandler);
  });

  it('null for unregistered key', () => {
    expect(registry.resolve('unknown')).toBeNull();
  });

  it('clear() removes all', () => {
    registry.register('TestEntity', stubHandler);
    registry.clear();
    expect(registry.resolve('TestEntity')).toBeNull();
  });
});
