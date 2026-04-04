import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Surfaces, createSurfaces } from '../../../domain/roots/Surfaces';
import { MetadataRegistry } from '../../MetadataRegistry';
import { FirestoreRepository } from '../FirestoreRepository';
import { surfacesRootConverter } from '../converters';
import { mockTransaction, mockDocRef, mockDb } from './helpers/firestoreMocks';

vi.mock('firebase-admin/firestore', () => ({ getFirestore: () => mockDb, FieldValue: { delete: () => '$$FIELD_DELETE$$' } }));

describe('SurfacesRootRepository', () => {
  let repo: FirestoreRepository<Surfaces>;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new FirestoreRepository<Surfaces>(surfacesRootConverter, new MetadataRegistry());
  });

  it('get() returns SurfacesRoot when exists', async () => {
    const ts = '2024-01-15T10:00:00.000Z';
    const data = {
      menus: { 'm-1': { name: 'Lunch', displayName: null } },
      menuGroups: { 'mg-1': { name: 'Sides', displayName: null } },
      created: ts, updated: ts, isDeleted: false,
    };
    mockDocRef.get.mockResolvedValue({ exists: true, data: () => data, id: 'surfaces' });
    const result = await repo.get('biz-1', 'surfaces');
    expect(result).not.toBeNull();
    expect(result!.menus['m-1'].name).toBe('Lunch');
    expect(result!.menuGroups['mg-1'].name).toBe('Sides');
  });

  it('set() deep-clones menus and menuGroups', async () => {
    const menus = { 'm-1': { name: 'Dinner', displayName: 'Dinner Menu' } };
    const surfaces = createSurfaces({ Id: 'surfaces', menus, menuGroups: {} });
    await repo.set(surfaces, 'biz-1');
    const data = mockTransaction.set.mock.calls[0][1];
    expect(data.menus).toEqual(menus);
    expect(data.menus).not.toBe(menus);
  });

  it('round-trip preserves data', async () => {
    const ts = new Date('2024-06-01T12:00:00Z');
    const original = createSurfaces({
      Id: 'surfaces',
      menus: { 'm-1': { name: 'Brunch', displayName: null } },
      menuGroups: { 'mg-1': { name: 'Apps', displayName: 'Appetizers' } },
      created: ts, updated: ts,
    });
    await repo.set(original, 'biz-1');
    const serialized = mockTransaction.set.mock.calls[0][1];
    mockDocRef.get.mockResolvedValue({ exists: true, data: () => serialized, id: 'surfaces' });
    const restored = await repo.get('biz-1', 'surfaces');
    expect(restored!.menus).toEqual(original.menus);
    expect(restored!.menuGroups).toEqual(original.menuGroups);
  });
});
