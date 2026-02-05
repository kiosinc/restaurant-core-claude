import { describe, it, expect } from 'vitest';
import { LocationsRoot, LocationMeta } from '../Locations';
import { DomainEntity } from '../../DomainEntity';

describe('LocationsRoot', () => {
  it('constructs with all props', () => {
    const locations: { [id: string]: LocationMeta } = {
      'loc-1': { name: 'Downtown', isActive: true },
      'loc-2': { name: 'Airport', isActive: false },
    };
    const root = new LocationsRoot({ locations });
    expect(root.locations).toEqual(locations);
  });

  it('defaults locations to {} when nullish', () => {
    const root = new LocationsRoot({ locations: undefined as any });
    expect(root.locations).toEqual({});
  });

  it('LocationMeta interface works', () => {
    const meta: LocationMeta = { name: 'Main St', isActive: true };
    const root = new LocationsRoot({ locations: { 'loc-1': meta } });
    expect(root.locations['loc-1'].name).toBe('Main St');
    expect(root.locations['loc-1'].isActive).toBe(true);
  });

  it('instantiates without Firebase', () => {
    const root = new LocationsRoot({ locations: {} });
    expect(root).toBeInstanceOf(DomainEntity);
    expect(root).toBeInstanceOf(LocationsRoot);
  });
});
