import { EventProps } from '../../connected-accounts/Event';

export function createTestEventProps(overrides?: Partial<EventProps>): EventProps {
  return {
    provider: 'square',
    type: 'catalog',
    isSync: true,
    ...overrides,
  };
}
