import {
  describe, it, expect, vi, beforeEach, Mock,
} from 'vitest';
import { ValidationError } from '../../../domain/validation';
import { BusinessInvitation, createBusinessInvitation, InviteStatus } from '../../../domain/roots/Business';

// The shared `helpers/firestoreMocks` reference has no `set` on its doc ref, no `get` on its
// collection ref, and tracks no path. All three are needed here — the whole point of the D1
// correction is the shape of the path these writes land on — so the mock is local and records the
// chain the way `PathResolver.test.ts` does.
//
// The two refs are annotated rather than inferred because each returns the other: without the
// annotations their inferred types are mutually recursive.
interface MockDocRef {
  set: Mock;
  update: Mock;
  get: Mock;
  collection: Mock;
}

interface MockCollectionRef {
  doc: Mock;
  where: Mock;
  get: Mock;
}

let lastPath = '';

const mockQuery = { get: vi.fn() };

const mockDocRef: MockDocRef = {
  set: vi.fn(async () => undefined),
  update: vi.fn(async () => undefined),
  get: vi.fn(),
  collection: vi.fn((name: string) => {
    lastPath = `${lastPath}/${name}`;
    return mockCollectionRef;
  }),
};

const mockCollectionRef: MockCollectionRef = {
  doc: vi.fn((id: string) => {
    lastPath = `${lastPath}/${id}`;
    return mockDocRef;
  }),
  where: vi.fn(() => mockQuery),
  get: vi.fn(),
};

const mockDb = {
  collection: vi.fn((name: string) => {
    lastPath = name;
    return mockCollectionRef;
  }),
};

vi.mock('firebase-admin/firestore', () => ({ getFirestore: () => mockDb }));

import {
  invitationRef, setInvitation, getInvitation, listInvitations,
  findInvitationByToken, updateInvitationStatus,
} from '../InvitationStore';
import { invitationConverter } from '../converters/invitationConverter';

const INVITATION_PATH = 'businesses/biz-1/private/invitations/invitations/inv-1';

function makeInvitation(overrides: Partial<BusinessInvitation> = {}): BusinessInvitation {
  return {
    ...createBusinessInvitation({
      id: 'inv-1',
      channel: 'sms',
      phoneNumber: '+14155550132',
      role: 'regular',
      invitedBy: 'user-1',
      createdAt: 1_700_000_000_000,
      token: 'tok-1',
    }),
    ...overrides,
  };
}

/** A stored document as Firestore hands it back: converter output, no `id`. */
function storedDoc(invitation: BusinessInvitation = makeInvitation()) {
  return invitationConverter.toFirestore(invitation);
}

function snapshotOf(docs: Array<{ id: string; data: FirebaseFirestore.DocumentData }>) {
  return {
    empty: docs.length === 0,
    docs: docs.map((d) => ({ id: d.id, data: () => d.data })),
  };
}

describe('InvitationStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastPath = '';
  });

  it('invitationRef resolves the corrected D1 path', () => {
    invitationRef('biz-1', 'inv-1');
    expect(lastPath).toBe(INVITATION_PATH);
  });

  it('setInvitation writes converter output to the invitation doc', async () => {
    const invitation = makeInvitation();
    await setInvitation('biz-1', invitation);

    expect(lastPath).toBe(INVITATION_PATH);
    expect(mockDocRef.set).toHaveBeenCalledTimes(1);
    const [payload] = mockDocRef.set.mock.calls[0];
    expect('id' in payload).toBe(false);
    expect(payload).toEqual(invitationConverter.toFirestore(invitation));
  });

  it('setInvitation replaces the whole document rather than merging', async () => {
    // A second `{ merge: true }` argument would make a partial write leave a half-updated
    // invitation behind; an invitation is authored once, so the set is deliberately unqualified.
    await setInvitation('biz-1', makeInvitation());
    expect(mockDocRef.set.mock.calls[0]).toHaveLength(1);
  });

  it('getInvitation hydrates the document with its id stamped', async () => {
    const invitation = makeInvitation();
    mockDocRef.get.mockResolvedValue({ exists: true, id: 'inv-1', data: () => storedDoc(invitation) });

    const result = await getInvitation('biz-1', 'inv-1');
    expect(lastPath).toBe(INVITATION_PATH);
    expect(result).toEqual(invitation);
    expect(result?.id).toBe('inv-1');
  });

  it('getInvitation returns null when the document is absent', async () => {
    mockDocRef.get.mockResolvedValue({ exists: false });
    expect(await getInvitation('biz-1', 'missing')).toBeNull();
  });

  it('listInvitations returns every invitation and issues no where clause', async () => {
    mockCollectionRef.get.mockResolvedValue(snapshotOf([
      { id: 'inv-1', data: storedDoc(makeInvitation()) },
      { id: 'inv-2', data: storedDoc(makeInvitation({ id: 'inv-2', status: 'accepted' })) },
    ]));

    const result = await listInvitations('biz-1');
    expect(lastPath).toBe('businesses/biz-1/private/invitations/invitations');
    expect(mockCollectionRef.where).not.toHaveBeenCalled();
    expect(result.map((i) => i.id)).toEqual(['inv-1', 'inv-2']);
    expect(result[1].status).toBe('accepted');
  });

  it('listInvitations filters on a single equality clause when a status is given', async () => {
    // Single-field equality only, and no orderBy: both are what keep this off a composite index
    // (this repo applies indexes imperatively against live projects).
    mockQuery.get.mockResolvedValue(snapshotOf([{ id: 'inv-1', data: storedDoc() }]));

    const result = await listInvitations('biz-1', { status: 'pending' });
    expect(mockCollectionRef.where).toHaveBeenCalledWith('status', '==', 'pending');
    expect(mockCollectionRef.where).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
  });

  it('listInvitations returns an empty array for an empty collection', async () => {
    mockCollectionRef.get.mockResolvedValue(snapshotOf([]));
    expect(await listInvitations('biz-1')).toEqual([]);
  });

  it('findInvitationByToken returns the single match', async () => {
    const invitation = makeInvitation();
    mockQuery.get.mockResolvedValue(snapshotOf([{ id: 'inv-1', data: storedDoc(invitation) }]));

    const result = await findInvitationByToken('biz-1', 'tok-1');
    expect(lastPath).toBe('businesses/biz-1/private/invitations/invitations');
    expect(mockCollectionRef.where).toHaveBeenCalledWith('token', '==', 'tok-1');
    expect(result).toEqual(invitation);
  });

  it('findInvitationByToken returns null when nothing matches', async () => {
    mockQuery.get.mockResolvedValue(snapshotOf([]));
    expect(await findInvitationByToken('biz-1', 'tok-missing')).toBeNull();
  });

  it('findInvitationByToken throws when more than one document matches', async () => {
    // Two invitations sharing a bearer token is a data-integrity failure; picking one would hand
    // the accepting recipient an arbitrary membership.
    mockQuery.get.mockResolvedValue(snapshotOf([
      { id: 'inv-1', data: storedDoc() },
      { id: 'inv-2', data: storedDoc(makeInvitation({ id: 'inv-2' })) },
    ]));

    await expect(findInvitationByToken('biz-1', 'tok-1')).rejects.toThrow(/more than one invitation/);
    // The token is a credential and must not reach the message.
    await expect(findInvitationByToken('biz-1', 'tok-1')).rejects.not.toThrow(/tok-1/);
  });

  it('updateInvitationStatus issues a targeted update', async () => {
    await updateInvitationStatus('biz-1', 'inv-1', 'accepted');
    expect(lastPath).toBe(INVITATION_PATH);
    expect(mockDocRef.update).toHaveBeenCalledWith({ status: 'accepted' });
  });

  it('updateInvitationStatus rejects an unknown status before issuing any RPC', async () => {
    await expect(updateInvitationStatus('biz-1', 'inv-1', 'cancelled' as InviteStatus))
      .rejects.toBeInstanceOf(ValidationError);
    expect(mockDocRef.update).not.toHaveBeenCalled();
  });
});
