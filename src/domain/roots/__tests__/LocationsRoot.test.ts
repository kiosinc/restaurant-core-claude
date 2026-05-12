import { describe, it, expect } from 'vitest';
import { createLocationsRoot, LocationMeta } from '../Locations';

describe('LocationsRoot', () => {
  it('constructs with all props', () => {
    const locations: { [id: string]: LocationMeta } = {
      'loc-1': { name: 'Downtown', isActive: true },
      'loc-2': { name: 'Airport', isActive: false },
    };
    const root = createLocationsRoot({ locations });
    expect(root.locations).toEqual(locations);
  });

  it('defaults locations to {} when nullish', () => {
    const root = createLocationsRoot({ locations: undefined as any });
    expect(root.locations).toEqual({});
  });

  it('LocationMeta interface works', () => {
    const meta: LocationMeta = { name: 'Main St', isActive: true };
    const root = createLocationsRoot({ locations: { 'loc-1': meta } });
    expect(root.locations['loc-1'].name).toBe('Main St');
    expect(root.locations['loc-1'].isActive).toBe(true);
  });

  it('creates plain object with BaseEntity fields', () => {
    const root = createLocationsRoot({ locations: {} });
    expect(root.Id).toBeDefined();
    expect(root.created).toBeInstanceOf(Date);
    expect(root.updated).toBeInstanceOf(Date);
    expect(root.isDeleted).toBe(false);
  });
});
