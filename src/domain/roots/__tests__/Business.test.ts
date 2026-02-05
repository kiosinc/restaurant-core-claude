import { describe, it, expect } from 'vitest';
import { Business, BusinessProps, BusinessType, Role } from '../Business';
import { DomainEntity } from '../../DomainEntity';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createProps(overrides: Partial<BusinessProps> = {}): BusinessProps {
  return {
    agent: 'ios-device',
    createdBy: 'uid-123',
    type: BusinessType.restaurant,
    businessProfile: { name: 'Test Restaurant' },
    roles: { 'uid-123': Role.owner },
    ...overrides,
  };
}

describe('Business', () => {
  it('constructs with all props', () => {
    const props = createProps();
    const biz = new Business(props);
    expect(biz.agent).toBe('ios-device');
    expect(biz.createdBy).toBe('uid-123');
    expect(biz.type).toBe(BusinessType.restaurant);
    expect(biz.businessProfile.name).toBe('Test Restaurant');
    expect(biz.roles['uid-123']).toBe(Role.owner);
  });

  it('auto-generates UUID when no Id provided', () => {
    const biz = new Business(createProps());
    expect(biz.Id).toMatch(UUID_V4_REGEX);
  });

  it('BusinessType enum has expected values', () => {
    expect(BusinessType.restaurant).toBe('restaurant');
  });

  it('Role enum has expected values', () => {
    expect(Role.sysadmin).toBe('sysadmin');
    expect(Role.owner).toBe('owner');
  });

  it('defaults roles to {} when nullish', () => {
    const biz = new Business(createProps({ roles: undefined as any }));
    expect(biz.roles).toEqual({});
  });

  it('stores BusinessProfile with nested structure', () => {
    const biz = new Business(createProps({
      businessProfile: {
        name: 'My Place',
        address: { line1: '123 Main St', city: 'Anytown', state: 'CA', postalCode: '12345', country: 'US' },
      },
    }));
    expect(biz.businessProfile.name).toBe('My Place');
    expect(biz.businessProfile.address?.line1).toBe('123 Main St');
  });

  it('inherits DomainEntity fields', () => {
    const biz = new Business(createProps());
    expect(biz).toBeInstanceOf(DomainEntity);
    expect(biz.created).toBeInstanceOf(Date);
    expect(biz.updated).toBeInstanceOf(Date);
    expect(biz.isDeleted).toBe(false);
  });

  it('instantiates without Firebase', () => {
    const biz = new Business(createProps());
    expect(biz).toBeInstanceOf(Business);
  });
});
