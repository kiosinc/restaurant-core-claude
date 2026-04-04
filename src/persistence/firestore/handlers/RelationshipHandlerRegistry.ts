import { BaseEntity } from '../../../domain/BaseEntity';
import { RelationshipHandler } from './RelationshipHandler';

export class RelationshipHandlerRegistry {
  private handlers = new Map<string, RelationshipHandler<any>>();

  register<T extends BaseEntity>(
    key: string,
    handler: RelationshipHandler<T>,
  ): void {
    this.handlers.set(key, handler);
  }

  resolve(key: string): RelationshipHandler<any> | null {
    return this.handlers.get(key) ?? null;
  }

  clear(): void {
    this.handlers.clear();
  }
}
