import { BaseEntity } from '../../../domain/BaseEntity';

/**
 * Handles cross-entity relationship updates when an entity is saved or deleted.
 * Replaces the instanceof chains in FirestoreWriter.setT()/deleteT().
 */
export interface RelationshipHandler<T extends BaseEntity> {
  /** Update related entities when this entity is saved */
  onSet(
    entity: T,
    businessId: string,
    transaction: FirebaseFirestore.Transaction,
  ): Promise<void>;

  /** Clean up related entities when this entity is deleted */
  onDelete(
    entity: T,
    businessId: string,
    transaction: FirebaseFirestore.Transaction,
  ): Promise<void>;
}
