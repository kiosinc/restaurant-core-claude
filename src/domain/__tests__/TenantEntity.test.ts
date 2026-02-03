import { describe, it, expect } from 'vitest';
import { TenantEntity, TenantEntityProps } from '../TenantEntity';

class TestTenantEntity extends TenantEntity {
  constructor(props: TenantEntityProps) {
    super(props);
  }
}

describe('TenantEntity', () => {
  it('stores businessId', () => {
    const entity = new TestTenantEntity({ businessId: 'biz-1' });
    expect(entity.businessId).toBe('biz-1');
  });

  it('inherits DomainEntity fields', () => {
    const entity = new TestTenantEntity({ businessId: 'biz-1' });
    expect(entity.Id).toBeDefined();
    expect(entity.created).toBeInstanceOf(Date);
    expect(entity.updated).toBeInstanceOf(Date);
    expect(entity.isDeleted).toBe(false);
  });

  it('businessId is readonly', () => {
    const entity = new TestTenantEntity({ businessId: 'biz-1' });
    // @ts-expect-error businessId is readonly
    entity.businessId = 'biz-2';
  });
});
