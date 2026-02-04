import { describe, it, expect, beforeEach } from 'vitest';
import { RelationshipHandlerRegistry } from '../RelationshipHandlerRegistry';
import { RelationshipHandler } from '../RelationshipHandler';
import { DomainEntity, DomainEntityProps } from '../../../../domain/DomainEntity';

class TestEntity extends DomainEntity {
  constructor(props: DomainEntityProps = {}) { super(props); }
}

class ChildEntity extends TestEntity {
  constructor(props: DomainEntityProps = {}) { super(props); }
}

const stubHandler: RelationshipHandler<TestEntity> = {
  async onSet() {},
  async onDelete() {},
};

describe('RelationshipHandlerRegistry', () => {
  let registry: RelationshipHandlerRegistry;

  beforeEach(() => {
    registry = new RelationshipHandlerRegistry();
  });

  it('register and resolve', () => {
    registry.register(TestEntity, stubHandler);
    const entity = new TestEntity();
    expect(registry.resolve(entity)).toBe(stubHandler);
  });

  it('null for unregistered', () => {
    const entity = new TestEntity();
    expect(registry.resolve(entity)).toBeNull();
  });

  it('prototype chain walking', () => {
    registry.register(TestEntity, stubHandler);
    const child = new ChildEntity();
    expect(registry.resolve(child)).toBe(stubHandler);
  });

  it('clear() removes all', () => {
    registry.register(TestEntity, stubHandler);
    registry.clear();
    const entity = new TestEntity();
    expect(registry.resolve(entity)).toBeNull();
  });
});
