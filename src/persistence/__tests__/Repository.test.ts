import { describe, it, expect } from 'vitest';
import { Repository } from '../Repository';
import { DomainEntity, DomainEntityProps } from '../../domain/DomainEntity';

class TestEntity extends DomainEntity {
  constructor(props: DomainEntityProps = {}) {
    super(props);
  }
}

describe('Repository', () => {
  it('interface compiles', () => {
    class DummyRepository implements Repository<TestEntity> {
      async get(_businessId: string, _id: string) { return null; }
      async set(_entity: TestEntity, _businessId: string) {}
      async update(_entity: TestEntity, _businessId: string) {}
      async delete(_businessId: string, _id: string) {}
      async findByLinkedObject(_businessId: string, _linkedObjectId: string, _provider: string) { return null; }
    }

    const repo = new DummyRepository();
    expect(repo).toBeDefined();
  });
});
