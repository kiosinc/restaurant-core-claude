import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { BaseEntity } from '../../domain/BaseEntity';
import { MetadataRegistry } from '../MetadataRegistry';
import { RelationshipHandlerRegistry } from './handlers/RelationshipHandlerRegistry';
import { MetaLinkDeclaration } from '../../domain/MetadataSpec';

export interface FirestoreRepositoryConfig<T> {
  modelKey: string;
  collectionRef(businessId: string): FirebaseFirestore.CollectionReference;
  toFirestore(entity: T): FirebaseFirestore.DocumentData;
  fromFirestore(data: FirebaseFirestore.DocumentData, id: string, businessId: string): T;
}

export class FirestoreRepository<T extends BaseEntity> {
  private readonly cfg: FirestoreRepositoryConfig<T>;
  protected readonly metadataRegistry: MetadataRegistry;
  protected readonly relationshipHandlerRegistry?: RelationshipHandlerRegistry;

  constructor(
    cfg: FirestoreRepositoryConfig<T>,
    metadataRegistry: MetadataRegistry,
    relationshipHandlerRegistry?: RelationshipHandlerRegistry,
  ) {
    this.cfg = cfg;
    this.metadataRegistry = metadataRegistry;
    this.relationshipHandlerRegistry = relationshipHandlerRegistry;
  }

  async get(businessId: string, id: string): Promise<T | null> {
    const docRef = this.cfg.collectionRef(businessId).doc(id);
    const snapshot = await docRef.get();
    if (!snapshot.exists) return null;
    const data = this.dateify(snapshot.data() as Record<string, any>);
    return this.cfg.fromFirestore(data, snapshot.id, businessId);
  }

  async set(entity: T, businessId: string): Promise<void> {
    const docRef = this.cfg.collectionRef(businessId).doc(entity.Id);
    const data = JSON.parse(JSON.stringify(this.cfg.toFirestore(entity)));
    const metaLinks = this.resolveMetaLinks(entity, businessId);
    const metadata = this.metadataRegistry.getMetadata(this.cfg.modelKey, entity);
    const handler = this.resolveHandler();

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
    const docRef = this.cfg.collectionRef(businessId).doc(entity.Id);
    const data = JSON.parse(JSON.stringify(this.cfg.toFirestore(entity)));
    await docRef.update(data);
  }

  async delete(businessId: string, id: string): Promise<void> {
    const entity = await this.get(businessId, id);
    if (!entity) return;

    const docRef = this.cfg.collectionRef(businessId).doc(id);
    const metaLinks = this.resolveMetaLinks(entity, businessId);
    const handler = this.resolveHandler();

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
    const query = this.cfg
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
    return this.cfg.fromFirestore(data, doc.id, businessId);
  }

  private resolveHandler() {
    return this.relationshipHandlerRegistry?.resolve(this.cfg.modelKey) ?? null;
  }

  private resolveMetaLinks(entity: T, businessId: string): MetaLinkDeclaration[] {
    return this.metadataRegistry.getMetaLinks(this.cfg.modelKey, entity, businessId);
  }

  private dateify(object: Record<string, any>): Record<string, any> {
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
