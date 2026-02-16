import { FieldValue } from 'firebase-admin/firestore';
import { BaseEntity } from '../../../domain/BaseEntity';
import { ParentUpdate } from '../../../domain/services/CatalogCascadeService';
import { RelationshipHandler } from './RelationshipHandler';

export interface CascadeHandlerConfig<T extends BaseEntity> {
  parentCollection: (businessId: string) => FirebaseFirestore.CollectionReference;
  parentQuery: (entity: T) => [field: string, op: FirebaseFirestore.WhereFilterOp, value: any];
  onSaved: (entity: T, parentIds: string[]) => ParentUpdate[];
  onDeleted: (entity: T, parentIds: string[]) => ParentUpdate[];
}

export class CascadeRelationshipHandler<T extends BaseEntity> implements RelationshipHandler<T> {
  constructor(private config: CascadeHandlerConfig<T>) {}

  async onSet(entity: T, businessId: string, t: FirebaseFirestore.Transaction): Promise<void> {
    const parentIds = await this.queryParentIds(entity, businessId, t);
    this.applyUpdates(this.config.onSaved(entity, parentIds), this.config.parentCollection(businessId), t);
  }

  async onDelete(entity: T, businessId: string, t: FirebaseFirestore.Transaction): Promise<void> {
    const parentIds = await this.queryParentIds(entity, businessId, t);
    this.applyUpdates(this.config.onDeleted(entity, parentIds), this.config.parentCollection(businessId), t);
  }

  private async queryParentIds(entity: T, businessId: string, t: FirebaseFirestore.Transaction): Promise<string[]> {
    const [field, op, value] = this.config.parentQuery(entity);
    const snapshot = await t.get(this.config.parentCollection(businessId).where(field, op, value));
    return snapshot.docs.map((d) => d.id);
  }

  private applyUpdates(
    updates: ParentUpdate[],
    collectionRef: FirebaseFirestore.CollectionReference,
    transaction: FirebaseFirestore.Transaction,
  ): void {
    for (const { parentId, update } of updates) {
      const data: Record<string, any> = {
        ...update.fieldsToSet,
        ...Object.fromEntries(update.fieldsToDelete.map((f) => [f, FieldValue.delete()])),
        ...Object.fromEntries(Object.entries(update.arrayFieldRemovals).map(([f, v]) => [f, FieldValue.arrayRemove(v)])),
      };
      transaction.update(collectionRef.doc(parentId), data);
    }
  }
}
