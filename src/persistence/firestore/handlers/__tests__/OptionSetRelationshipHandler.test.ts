import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OptionSet } from '../../../../domain/catalog/OptionSet';
import { OptionSetRelationshipHandler } from '../OptionSetRelationshipHandler';
import { createTestOptionSetProps } from '../../../../domain/__tests__/helpers/CatalogFixtures';

const mockUpdate = vi.fn();
const mockGet = vi.fn();
const mockWhere = vi.fn();
const mockDocRef = { get: vi.fn(), update: vi.fn(), path: '' };
const mockCollectionRef = { where: mockWhere, doc: vi.fn(() => mockDocRef) };

const mockDb = {
  collection: vi.fn(() => mockCollectionRef),
  doc: vi.fn(() => mockDocRef),
};

// Make chaining work: collection().doc() returns something with .collection()
mockCollectionRef.doc.mockReturnValue({
  ...mockDocRef,
  collection: vi.fn(() => mockCollectionRef),
  path: 'mocked/path',
});

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => mockDb,
  FieldValue: {
    delete: () => '$$FIELD_DELETE$$',
  },
}));

describe('OptionSetRelationshipHandler', () => {
  let handler: OptionSetRelationshipHandler;
  let mockTransaction: any;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new OptionSetRelationshipHandler();
    mockTransaction = { get: mockGet, update: mockUpdate };
    mockWhere.mockReturnValue({});
  });

  it('onSet queries Products containing this OptionSet', async () => {
    const os = new OptionSet(createTestOptionSetProps({ Id: 'os-1', name: 'Size', displayOrder: 1, displayTier: 0 }));
    mockGet.mockResolvedValue({ docs: [] });

    await handler.onSet(os, 'biz-1', mockTransaction);

    expect(mockWhere).toHaveBeenCalledWith('optionSets.os-1.name', '>=', '');
  });

  it('onSet updates OptionSetMeta on matching Products', async () => {
    const os = new OptionSet(createTestOptionSetProps({ Id: 'os-1', name: 'Size', displayOrder: 2, displayTier: 1 }));
    const docRef = { id: 'prod-1' };
    mockGet.mockResolvedValue({ docs: [{ ref: docRef }] });

    await handler.onSet(os, 'biz-1', mockTransaction);

    expect(mockUpdate).toHaveBeenCalledWith(docRef, {
      'optionSets.os-1': { name: 'Size', displayOrder: 2, displayTier: 1 },
    });
  });

  it('onSet no-ops when no Products match', async () => {
    const os = new OptionSet(createTestOptionSetProps({ Id: 'os-1' }));
    mockGet.mockResolvedValue({ docs: [] });

    await handler.onSet(os, 'biz-1', mockTransaction);

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('onDelete removes from Products optionSets map', async () => {
    const os = new OptionSet(createTestOptionSetProps({ Id: 'os-1' }));
    const docRef = { id: 'prod-1' };
    mockGet.mockResolvedValue({ docs: [{ ref: docRef }] });

    await handler.onDelete(os, 'biz-1', mockTransaction);

    const updateArgs = mockUpdate.mock.calls[0][1];
    expect(updateArgs['optionSets.os-1']).toBe('$$FIELD_DELETE$$');
  });

  it('onDelete removes from Products optionSetsSelection', async () => {
    const os = new OptionSet(createTestOptionSetProps({ Id: 'os-1' }));
    const docRef = { id: 'prod-1' };
    mockGet.mockResolvedValue({ docs: [{ ref: docRef }] });

    await handler.onDelete(os, 'biz-1', mockTransaction);

    const updateArgs = mockUpdate.mock.calls[0][1];
    expect(updateArgs['optionSetsSelection.os-1']).toBe('$$FIELD_DELETE$$');
  });
});
