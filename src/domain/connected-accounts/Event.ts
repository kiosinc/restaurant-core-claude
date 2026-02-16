import { BaseEntity, baseEntityDefaults } from '../BaseEntity';
import { requireNonEmptyString } from '../validation';

export interface Event extends BaseEntity {
  readonly provider: string;
  readonly type: string;
  isSync: boolean;
  queueCap: number;
  queueCount: number;
  timestamp?: Date;
}

export function createEvent(input: Partial<Event> & { provider: string; type: string; isSync: boolean }): Event {
  requireNonEmptyString('provider', input.provider);
  requireNonEmptyString('type', input.type);
  return {
    ...baseEntityDefaults({ ...input, Id: input.Id ?? eventIdentifier(input.provider, input.type) }),
    provider: input.provider,
    type: input.type,
    isSync: input.isSync,
    queueCap: input.queueCap ?? -1,
    queueCount: input.queueCount ?? 0,
    timestamp: input.timestamp,
  };
}

export function eventIdentifier(provider: string, type: string): string {
  return `${provider}.${type}`;
}
