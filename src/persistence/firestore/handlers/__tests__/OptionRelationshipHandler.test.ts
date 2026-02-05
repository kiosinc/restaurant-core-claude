import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Option } from '../../../../domain/catalog/Option';
import { OptionRelationshipHandler } from '../OptionRelationshipHandler';
import { createTestOptionProps } from '../../../../domain/__tests__/helpers/CatalogFixtures';

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
    arrayRemove: (val: string) => `$$ARRAY_REMOVE:${val}$$`,
  },
}));

describe('OptionRelationshipHandler', () => {
  let handler: OptionRelationshipHandler;
  let mockTransaction: any;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new OptionRelationshipHandler();
    mockTransaction = { get: mockGet, update: mockUpdate };
    mockWhere.mockReturnValue({ /* query object passed to t.get */ });
  });

  it('onSet queries OptionSets containing this option', async () => {
    const option = new Option(createTestOptionProps({ Id: 'opt-1', name: 'Large', isActive: true }));
    mockGet.mockResolvedValue({ docs: [] });

    await handler.onSet(option, 'biz-1', mockTransaction);

    expect(mockWhere).toHaveBeenCalledWith('options.opt-1.name', '>=', '');
  });

  it('onSet updates OptionMeta on matching OptionSets', async () => {
    const option = new Option(createTestOptionProps({ Id: 'opt-1', name: 'Large', isActive: true }));
    const docRef = { id: 'os-1' };
    mockGet.mockResolvedValue({ docs: [{ ref: docRef }] });

    await handler.onSet(option, 'biz-1', mockTransaction);

    expect(mockUpdate).toHaveBeenCalledWith(docRef, {
      'options.opt-1': { name: 'Large', isActive: true },
    });
  });

  it('onSet no-ops when no OptionSets match', async () => {
    const option = new Option(createTestOptionProps({ Id: 'opt-1' }));
    mockGet.mockResolvedValue({ docs: [] });

    await handler.onSet(option, 'biz-1', mockTransaction);

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('onDelete queries OptionSets containing this option', async () => {
    const option = new Option(createTestOptionProps({ Id: 'opt-1' }));
    mockGet.mockResolvedValue({ docs: [] });

    await handler.onDelete(option, 'biz-1', mockTransaction);

    expect(mockWhere).toHaveBeenCalledWith('options.opt-1.name', '>=', '');
  });

  it('onDelete removes option from options map', async () => {
    const option = new Option(createTestOptionProps({ Id: 'opt-1' }));
    const docRef = { id: 'os-1' };
    mockGet.mockResolvedValue({ docs: [{ ref: docRef }] });

    await handler.onDelete(option, 'biz-1', mockTransaction);

    const updateArgs = mockUpdate.mock.calls[0][1];
    expect(updateArgs['options.opt-1']).toBe('$$FIELD_DELETE$$');
  });

  it('onDelete removes from optionDisplayOrder', async () => {
    const option = new Option(createTestOptionProps({ Id: 'opt-1' }));
    const docRef = { id: 'os-1' };
    mockGet.mockResolvedValue({ docs: [{ ref: docRef }] });

    await handler.onDelete(option, 'biz-1', mockTransaction);

    const updateArgs = mockUpdate.mock.calls[0][1];
    expect(updateArgs.optionDisplayOrder).toBe('$$ARRAY_REMOVE:opt-1$$');
  });

  it('onDelete removes from preselectedOptionIds', async () => {
    const option = new Option(createTestOptionProps({ Id: 'opt-1' }));
    const docRef = { id: 'os-1' };
    mockGet.mockResolvedValue({ docs: [{ ref: docRef }] });

    await handler.onDelete(option, 'biz-1', mockTransaction);

    const updateArgs = mockUpdate.mock.calls[0][1];
    expect(updateArgs.preselectedOptionIds).toBe('$$ARRAY_REMOVE:opt-1$$');
  });
});
