import { describe, it, expect } from 'vitest';
import {
  Business, BusinessMember, createBusinessMember, createBusinessRoot, BusinessType, Role,
} from '../Business';
import { ValidationError } from '../../validation';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createProps(overrides: Partial<Business> = {}) {
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
    const biz = createBusinessRoot(props);
    expect(biz.agent).toBe('ios-device');
    expect(biz.createdBy).toBe('uid-123');
    expect(biz.type).toBe(BusinessType.restaurant);
    expect(biz.businessProfile.name).toBe('Test Restaurant');
    expect(biz.roles['uid-123']).toBe(Role.owner);
  });

  it('auto-generates UUID when no Id provided', () => {
    const biz = createBusinessRoot(createProps());
    expect(biz.Id).toMatch(UUID_REGEX);
  });

  it('BusinessType enum has expected values', () => {
    expect(BusinessType.restaurant).toBe('restaurant');
  });

  it('Role enum has expected values', () => {
    expect(Role.sysadmin).toBe('sysadmin');
    expect(Role.owner).toBe('owner');
  });

  it('defaults roles to {} when nullish', () => {
    const biz = createBusinessRoot(createProps({ roles: undefined as any }));
    expect(biz.roles).toEqual({});
  });

  it('defaults members to {} when nullish', () => {
    const biz = createBusinessRoot(createProps({ members: undefined }));
    expect(biz.members).toEqual({});
  });

  it('preserves a supplied members map', () => {
    const members: { [uid: string]: BusinessMember } = {
      'uid-123': createBusinessMember({ role: 'admin', addedAt: 1_700_000_000_000, addedBy: 'uid-123' }),
    };
    const biz = createBusinessRoot(createProps({ members }));
    expect(biz.members['uid-123'].role).toBe('admin');
    expect(biz.members['uid-123'].status).toBe('active');
  });

  it('members and roles coexist — the legacy map is not replaced (contract §3.2 dual-write)', () => {
    const biz = createBusinessRoot(createProps({
      roles: { 'uid-123': Role.owner },
      members: {
        'uid-123': createBusinessMember({ role: 'admin', addedAt: 1_700_000_000_000, addedBy: 'uid-123' }),
      },
    }));
    expect(biz.roles['uid-123']).toBe(Role.owner);
    expect(biz.members['uid-123'].role).toBe('admin');
  });

  it('stores BusinessProfile with nested structure', () => {
    const biz = createBusinessRoot(createProps({
      businessProfile: {
        name: 'My Place',
        address: { line1: '123 Main St', city: 'Anytown', state: 'CA', postalCode: '12345', country: 'US' },
      },
    }));
    expect(biz.businessProfile.name).toBe('My Place');
    expect(biz.businessProfile.address?.line1).toBe('123 Main St');
  });

  it('has BaseEntity fields', () => {
    const biz = createBusinessRoot(createProps());
    expect(biz.created).toBeInstanceOf(Date);
    expect(biz.updated).toBeInstanceOf(Date);
    expect(biz.isDeleted).toBe(false);
  });

  it('creates without Firebase', () => {
    const biz = createBusinessRoot(createProps());
    expect(biz).toBeDefined();
    expect(biz.Id).toBeDefined();
  });

  describe('validation', () => {
    it('throws for empty agent', () => {
      expect(() => createBusinessRoot(createProps({ agent: '' }))).toThrow(ValidationError);
    });

    it('throws for empty createdBy', () => {
      expect(() => createBusinessRoot(createProps({ createdBy: '' }))).toThrow(ValidationError);
    });
  });
});
