import { describe, it, expect } from 'vitest';
import { LinkedObjectRef, LinkedObjectMap } from '../LinkedObjectRef';
import { OrderInput } from '../orders/Order';
import { createTestOrderInput } from './helpers/OrderFixtures';

describe('LinkedObjectRef', () => {
  it('holds linkedObjectId', () => {
    const ref: LinkedObjectRef = { linkedObjectId: 'ext-123' };
    expect(ref.linkedObjectId).toBe('ext-123');
  });

  it('LinkedObjectMap holds provider-keyed refs', () => {
    const map: LinkedObjectMap = {
      square: { linkedObjectId: 'sq-1' },
      system: { linkedObjectId: 'sys-1' },
    };
    expect(map['square'].linkedObjectId).toBe('sq-1');
    expect(map['system'].linkedObjectId).toBe('sys-1');
  });

  it('LinkedObjectMap allows any string key', () => {
    const map: LinkedObjectMap = {
      'custom-provider': { linkedObjectId: 'cp-1' },
    };
    expect(map['custom-provider'].linkedObjectId).toBe('cp-1');
  });

  it('matches Order usage (assignable to OrderInput.linkedObjects value type)', () => {
    const ref: LinkedObjectRef = { linkedObjectId: 'sq-order-1' };
    const linked: { [Id: string]: LinkedObjectRef } = { square: ref };
    const input: OrderInput = createTestOrderInput({ linkedObjects: linked });
    expect(input.linkedObjects!['square'].linkedObjectId).toBe('sq-order-1');
  });

  it('works without Firebase dependency', () => {
    const ref: LinkedObjectRef = { linkedObjectId: 'no-firebase' };
    expect(ref).toBeDefined();
  });
});
