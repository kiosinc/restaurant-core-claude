import { DomainEntity } from '../../../domain/DomainEntity';
import { RelationshipHandler } from './RelationshipHandler';

export class RelationshipHandlerRegistry {
  private handlers = new Map<Function, RelationshipHandler<any>>();

  register<T extends DomainEntity>(
    entityClass: new (...args: any[]) => T,
    handler: RelationshipHandler<T>,
  ): void {
    this.handlers.set(entityClass, handler);
  }

  resolve<T extends DomainEntity>(entity: T): RelationshipHandler<T> | null {
    // Walk prototype chain, same pattern as MetadataRegistry
    let proto = Object.getPrototypeOf(entity);
    while (proto) {
      const handler = this.handlers.get(proto.constructor);
      if (handler) return handler;
      proto = Object.getPrototypeOf(proto);
    }
    return null;
  }

  clear(): void {
    this.handlers.clear();
  }
}
