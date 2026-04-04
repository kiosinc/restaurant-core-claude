import { describe, it, expect } from 'vitest';
import { MetaLinkDeclaration, MetadataSpec } from '../MetadataSpec';

describe('MetadataSpec', () => {
  it('MetaLinkDeclaration shape', () => {
    const link: MetaLinkDeclaration = {
      documentPath: 'businesses/abc/locations',
      fieldPath: 'locations.loc123',
    };
    expect(link.documentPath).toBe('businesses/abc/locations');
    expect(link.fieldPath).toBe('locations.loc123');
  });

  it('MetadataSpec implementation', () => {
    interface TestMeta {
      name: string;
    }
    interface TestEntity {
      name: string;
      businessId: string;
    }

    const spec: MetadataSpec<TestEntity, TestMeta> = {
      getMetadata(entity) {
        return { name: entity.name };
      },
      getMetaLinks(entity, businessId) {
        return [
          {
            documentPath: `businesses/${businessId}/root`,
            fieldPath: `items.${entity.name}`,
          },
        ];
      },
    };

    const entity: TestEntity = { name: 'test', businessId: 'biz-1' };
    expect(spec.getMetadata(entity)).toEqual({ name: 'test' });
    expect(spec.getMetaLinks(entity, 'biz-1')).toEqual([
      { documentPath: 'businesses/biz-1/root', fieldPath: 'items.test' },
    ]);
  });

});
