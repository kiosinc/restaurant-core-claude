import { describe, it, expect } from 'vitest';
import { MetadataRegistry } from '../MetadataRegistry';
import { BaseEntity } from '../../domain/BaseEntity';
import { MetadataSpec, MetaLinkDeclaration } from '../../domain/MetadataSpec';

interface TestEntity extends BaseEntity {
  name: string;
}

const testSpec: MetadataSpec<TestEntity, { name: string }> = {
  getMetadata(entity: TestEntity) {
    return { name: entity.name };
  },
  getMetaLinks(entity: TestEntity, businessId: string): MetaLinkDeclaration[] {
    return [
      {
        documentPath: `businesses/${businessId}/root`,
        fieldPath: `items.${entity.Id}`,
      },
    ];
  },
};

function makeEntity(overrides: Partial<TestEntity> = {}): TestEntity {
  return {
    Id: 'e1',
    name: 'test',
    created: new Date(),
    updated: new Date(),
    isDeleted: false,
    ...overrides,
  };
}

describe('MetadataRegistry', () => {
  it('register and resolve', () => {
    const registry = new MetadataRegistry();
    registry.register('TestEntity', testSpec);
    expect(registry.resolve('TestEntity')).toBe(testSpec);
  });

  it('null for unregistered', () => {
    const registry = new MetadataRegistry();
    expect(registry.resolve('unknown')).toBeNull();
  });

  it('getMetaLinks with spec', () => {
    const registry = new MetadataRegistry();
    registry.register('TestEntity', testSpec);
    const entity = makeEntity({ Id: 'p1' });
    const links = registry.getMetaLinks('TestEntity', entity, 'biz-1');
    expect(links).toEqual([
      { documentPath: 'businesses/biz-1/root', fieldPath: 'items.p1' },
    ]);
  });

  it('getMetaLinks without spec', () => {
    const registry = new MetadataRegistry();
    const entity = makeEntity();
    expect(registry.getMetaLinks('unknown', entity, 'biz-1')).toEqual([]);
  });

  it('getMetadata with spec', () => {
    const registry = new MetadataRegistry();
    registry.register('TestEntity', testSpec);
    const entity = makeEntity({ name: 'hello' });
    expect(registry.getMetadata('TestEntity', entity)).toEqual({ name: 'hello' });
  });

  it('getMetadata without spec', () => {
    const registry = new MetadataRegistry();
    const entity = makeEntity();
    expect(registry.getMetadata('unknown', entity)).toBeNull();
  });

  it('clear() removes all', () => {
    const registry = new MetadataRegistry();
    registry.register('TestEntity', testSpec);
    expect(registry.resolve('TestEntity')).not.toBeNull();
    registry.clear();
    expect(registry.resolve('TestEntity')).toBeNull();
  });

  it('no Firebase dependency', () => {
    const registry = new MetadataRegistry();
    registry.register('TestEntity', testSpec);
    expect(registry.resolve('TestEntity')).toBe(testSpec);
  });
});
