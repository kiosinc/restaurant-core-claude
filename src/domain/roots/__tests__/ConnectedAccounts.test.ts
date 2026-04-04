import { describe, it, expect } from 'vitest';
import { createConnectedAccounts } from '../ConnectedAccounts';

describe('ConnectedAccounts', () => {
  it('constructs with all props', () => {
    const tokens = { square: { accessToken: 'tok-123', refreshToken: 'ref-456' } };
    const ca = createConnectedAccounts({ tokens });
    expect(ca.tokens).toEqual(tokens);
  });

  it('defaults tokens to {} when nullish', () => {
    const ca = createConnectedAccounts({});
    expect(ca.tokens).toEqual({});
  });

  it('instantiates without Firebase', () => {
    const ca = createConnectedAccounts({ tokens: {} });
    expect(ca).toBeDefined();
    expect(ca.Id).toBeDefined();
  });
});
