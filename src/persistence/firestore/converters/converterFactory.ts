import { FirestoreRepositoryConfig } from '../FirestoreRepository';
import { BaseEntity } from '../../../domain/BaseEntity';
import { stripUndefined } from '../sanitize';
import { baseFieldsToFirestore, baseFieldsFromFirestore } from './baseFields';

export interface FieldTransform<T> {
  toFirestore?: (entity: T) => Record<string, unknown>;
  fromFirestore?: (data: FirebaseFirestore.DocumentData, businessId: string) => Record<string, unknown>;
}

export function createConverter<T extends BaseEntity>(
  modelKey: string,
  collectionRef: (businessId: string) => FirebaseFirestore.CollectionReference,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Each model has a different input type; Firestore data is untyped at read time
  createFn: (input: any) => T,
  fieldTransform?: FieldTransform<T>,
): FirestoreRepositoryConfig<T> {
  return {
    modelKey,
    collectionRef,
    // Spreading an entity carries its `undefined`-valued keys along, and every `.withConverter()`
    // consumer (businesses, childs, webhook-receiver) writes this output straight to a Firestore
    // instance that has not enabled `ignoreUndefinedProperties` — so the write is rejected outright.
    // A library cannot set that flag on a consumer's instance; stripping here is the equivalent, and
    // it is the one point every converter-based write funnels through. See #200, #204.
    toFirestore(entity: T): FirebaseFirestore.DocumentData {
      const { Id: _Id, ...fields } = entity;
      return stripUndefined({
        ...fields,
        ...(fieldTransform?.toFirestore?.(entity) ?? {}),
        ...baseFieldsToFirestore(entity),
      });
    },
    fromFirestore(data: FirebaseFirestore.DocumentData, id: string, businessId: string): T {
      return createFn({
        ...data,
        ...baseFieldsFromFirestore(data, id),
        ...(fieldTransform?.fromFirestore?.(data, businessId) ?? {}),
      });
    },
  };
}
