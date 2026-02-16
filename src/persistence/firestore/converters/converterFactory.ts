import { FirestoreRepositoryConfig } from '../FirestoreRepository';
import { BaseEntity } from '../../../domain/BaseEntity';
import { baseFieldsToFirestore, baseFieldsFromFirestore } from './baseFields';

export interface FieldTransform<T> {
  toFirestore?: (entity: T) => Record<string, any>;
  fromFirestore?: (data: FirebaseFirestore.DocumentData, businessId: string) => Record<string, any>;
}

export function createConverter<T extends BaseEntity>(
  modelKey: string,
  collectionRef: (businessId: string) => FirebaseFirestore.CollectionReference,
  createFn: (input: any) => T,
  fieldTransform?: FieldTransform<T>,
): FirestoreRepositoryConfig<T> {
  return {
    modelKey,
    collectionRef,
    toFirestore(entity: T): FirebaseFirestore.DocumentData {
      const { Id: _Id, ...fields } = entity;
      return {
        ...fields,
        ...(fieldTransform?.toFirestore?.(entity) ?? {}),
        ...baseFieldsToFirestore(entity),
      };
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
