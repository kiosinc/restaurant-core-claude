import { BaseEntity } from '../../../domain/BaseEntity';

export function baseFieldsToFirestore(entity: BaseEntity) {
  return {
    created: entity.created.toISOString(),
    updated: entity.updated.toISOString(),
    isDeleted: entity.isDeleted,
  };
}

export function baseFieldsFromFirestore(data: FirebaseFirestore.DocumentData, id: string) {
  return {
    Id: id,
    created: new Date(data.created),
    updated: new Date(data.updated),
    isDeleted: data.isDeleted as boolean,
  };
}

