import { Event } from '../../connected-accounts/Event';

export function createTestEventInput(overrides?: Partial<Event> & { provider?: string; type?: string; isSync?: boolean }): { provider: string; type: string; isSync: boolean } & Partial<Event> {
  return {
    provider: 'square',
    type: 'catalog',
    isSync: true,
    ...overrides,
  };
}
