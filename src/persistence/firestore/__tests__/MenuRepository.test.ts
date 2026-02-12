import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Menu } from '../../../domain/surfaces/Menu';
import { MetadataRegistry } from '../../MetadataRegistry';
import { MenuRepository } from '../MenuRepository';
import { createTestMenuProps } from '../../../domain/__tests__/helpers/SurfacesFixtures';

const mockTransaction = { set: vi.fn(), update: vi.fn(), delete: vi.fn() };
const mockDocRef = { get: vi.fn(), update: vi.fn(), path: '' };
const mockQuery = { get: vi.fn() };
const mockCollectionRef = {
  doc: vi.fn(() => mockDocRef),
  where: vi.fn(() => mockQuery),
};

const mockDb = {
  collection: vi.fn(() => mockCollectionRef),
  doc: vi.fn(() => mockDocRef),
  runTransaction: vi.fn(async (fn: (t: any) => Promise<void>) => fn(mockTransaction)),
};

// Make chaining work: collection().doc() returns something with .collection()
mockCollectionRef.doc.mockReturnValue({
  ...mockDocRef,
  collection: vi.fn(() => mockCollectionRef),
  path: 'mocked/path',
});

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => mockDb,
  FieldValue: { delete: () => '$$FIELD_DELETE$$' },
}));

function createFullSerializedMenu() {
  const ts = '2024-01-15T10:00:00.000Z';
  return {
    name: 'Lunch Menu', displayName: 'Lunch',
    groups: { 'mg-1': { name: 'Apps', displayName: 'Appetizers' } },
    groupDisplayOrder: ['mg-1'],
    coverImageGsl: 'gs://cover', coverBackgroundImageGsl: 'gs://bg',
    coverVideoGsl: 'gs://video', logoImageGsl: 'gs://logo',
    gratuityRates: [15, 18, 20],
    managedBy: null,
    created: ts, updated: ts, isDeleted: false,
  };
}

describe('MenuRepository', () => {
  let registry: MetadataRegistry;
  let repo: MenuRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new MetadataRegistry();
    repo = new MenuRepository(registry);
  });

  it('get() returns Menu when exists', async () => {
    mockDocRef.get.mockResolvedValue({
      exists: true, data: () => createFullSerializedMenu(), id: 'menu-1',
    });
    const result = await repo.get('biz-1', 'menu-1');
    expect(result).not.toBeNull();
    expect(result!.Id).toBe('menu-1');
    expect(result!.name).toBe('Lunch Menu');
    expect(result!.groups['mg-1'].name).toBe('Apps');
  });

  it('get() returns null when missing', async () => {
    mockDocRef.get.mockResolvedValue({ exists: false });
    expect(await repo.get('biz-1', 'missing')).toBeNull();
  });

  it('set() serializes all fields correctly', async () => {
    const menu = new Menu(createTestMenuProps({
      Id: 'menu-1', name: 'Dinner',
      groups: { 'mg-1': { name: 'Entrees', displayName: null } },
      gratuityRates: [10, 15],
    }));
    await repo.set(menu, 'biz-1');
    const data = mockTransaction.set.mock.calls[0][1];
    expect(data.name).toBe('Dinner');
    expect(data.groups['mg-1'].name).toBe('Entrees');
    expect(data.gratuityRates).toEqual([10, 15]);
  });

  it('set() deep-clones groups and groupDisplayOrder', async () => {
    const menu = new Menu(createTestMenuProps({
      groups: { 'mg-1': { name: 'Apps', displayName: null } },
      groupDisplayOrder: ['mg-1'],
      gratuityRates: [15],
    }));
    await repo.set(menu, 'biz-1');
    const data = mockTransaction.set.mock.calls[0][1];
    expect(data.groups).not.toBe(menu.groups);
    expect(data.groupDisplayOrder).not.toBe(menu.groupDisplayOrder);
    expect(data.gratuityRates).not.toBe(menu.gratuityRates);
  });

  it('round-trip preserves data', async () => {
    const ts = new Date('2024-06-01T12:00:00Z');
    const original = new Menu(createTestMenuProps({
      Id: 'menu-rt', name: 'Brunch', displayName: 'Weekend',
      coverImageGsl: 'gs://brunch', created: ts, updated: ts,
    }));
    await repo.set(original, 'biz-1');
    const serialized = mockTransaction.set.mock.calls[0][1];
    mockDocRef.get.mockResolvedValue({ exists: true, data: () => serialized, id: 'menu-rt' });
    const restored = await repo.get('biz-1', 'menu-rt');
    expect(restored!.name).toBe(original.name);
    expect(restored!.displayName).toBe(original.displayName);
    expect(restored!.coverImageGsl).toBe(original.coverImageGsl);
    expect(restored!.managedBy).toBe(original.managedBy);
  });

  it('fromFirestore defaults optional fields', async () => {
    const data = createFullSerializedMenu();
    delete (data as any).coverImageGsl;
    delete (data as any).coverBackgroundImageGsl;
    delete (data as any).coverVideoGsl;
    delete (data as any).logoImageGsl;
    mockDocRef.get.mockResolvedValue({ exists: true, data: () => data, id: 'menu-1' });
    const result = await repo.get('biz-1', 'menu-1');
    expect(result!.coverImageGsl).toBeNull();
    expect(result!.coverBackgroundImageGsl).toBeNull();
    expect(result!.coverVideoGsl).toBeNull();
    expect(result!.logoImageGsl).toBeNull();
  });
});
