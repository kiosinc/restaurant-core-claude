import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { DomainEntity } from '../../domain/DomainEntity';
import { Repository } from '../Repository';
import { MetadataRegistry } from '../MetadataRegistry';
import { RelationshipHandlerRegistry } from './handlers/RelationshipHandlerRegistry';

export interface FirestoreRepositoryConfig<T extends DomainEntity> {
  collectionRef(businessId: string): FirebaseFirestore.CollectionReference;
  toFirestore(entity: T): FirebaseFirestore.DocumentData;
  fromFirestore(data: FirebaseFirestore.DocumentData, id: string, businessId: string): T;
}

export abstract class FirestoreRepository<T extends DomainEntity>
  implements Repository<T>
{
  constructor(
    protected readonly metadataRegistry: MetadataRegistry,
    protected readonly relationshipHandlerRegistry?: RelationshipHandlerRegistry,
  ) {}

  protected abstract config(): FirestoreRepositoryConfig<T>;

  async get(businessId: string, id: string): Promise<T | null> {
    const cfg = this.config();
    const docRef = cfg.collectionRef(businessId).doc(id);
    const snapshot = await docRef.get();
    if (!snapshot.exists) return null;
    const data = this.dateify(snapshot.data() as Record<string, any>);
    return cfg.fromFirestore(data, snapshot.id, businessId);
  }

  async set(entity: T, businessId: string): Promise<void> {
    const cfg = this.config();
    const docRef = cfg.collectionRef(businessId).doc(entity.Id);
    const data = cfg.toFirestore(entity);
    const metaLinks = this.metadataRegistry.getMetaLinks(entity, businessId);
    const metadata = this.metadataRegistry.getMetadata(entity);

    const handler = this.relationshipHandlerRegistry?.resolve(entity);

    const db = getFirestore();
    await db.runTransaction(async (transaction) => {
      if (handler) {
        if (entity.isDeleted) {
          await handler.onDelete(entity, businessId, transaction);
        } else {
          await handler.onSet(entity, businessId, transaction);
        }
      }
      transaction.set(docRef, data);
      for (const link of metaLinks) {
        const metaDocRef = db.doc(link.documentPath);
        transaction.update(metaDocRef, { [link.fieldPath]: metadata });
      }
    });
  }

  async update(entity: T, businessId: string): Promise<void> {
    const cfg = this.config();
    const docRef = cfg.collectionRef(businessId).doc(entity.Id);
    const data = cfg.toFirestore(entity);
    await docRef.update(data);
  }

  async delete(businessId: string, id: string): Promise<void> {
    const entity = await this.get(businessId, id);
    if (!entity) return;

    const cfg = this.config();
    const docRef = cfg.collectionRef(businessId).doc(id);
    const metaLinks = this.metadataRegistry.getMetaLinks(entity, businessId);

    const handler = this.relationshipHandlerRegistry?.resolve(entity);

    const db = getFirestore();
    await db.runTransaction(async (transaction) => {
      if (handler) {
        await handler.onDelete(entity, businessId, transaction);
      }
      transaction.delete(docRef);
      for (const link of metaLinks) {
        const metaDocRef = db.doc(link.documentPath);
        transaction.update(metaDocRef, { [link.fieldPath]: FieldValue.delete() });
      }
    });
  }

  async findByLinkedObject(
    businessId: string,
    linkedObjectId: string,
    provider: string,
  ): Promise<T | null> {
    const cfg = this.config();
    const query = cfg
      .collectionRef(businessId)
      .where(`linkedObjects.${provider}.linkedObjectId`, '==', linkedObjectId);
    const snapshot = await query.get();
    if (snapshot.docs.length === 0) return null;
    if (snapshot.docs.length > 1) {
      throw new Error(
        `Multiple entities found for linkedObjectId '${linkedObjectId}' with provider '${provider}'`,
      );
    }
    const doc = snapshot.docs[0];
    const data = this.dateify(doc.data() as Record<string, any>);
    return cfg.fromFirestore(data, doc.id, businessId);
  }

  protected dateify(object: Record<string, any>): Record<string, any> {
    for (const key of Object.keys(object)) {
      const value = object[key];
      if (value === null || value === undefined || typeof value !== 'object') continue;
      if (typeof value.toDate === 'function') {
        object[key] = value.toDate();
      } else {
        this.dateify(value);
      }
    }
    return object;
  }
}
