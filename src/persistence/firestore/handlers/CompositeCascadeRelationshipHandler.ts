import { BaseEntity } from '../../../domain/BaseEntity';
import { RelationshipHandler } from './RelationshipHandler';

/**
 * Delegates onSet/onDelete to multiple child handlers via Promise.all.
 * Used to support multi-parent relationships (e.g., Product -> Category AND MenuGroup).
 */
export class CompositeCascadeRelationshipHandler<T extends BaseEntity> implements RelationshipHandler<T> {
  constructor(private handlers: RelationshipHandler<T>[]) {}

  async onSet(entity: T, businessId: string, transaction: FirebaseFirestore.Transaction): Promise<void> {
    await Promise.all(this.handlers.map((h) => h.onSet(entity, businessId, transaction)));
  }

  async onDelete(entity: T, businessId: string, transaction: FirebaseFirestore.Transaction): Promise<void> {
    await Promise.all(this.handlers.map((h) => h.onDelete(entity, businessId, transaction)));
  }
}
