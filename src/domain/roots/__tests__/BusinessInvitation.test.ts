import { describe, it, expect } from 'vitest';
import { INVITE_TTL_MS, createBusinessInvitation } from '../Business';
import { ValidationError } from '../../validation';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// 32 CSPRNG bytes rendered base64url: 43 unpadded characters from the URL-safe alphabet.
const TOKEN_REGEX = /^[A-Za-z0-9_-]{43}$/;

const SMS_INPUT = {
  channel: 'sms' as const,
  phoneNumber: '+14155550132',
  role: 'regular' as const,
  invitedBy: 'uid-owner',
};

const EMAIL_INPUT = {
  channel: 'email' as const,
  email: 'Chef@Example.COM',
  role: 'regular' as const,
  invitedBy: 'uid-owner',
};

describe('createBusinessInvitation', () => {
  it('mints a uuid id and a distinct opaque token per call', () => {
    const first = createBusinessInvitation(SMS_INPUT);
    const second = createBusinessInvitation(SMS_INPUT);
    expect(first.id).toMatch(UUID_REGEX);
    expect(second.id).toMatch(UUID_REGEX);
    expect(first.id).not.toBe(second.id);
    expect(first.token).toMatch(TOKEN_REGEX);
    expect(second.token).toMatch(TOKEN_REGEX);
    expect(first.token).not.toBe(second.token);
  });

  it('honours a supplied id, token, createdAt and status', () => {
    const invite = createBusinessInvitation({
      ...SMS_INPUT,
      id: 'inv-1',
      token: 'supplied-token',
      createdAt: 1_700_000_000_000,
      status: 'accepted',
    });
    expect(invite.id).toBe('inv-1');
    expect(invite.token).toBe('supplied-token');
    expect(invite.createdAt).toBe(1_700_000_000_000);
    expect(invite.status).toBe('accepted');
  });

  it('expires exactly INVITE_TTL_MS after createdAt', () => {
    const invite = createBusinessInvitation(SMS_INPUT);
    expect(invite.expiresAt - invite.createdAt).toBe(INVITE_TTL_MS);
    expect(INVITE_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('defaults status to pending', () => {
    expect(createBusinessInvitation(SMS_INPUT).status).toBe('pending');
  });

  it('defaults permissions from the role and scope to all', () => {
    const invite = createBusinessInvitation(SMS_INPUT);
    expect(invite.permissions).toEqual({
      kiosk: true, menu: true, profile: true, account: false,
    });
    expect(invite.locationScope).toBe('all');
  });

  it('honours explicit permissions and an array scope', () => {
    const invite = createBusinessInvitation({
      ...SMS_INPUT,
      role: 'custom',
      permissions: {
        kiosk: true, menu: false, profile: false, account: false,
      },
      locationScope: ['loc-1'],
    });
    expect(invite.permissions).toEqual({
      kiosk: true, menu: false, profile: false, account: false,
    });
    expect(invite.locationScope).toEqual(['loc-1']);
  });

  describe('sms channel', () => {
    it('stores the E.164 number and leaves email absent, not undefined', () => {
      const invite = createBusinessInvitation(SMS_INPUT);
      expect(invite.phoneNumber).toBe('+14155550132');
      expect('email' in invite).toBe(false);
    });

    it('throws for a number that has not been canonicalized to E.164', () => {
      expect(() => createBusinessInvitation({ ...SMS_INPUT, phoneNumber: '4155550132' }))
        .toThrow(ValidationError);
    });

    it('throws when the number is missing', () => {
      expect(() => createBusinessInvitation({ ...SMS_INPUT, phoneNumber: undefined }))
        .toThrow(ValidationError);
    });
  });

  describe('email channel', () => {
    it('trims and lower-cases the address and leaves phoneNumber absent', () => {
      const invite = createBusinessInvitation({ ...EMAIL_INPUT, email: '  Chef@Example.COM  ' });
      expect(invite.email).toBe('chef@example.com');
      expect('phoneNumber' in invite).toBe(false);
    });

    it('throws when the address is missing', () => {
      expect(() => createBusinessInvitation({ ...EMAIL_INPUT, email: undefined }))
        .toThrow(ValidationError);
    });
  });

  describe('validation', () => {
    it('throws for an unknown channel', () => {
      expect(() => createBusinessInvitation({ ...SMS_INPUT, channel: 'whatsapp' as never }))
        .toThrow(ValidationError);
    });

    it('throws for an unknown role', () => {
      expect(() => createBusinessInvitation({ ...SMS_INPUT, role: 'superuser' as never }))
        .toThrow(ValidationError);
    });

    it('throws for an unknown status', () => {
      expect(() => createBusinessInvitation({ ...SMS_INPUT, status: 'cancelled' as never }))
        .toThrow(ValidationError);
    });

    it('throws for an empty invitedBy', () => {
      expect(() => createBusinessInvitation({ ...SMS_INPUT, invitedBy: '   ' }))
        .toThrow(ValidationError);
    });
  });
});
