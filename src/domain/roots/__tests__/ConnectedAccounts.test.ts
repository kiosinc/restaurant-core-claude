import { describe, it, expect } from 'vitest';
import { ConnectedAccounts } from '../ConnectedAccounts';
import { DomainEntity } from '../../DomainEntity';

describe('ConnectedAccounts', () => {
  it('constructs with all props', () => {
    const tokens = { square: { accessToken: 'tok-123', refreshToken: 'ref-456' } };
    const ca = new ConnectedAccounts({ tokens });
    expect(ca.tokens).toEqual(tokens);
  });

  it('defaults tokens to {} when nullish', () => {
    const ca = new ConnectedAccounts({ tokens: undefined as any });
    expect(ca.tokens).toEqual({});
  });

  it('instantiates without Firebase', () => {
    const ca = new ConnectedAccounts({ tokens: {} });
    expect(ca).toBeInstanceOf(DomainEntity);
    expect(ca).toBeInstanceOf(ConnectedAccounts);
  });
});
