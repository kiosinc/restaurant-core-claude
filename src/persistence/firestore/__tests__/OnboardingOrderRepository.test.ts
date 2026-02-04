import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OnboardingOrder, InvoiceStatus } from '../../../domain/onboarding/OnboardingOrder';
import { MetadataRegistry } from '../../MetadataRegistry';
import { OnboardingOrderRepository } from '../OnboardingOrderRepository';
import { createTestOnboardingOrderProps } from '../../../domain/__tests__/helpers/SurfacesFixtures';
import { OrderState } from '../../../domain/orders/OrderSymbols';

const mockTransaction = { set: vi.fn(), update: vi.fn(), delete: vi.fn() };
const mockDocRef = { get: vi.fn(), update: vi.fn() };
const mockQuery = { get: vi.fn() };
const mockCollectionRef = {
  doc: vi.fn(() => mockDocRef),
  where: vi.fn(() => mockQuery),
};
const mockDb = {
  runTransaction: vi.fn(async (fn: (t: any) => Promise<void>) => fn(mockTransaction)),
  doc: vi.fn(() => mockDocRef),
};

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => mockDb,
  FieldValue: { delete: () => '$$FIELD_DELETE$$' },
}));

vi.mock('../../../restaurant/roots/Onboarding', () => ({
  Onboarding: {
    docRef: (_businessId: string) => ({
      collection: (_name: string) => mockCollectionRef,
    }),
  },
}));

function createFullSerializedOnboardingOrder() {
  const ts = '2024-01-15T10:00:00.000Z';
  return {
    invoiceId: 'inv-42', invoiceStatus: 'paid',
    shippingTrackingNumber: 'TRACK123', shipmentCarrier: 'UPS',
    shipmentAddress: { addressLine1: '123 Main', addressLine2: '', city: 'LA', state: 'CA', zip: '90001', country: 'US' },
    totalAmount: 5000, orderStatus: 'completed',
    lineItems: [{ Id: 'li-1', item: { productId: 'prod-1', productName: 'Tablet', optionSetsSelected: [], price: 5000 }, quantity: 1, taxes: [], discounts: [], surcharges: [], note: null }],
    created: ts, updated: ts, isDeleted: false,
  };
}

describe('OnboardingOrderRepository', () => {
  let registry: MetadataRegistry;
  let repo: OnboardingOrderRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new MetadataRegistry();
    repo = new OnboardingOrderRepository(registry);
  });

  it('get() returns OnboardingOrder when exists', async () => {
    mockDocRef.get.mockResolvedValue({
      exists: true, data: () => createFullSerializedOnboardingOrder(), id: 'oo-1',
    });
    const result = await repo.get('biz-1', 'oo-1');
    expect(result).not.toBeNull();
    expect(result!.Id).toBe('oo-1');
    expect(result!.invoiceId).toBe('inv-42');
    expect(result!.lineItems).toHaveLength(1);
  });

  it('get() returns null when missing', async () => {
    mockDocRef.get.mockResolvedValue({ exists: false });
    expect(await repo.get('biz-1', 'missing')).toBeNull();
  });

  it('set() serializes all fields correctly', async () => {
    const oo = new OnboardingOrder(createTestOnboardingOrderProps({
      Id: 'oo-1', invoiceId: 'inv-99', totalAmount: 10000,
    }));
    await repo.set(oo, 'biz-1');
    const data = mockTransaction.set.mock.calls[0][1];
    expect(data.invoiceId).toBe('inv-99');
    expect(data.totalAmount).toBe(10000);
  });

  it('set() deep-clones lineItems', async () => {
    const oo = new OnboardingOrder(createTestOnboardingOrderProps({
      lineItems: [{ Id: 'li-1', item: { productId: 'prod-1', productName: 'Item', optionSetsSelected: [], price: 100 }, quantity: 1, taxes: [], discounts: [], surcharges: [], note: null }],
    }));
    await repo.set(oo, 'biz-1');
    const data = mockTransaction.set.mock.calls[0][1];
    expect(data.lineItems).not.toBe(oo.lineItems);
    expect(data.lineItems[0].Id).toBe('li-1');
  });

  it('round-trip preserves data', async () => {
    const ts = new Date('2024-06-01T12:00:00Z');
    const original = new OnboardingOrder(createTestOnboardingOrderProps({
      Id: 'oo-rt', invoiceId: 'inv-55', invoiceStatus: InvoiceStatus.open,
      totalAmount: 7500, created: ts, updated: ts,
    }));
    await repo.set(original, 'biz-1');
    const serialized = mockTransaction.set.mock.calls[0][1];
    mockDocRef.get.mockResolvedValue({ exists: true, data: () => serialized, id: 'oo-rt' });
    const restored = await repo.get('biz-1', 'oo-rt');
    expect(restored!.invoiceId).toBe(original.invoiceId);
    expect(restored!.invoiceStatus).toBe(original.invoiceStatus);
    expect(restored!.totalAmount).toBe(original.totalAmount);
  });
});
