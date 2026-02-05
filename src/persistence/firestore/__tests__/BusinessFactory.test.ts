import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BusinessType } from '../../../domain/roots/Business';

const mockTransaction = {
  set: vi.fn(),
  get: vi.fn(),
};

const mockDocRef = {
  get: vi.fn(),
  path: 'mocked/path',
  collection: vi.fn(),
};

const mockCollectionRef = {
  doc: vi.fn(() => ({ ...mockDocRef, collection: vi.fn(() => mockCollectionRef) })),
};

mockDocRef.collection = vi.fn(() => mockCollectionRef);

const mockDb = {
  collection: vi.fn(() => mockCollectionRef),
  doc: vi.fn(() => mockDocRef),
  runTransaction: vi.fn(async (fn: (t: any) => Promise<void>) => fn(mockTransaction)),
};

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => mockDb,
  FieldValue: { delete: () => '$$FIELD_DELETE$$' },
}));

import { createBusiness, CreateBusinessInput } from '../BusinessFactory';

describe('BusinessFactory - createBusiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultInput: CreateBusinessInput = {
    uid: 'user-1',
    device: 'ios',
    type: BusinessType.restaurant,
    name: 'My Restaurant',
  };

  it('creates Business with correct fields', async () => {
    mockTransaction.get.mockResolvedValue({ data: () => null });
    await createBusiness(defaultInput);
    const businessData = mockTransaction.set.mock.calls[0][1];
    expect(businessData.agent).toBe('ios');
    expect(businessData.createdBy).toBe('user-1');
    expect(businessData.type).toBe('restaurant');
    expect(businessData.roles['user-1']).toBe('owner');
  });

  it('creates all 8 root documents when no feature list', async () => {
    mockTransaction.get.mockResolvedValue({ data: () => undefined });
    await createBusiness(defaultInput);
    expect(mockTransaction.set).toHaveBeenCalledTimes(8);
  });

  it('sets feature list when available (9th set call)', async () => {
    mockTransaction.get.mockResolvedValue({ data: () => ({ someFeature: true }) });
    await createBusiness(defaultInput);
    expect(mockTransaction.set).toHaveBeenCalledTimes(9);
    const featureListData = mockTransaction.set.mock.calls[8][1];
    expect(featureListData.enabled).toEqual({ someFeature: true });
  });

  it('returns businessId string', async () => {
    mockTransaction.get.mockResolvedValue({ data: () => null });
    const result = await createBusiness(defaultInput);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('skips feature list when missing', async () => {
    mockTransaction.get.mockResolvedValue({ data: () => undefined });
    await createBusiness(defaultInput);
    expect(mockTransaction.set).toHaveBeenCalledTimes(8);
  });
});
