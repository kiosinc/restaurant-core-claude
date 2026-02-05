import { describe, it, expect, vi } from 'vitest';
import { MenuGroup } from '../../../domain/surfaces/MenuGroup';
import { MenuGroupMetadataSpec } from '../MenuGroupMetadataSpec';
import { createTestMenuGroupProps } from '../../../domain/__tests__/helpers/SurfacesFixtures';

// Mock firebase-admin/firestore with proper chain for PathResolver
const mockDocRef = { path: 'businesses/biz-1/public/surfaces' };
const mockCollectionRef = {
  doc: vi.fn(() => mockDocRef),
};

// Make chaining work: collection().doc() returns something with .collection()
mockCollectionRef.doc.mockReturnValue({
  ...mockDocRef,
  collection: vi.fn(() => mockCollectionRef),
});

const mockDb = {
  collection: vi.fn(() => mockCollectionRef),
};

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => mockDb,
}));

describe('MenuGroupMetadataSpec', () => {
  const spec = new MenuGroupMetadataSpec();

  it('getMetadata returns MenuGroupMeta', () => {
    const mg = new MenuGroup(createTestMenuGroupProps({ name: 'Entrees', displayName: 'Main Dishes' }));
    const meta = spec.getMetadata(mg);
    expect(meta).toEqual({ name: 'Entrees', displayName: 'Main Dishes' });
  });

  it('getMetaLinks returns Surfaces doc path', () => {
    const mg = new MenuGroup(createTestMenuGroupProps({ Id: 'mg-1' }));
    const links = spec.getMetaLinks(mg, 'biz-1');
    expect(links).toHaveLength(1);
    expect(links[0].documentPath).toBe('businesses/biz-1/public/surfaces');
  });

  it('getMetaLinks field path includes menuGroup Id', () => {
    const mg = new MenuGroup(createTestMenuGroupProps({ Id: 'mg-42' }));
    const links = spec.getMetaLinks(mg, 'biz-1');
    expect(links[0].fieldPath).toBe('menuGroups.mg-42');
  });
});
