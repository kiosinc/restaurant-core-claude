import { describe, it, expect } from 'vitest';
import { MetadataRegistry } from '../MetadataRegistry';
import { DomainEntity, DomainEntityProps } from '../../domain/DomainEntity';
import { MetadataSpec, MetaLinkDeclaration } from '../../domain/MetadataSpec';

class ParentEntity extends DomainEntity {
  name: string;
  constructor(props: DomainEntityProps & { name: string }) {
    super(props);
    this.name = props.name;
  }
}

class ChildEntity extends ParentEntity {
  constructor(props: DomainEntityProps & { name: string }) {
    super(props);
  }
}

class UnregisteredEntity extends DomainEntity {
  constructor(props: DomainEntityProps = {}) {
    super(props);
  }
}

const parentSpec: MetadataSpec<ParentEntity, { name: string }> = {
  getMetadata(entity: ParentEntity) {
    return { name: entity.name };
  },
  getMetaLinks(entity: ParentEntity, businessId: string): MetaLinkDeclaration[] {
    return [
      {
        documentPath: `businesses/${businessId}/root`,
        fieldPath: `parents.${entity.Id}`,
      },
    ];
  },
};

describe('MetadataRegistry', () => {
  it('register and resolve', () => {
    const registry = new MetadataRegistry();
    registry.register(ParentEntity, parentSpec);
    const entity = new ParentEntity({ name: 'test' });
    expect(registry.resolve(entity)).toBe(parentSpec);
  });

  it('null for unregistered', () => {
    const registry = new MetadataRegistry();
    const entity = new UnregisteredEntity();
    expect(registry.resolve(entity)).toBeNull();
  });

  it('prototype chain walking', () => {
    const registry = new MetadataRegistry();
    registry.register(ParentEntity, parentSpec);
    const child = new ChildEntity({ name: 'child' });
    expect(registry.resolve(child)).toBe(parentSpec);
  });

  it('getMetaLinks with spec', () => {
    const registry = new MetadataRegistry();
    registry.register(ParentEntity, parentSpec);
    const entity = new ParentEntity({ Id: 'p1', name: 'test' });
    const links = registry.getMetaLinks(entity, 'biz-1');
    expect(links).toEqual([
      { documentPath: 'businesses/biz-1/root', fieldPath: 'parents.p1' },
    ]);
  });

  it('getMetaLinks without spec', () => {
    const registry = new MetadataRegistry();
    const entity = new UnregisteredEntity();
    expect(registry.getMetaLinks(entity, 'biz-1')).toEqual([]);
  });

  it('getMetadata with spec', () => {
    const registry = new MetadataRegistry();
    registry.register(ParentEntity, parentSpec);
    const entity = new ParentEntity({ name: 'hello' });
    expect(registry.getMetadata(entity)).toEqual({ name: 'hello' });
  });

  it('getMetadata without spec', () => {
    const registry = new MetadataRegistry();
    const entity = new UnregisteredEntity();
    expect(registry.getMetadata(entity)).toBeNull();
  });

  it('has() true/false', () => {
    const registry = new MetadataRegistry();
    expect(registry.has(ParentEntity)).toBe(false);
    registry.register(ParentEntity, parentSpec);
    expect(registry.has(ParentEntity)).toBe(true);
  });

  it('clear() removes all', () => {
    const registry = new MetadataRegistry();
    registry.register(ParentEntity, parentSpec);
    expect(registry.has(ParentEntity)).toBe(true);
    registry.clear();
    expect(registry.has(ParentEntity)).toBe(false);
  });

  it('no Firebase dependency', () => {
    // Test passing = proof that MetadataRegistry works without Firebase
    const registry = new MetadataRegistry();
    registry.register(ParentEntity, parentSpec);
    const entity = new ParentEntity({ name: 'test' });
    expect(registry.resolve(entity)).toBe(parentSpec);
  });
});
