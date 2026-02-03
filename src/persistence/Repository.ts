import { DomainEntity } from '../domain/DomainEntity';

export interface Repository<T extends DomainEntity> {
  get(businessId: string, id: string): Promise<T | null>;
  set(entity: T, businessId: string): Promise<void>;
  update(entity: T, businessId: string): Promise<void>;
  delete(businessId: string, id: string): Promise<void>;
  findByLinkedObject(
    businessId: string,
    linkedObjectId: string,
    provider: string,
  ): Promise<T | null>;
}
