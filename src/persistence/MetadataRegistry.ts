import { MetadataSpec, MetaLinkDeclaration } from '../domain/MetadataSpec';

export class MetadataRegistry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private specs = new Map<string, MetadataSpec<any, any>>();

  register<T, TMeta>(
    key: string,
    spec: MetadataSpec<T, TMeta>,
  ): void {
    this.specs.set(key, spec);
  }

  resolve(key: string): MetadataSpec<any, any> | null {
    return this.specs.get(key) ?? null;
  }

  getMetaLinks<T>(key: string, entity: T, businessId: string): MetaLinkDeclaration[] {
    const spec = this.resolve(key);
    if (!spec) return [];
    return spec.getMetaLinks(entity, businessId);
  }

  getMetadata<T>(key: string, entity: T): unknown | null {
    const spec = this.resolve(key);
    if (!spec) return null;
    return spec.getMetadata(entity);
  }

  clear(): void {
    this.specs.clear();
  }
}
