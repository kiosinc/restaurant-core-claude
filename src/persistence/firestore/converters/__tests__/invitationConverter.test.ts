import { describe, it, expect, vi } from 'vitest';
import { undefinedPaths } from '../../../../domain/__tests__/helpers/undefinedPaths';
import { BusinessInvitation, createBusinessInvitation } from '../../../../domain/roots/Business';
import { PathResolver } from '../../PathResolver';
import { invitationConverter } from '../invitationConverter';

const smsInvitation = () => createBusinessInvitation({
  channel: 'sms',
  phoneNumber: '+14155550132',
  role: 'regular',
  invitedBy: 'user-1',
});

const emailInvitation = () => createBusinessInvitation({
  channel: 'email',
  email: 'chef@example.com',
  role: 'admin',
  invitedBy: 'user-1',
});

describe('invitationConverter', () => {
  it('round-trips an sms invitation', () => {
    const invite = smsInvitation();
    const written = invitationConverter.toFirestore(invite);
    expect(invitationConverter.fromFirestore(written, invite.id, 'biz-1')).toEqual(invite);
  });

  it('round-trips an email invitation', () => {
    const invite = emailInvitation();
    const written = invitationConverter.toFirestore(invite);
    expect(invitationConverter.fromFirestore(written, invite.id, 'biz-1')).toEqual(invite);
  });

  it('omits an absent phoneNumber rather than writing undefined', () => {
    // `toEqual` cannot see this: an absent key and an `undefined`-valued one compare equal to it,
    // while Firestore rejects the whole document for the second. Hence `in` plus `undefinedPaths`.
    const written = invitationConverter.toFirestore(emailInvitation());
    expect('phoneNumber' in written).toBe(false);
    expect(undefinedPaths(written)).toEqual([]);
  });

  it('omits an absent email rather than writing undefined', () => {
    const written = invitationConverter.toFirestore(smsInvitation());
    expect('email' in written).toBe(false);
    expect(undefinedPaths(written)).toEqual([]);
  });

  it('strips an explicitly undefined contact field instead of writing the key', () => {
    // The reason this converter calls `stripUndefined` itself rather than relying on
    // `createConverter`'s boundary (it is hand-written, so it has none): the factory omits the
    // unused channel's key, but an untyped caller — or a hydrate of a legacy document — can hand
    // us `phoneNumber: undefined`, and consumers write with `ignoreUndefinedProperties` off,
    // where that single value rejects the whole document (#200, #204).
    const invite = { ...emailInvitation(), phoneNumber: undefined } as BusinessInvitation;
    const written = invitationConverter.toFirestore(invite);
    expect('phoneNumber' in written).toBe(false);
    expect(undefinedPaths(written)).toEqual([]);
  });

  it('round-trips an invitation with a name', () => {
    const invite = createBusinessInvitation({
      channel: 'sms', phoneNumber: '+14155550132', name: 'Sam', role: 'regular', invitedBy: 'user-1',
    });
    const written = invitationConverter.toFirestore(invite);
    expect(invitationConverter.fromFirestore(written, invite.id, 'biz-1')).toEqual(invite);
    expect(invitationConverter.fromFirestore(written, invite.id, 'biz-1').name).toBe('Sam');
  });

  it('omits an absent name rather than writing undefined', () => {
    const written = invitationConverter.toFirestore(smsInvitation());
    expect('name' in written).toBe(false);
    expect(undefinedPaths(written)).toEqual([]);
  });

  it('hydrates without a name key when the document has none', () => {
    // The conditional spread in `fromFirestore` is the thing under test: a document written before
    // `name` existed must hydrate to an absent key, not a present-and-`undefined` one.
    const written = invitationConverter.toFirestore(smsInvitation());
    expect('name' in invitationConverter.fromFirestore(written, 'inv-1', 'biz-1')).toBe(false);
  });

  it('strips an explicitly undefined name instead of writing the key', () => {
    const invite = { ...smsInvitation(), name: undefined } as BusinessInvitation;
    const written = invitationConverter.toFirestore(invite);
    expect('name' in written).toBe(false);
    expect(undefinedPaths(written)).toEqual([]);
  });

  it('writes both contact fields when both are present', () => {
    const invite: BusinessInvitation = {
      ...smsInvitation(),
      email: 'chef@example.com',
    };
    const written = invitationConverter.toFirestore(invite) as { phoneNumber: string; email: string };
    expect(written.phoneNumber).toBe('+14155550132');
    expect(written.email).toBe('chef@example.com');
    expect(invitationConverter.fromFirestore(written, invite.id, 'biz-1')).toEqual(invite);
  });

  it('does not write id into the document body', () => {
    const invite = smsInvitation();
    const written = invitationConverter.toFirestore(invite);
    expect('id' in written).toBe(false);
    // Anti-tautology: something other than `id` did make it through.
    expect(Object.keys(written).length).toBeGreaterThan(0);
  });

  it('stamps id from the snapshot id on read', () => {
    const written = invitationConverter.toFirestore(smsInvitation());
    expect(invitationConverter.fromFirestore(written, 'inv-from-snapshot', 'biz-1').id)
      .toBe('inv-from-snapshot');
  });

  it('preserves both locationScope shapes', () => {
    const scoped: BusinessInvitation = { ...smsInvitation(), locationScope: ['loc-1', 'loc-2'] };
    const writtenScoped = invitationConverter.toFirestore(scoped);
    expect(invitationConverter.fromFirestore(writtenScoped, scoped.id, 'biz-1').locationScope)
      .toEqual(['loc-1', 'loc-2']);

    const all = smsInvitation();
    const writtenAll = invitationConverter.toFirestore(all);
    expect(invitationConverter.fromFirestore(writtenAll, all.id, 'biz-1').locationScope).toBe('all');
  });

  it('preserves createdAt and expiresAt as numbers', () => {
    const invite = createBusinessInvitation({
      channel: 'sms', phoneNumber: '+14155550132', role: 'regular', invitedBy: 'user-1', createdAt: 1_700_000_000_000,
    });
    const hydrated = invitationConverter.fromFirestore(
      invitationConverter.toFirestore(invite), invite.id, 'biz-1',
    );
    expect(typeof hydrated.createdAt).toBe('number');
    expect(typeof hydrated.expiresAt).toBe('number');
    expect(hydrated.createdAt).toBe(1_700_000_000_000);
    expect(hydrated.expiresAt).toBe(invite.expiresAt);
  });

  it('never mints a token on hydration', () => {
    // The guard against routing reads through `createBusinessInvitation`, which mints a fresh
    // CSPRNG token whenever one is absent — silently rotating the credential the recipient holds.
    const invite = smsInvitation();
    const written = invitationConverter.toFirestore(invite);
    expect(invitationConverter.fromFirestore(written, invite.id, 'biz-1').token).toBe(invite.token);
    // Two hydrations of the same document are identical; a minting read would differ per call.
    expect(invitationConverter.fromFirestore(written, invite.id, 'biz-1'))
      .toEqual(invitationConverter.fromFirestore(written, invite.id, 'biz-1'));
    // A document that lost its token stays without one — it is not re-issued behind the reader.
    const { token: _token, ...tokenless } = written;
    expect(invitationConverter.fromFirestore(tokenless, invite.id, 'biz-1').token).toBeUndefined();
  });

  it('resolves its collection through PathResolver.invitationsCollection', () => {
    // Identity only — actually resolving the reference would call `getFirestore()`.
    const spy = vi.spyOn(PathResolver, 'invitationsCollection')
      .mockReturnValue({} as FirebaseFirestore.CollectionReference);
    invitationConverter.collectionRef('biz-1');
    expect(spy).toHaveBeenCalledWith('biz-1');
    spy.mockRestore();
  });

  it('declares the modelKey the store and consumers key off', () => {
    expect(invitationConverter.modelKey).toBe('businessInvitation');
  });
});
