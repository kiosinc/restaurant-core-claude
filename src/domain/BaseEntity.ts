import { v4 as uuidv4 } from 'uuid';

export interface BaseEntity {
  readonly Id: string;
  readonly created: Date;
  updated: Date;
  readonly isDeleted: boolean;
}

export function generateId(): string {
  return uuidv4();
}

export function baseEntityDefaults(input?: Partial<BaseEntity>): BaseEntity {
  const now = new Date();
  return {
    Id: input?.Id ?? generateId(),
    created: input?.created ?? now,
    updated: input?.updated ?? now,
    isDeleted: input?.isDeleted ?? false,
  };
}
