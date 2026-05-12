import { BaseEntity } from '../../../domain/BaseEntity';

export function toDateSafe(value: unknown): Date {
  if (value != null && typeof (value as any).toDate === 'function') {
    return (value as any).toDate();
  }
  return new Date(value as string | number);
}

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
    created: toDateSafe(data.created),
    updated: toDateSafe(data.updated),
    isDeleted: data.isDeleted as boolean,
  };
}

