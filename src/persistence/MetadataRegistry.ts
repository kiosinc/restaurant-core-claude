import { MetadataSpec, MetaLinkDeclaration } from '../domain/MetadataSpec';
import { DomainEntity } from '../domain/DomainEntity';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Constructor = new (...args: any[]) => any;

export class MetadataRegistry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private specs = new Map<Constructor, MetadataSpec<any, any>>();

  register<T extends DomainEntity, TMeta>(
    entityClass: new (...args: any[]) => T,
    spec: MetadataSpec<T, TMeta>,
  ): void {
    this.specs.set(entityClass, spec);
  }

  resolve<T extends DomainEntity>(entity: T): MetadataSpec<T, unknown> | null {
    let proto = Object.getPrototypeOf(entity);
    while (proto !== null) {
      const spec = this.specs.get(proto.constructor);
      if (spec) {
        return spec as MetadataSpec<T, unknown>;
      }
      proto = Object.getPrototypeOf(proto);
    }
    return null;
  }

  getMetaLinks<T extends DomainEntity>(entity: T, businessId: string): MetaLinkDeclaration[] {
    const spec = this.resolve(entity);
    if (!spec) return [];
    return spec.getMetaLinks(entity, businessId);
  }

  getMetadata<T extends DomainEntity>(entity: T): unknown | null {
    const spec = this.resolve(entity);
    if (!spec) return null;
    return spec.getMetadata(entity);
  }

  has(entityClass: new (...args: any[]) => DomainEntity): boolean {
    return this.specs.has(entityClass);
  }

  clear(): void {
    this.specs.clear();
  }
}
