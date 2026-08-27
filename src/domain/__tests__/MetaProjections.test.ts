import { describe, it, expect } from 'vitest';
import { undefinedPaths } from './helpers/undefinedPaths';
import { createProduct, productMeta } from '../catalog/Product';
import { createOption, optionMeta } from '../catalog/Option';
import { createOptionSet, optionSetMeta } from '../catalog/OptionSet';
import { createCategory, categoryMeta } from '../catalog/Category';
import { createLocation, locationMeta } from '../locations/Location';
import { createMenu, menuMeta } from '../surfaces/Menu';
import { createMenuGroup, menuGroupMeta } from '../surfaces/MenuGroup';
import * as Domain from '../index';

/**
 * #200 shape guard. Every `*Meta` projection is denormalized into a parent document's map by a
 * raw `batch.update()` / `transaction.set()` in the consuming services, none of which enable
 * `ignoreUndefinedProperties` — so one undefined key fails the whole write, far from the factory
 * that produced it. `dietaryPreferences`/`allergens` (kiosinc/businesses#397) and `isActive`
 * (#198) were each found that way, separately.
 *
 * Each case hydrates from the barest legacy document its factory accepts — only the fields it
 * hard-requires — so a projected field added later and left neither defaulted nor validated fails
 * here rather than in a consumer's 500. `as unknown as` mirrors the real read path: Firestore
 * hands the factory untyped `DocumentData`, so the input type is no guarantee at runtime.
 */
const projections: Array<{ name: string; project: () => unknown }> = [
  {
    name: 'productMeta',
    project: () => productMeta(createProduct({ name: 'Legacy' } as unknown as Parameters<typeof createProduct>[0])),
  },
  {
    name: 'optionMeta',
    project: () => optionMeta(createOption({ name: 'Legacy', price: 0 } as unknown as Parameters<typeof createOption>[0])),
  },
  {
    name: 'optionSetMeta',
    project: () => optionSetMeta(createOptionSet({
      name: 'Legacy', minSelection: 0, maxSelection: 1, displayOrder: 0, displayTier: 0,
    } as unknown as Parameters<typeof createOptionSet>[0])),
  },
  {
    name: 'categoryMeta',
    project: () => categoryMeta(createCategory({ name: 'Legacy' })),
  },
  {
    name: 'locationMeta',
    project: () => locationMeta(createLocation({
      businessId: 'biz-1', name: 'Legacy',
    } as unknown as Parameters<typeof createLocation>[0])),
  },
  {
    name: 'menuMeta',
    project: () => menuMeta(createMenu({ name: 'Legacy' })),
  },
  {
    name: 'menuGroupMeta',
    project: () => menuGroupMeta(createMenuGroup({ name: 'Legacy' })),
  },
];

describe('*Meta projections (#200 shape guard)', () => {
  it.each(projections)('$name emits no undefined value from a legacy document', ({ project }) => {
    expect(undefinedPaths(project())).toEqual([]);
  });

  it('covers every *Meta projection the domain layer exports', () => {
    // Guards the guard: a projection added later without a case above would otherwise pass by
    // simply not being tested. Enumerated from the barrel rather than hardcoded, so the new
    // export fails here on the day it lands.
    const exported = Object.values(Domain)
      .filter((ns): ns is Record<string, unknown> => typeof ns === 'object' && ns !== null)
      .flatMap((ns) => Object.entries(ns))
      .filter(([name, value]) => /Meta$/.test(name) && typeof value === 'function')
      .map(([name]) => name);

    expect([...new Set(exported)].sort()).toEqual(projections.map((p) => p.name).sort());
  });
});
