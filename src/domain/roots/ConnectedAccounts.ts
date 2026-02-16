import { BaseEntity, baseEntityDefaults } from '../BaseEntity';

export interface ConnectedAccounts extends BaseEntity {
  tokens: { [provider: string]: { [key: string]: string } };
}

export function createConnectedAccounts(input: Partial<ConnectedAccounts>): ConnectedAccounts {
  return {
    ...baseEntityDefaults(input),
    tokens: input.tokens ?? {},
  };
}
