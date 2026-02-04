import { describe, it, expect, vi } from 'vitest';
import { Menu } from '../../../domain/surfaces/Menu';
import { MenuMetadataSpec } from '../MenuMetadataSpec';
import { createTestMenuProps } from '../../../domain/__tests__/helpers/SurfacesFixtures';

vi.mock('../../../restaurant/roots/Surfaces', () => ({
  default: {
    docRef: (businessId: string) => ({
      path: `businesses/${businessId}/public/surfaces`,
    }),
  },
}));

describe('MenuMetadataSpec', () => {
  const spec = new MenuMetadataSpec();

  it('getMetadata returns MenuMeta', () => {
    const menu = new Menu(createTestMenuProps({ name: 'Dinner', displayName: 'Evening Menu' }));
    const meta = spec.getMetadata(menu);
    expect(meta).toEqual({ name: 'Dinner', displayName: 'Evening Menu' });
  });

  it('getMetaLinks returns Surfaces doc path', () => {
    const menu = new Menu(createTestMenuProps({ Id: 'menu-1' }));
    const links = spec.getMetaLinks(menu, 'biz-1');
    expect(links).toHaveLength(1);
    expect(links[0].documentPath).toBe('businesses/biz-1/public/surfaces');
  });

  it('getMetaLinks field path includes menu Id', () => {
    const menu = new Menu(createTestMenuProps({ Id: 'menu-42' }));
    const links = spec.getMetaLinks(menu, 'biz-1');
    expect(links[0].fieldPath).toBe('menus.menu-42');
  });
});
