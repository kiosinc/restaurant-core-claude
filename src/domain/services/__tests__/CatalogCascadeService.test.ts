import { describe, it, expect } from 'vitest';
import {
  buildSavedUpdates,
  buildDeletedUpdates,
  productSpec,
  optionSetSpec,
  optionSpec,
} from '../CatalogCascadeService';
import { createProduct } from '../../catalog/Product';
import { createOptionSet } from '../../catalog/OptionSet';
import { createOption } from '../../catalog/Option';
import { createTestProductInput, createTestOptionSetInput, createTestOptionInput } from '../../__tests__/helpers/CatalogFixtures';

describe('CatalogCascadeService', () => {
  describe('product saved', () => {
    it('returns ProductMeta update for a single parent', () => {
      const product = createProduct(createTestProductInput({
        Id: 'prod-1', name: 'Burger', isActive: true,
        imageUrls: ['b.jpg'], imageGsls: [],
        minPrice: 500, maxPrice: 800, variationCount: 3,
      }));

      const result = buildSavedUpdates(product, ['cat-1'], productSpec);

      expect(result).toHaveLength(1);
      expect(result[0].parentId).toBe('cat-1');
      expect(result[0].update.fieldsToSet).toEqual({
        'products.prod-1': {
          name: 'Burger', isActive: true,
          imageUrls: ['b.jpg'], imageGsls: [],
          minPrice: 500, maxPrice: 800, variationCount: 3,
        },
      });
      expect(result[0].update.fieldsToDelete).toEqual([]);
      expect(result[0].update.arrayFieldRemovals).toEqual({});
    });

    it('returns updates for multiple parents', () => {
      const product = createProduct(createTestProductInput({ Id: 'prod-1' }));
      const result = buildSavedUpdates(product, ['cat-1', 'cat-2', 'cat-3'], productSpec);
      expect(result).toHaveLength(3);
      expect(result.map((r) => r.parentId)).toEqual(['cat-1', 'cat-2', 'cat-3']);
    });

    it('returns empty array when no parents', () => {
      const product = createProduct(createTestProductInput({ Id: 'prod-1' }));
      expect(buildSavedUpdates(product, [], productSpec)).toEqual([]);
    });
  });

  describe('product deleted', () => {
    it('returns delete + arrayRemove for a single parent', () => {
      const product = createProduct(createTestProductInput({ Id: 'prod-1' }));
      const result = buildDeletedUpdates(product, ['cat-1'], productSpec);

      expect(result).toHaveLength(1);
      expect(result[0].parentId).toBe('cat-1');
      expect(result[0].update.fieldsToSet).toEqual({});
      expect(result[0].update.fieldsToDelete).toEqual(['products.prod-1']);
      expect(result[0].update.arrayFieldRemovals).toEqual({ productDisplayOrder: 'prod-1' });
    });

    it('returns updates for multiple parents', () => {
      const product = createProduct(createTestProductInput({ Id: 'prod-1' }));
      const result = buildDeletedUpdates(product, ['cat-1', 'cat-2'], productSpec);
      expect(result).toHaveLength(2);
    });

    it('returns empty array when no parents', () => {
      const product = createProduct(createTestProductInput({ Id: 'prod-1' }));
      expect(buildDeletedUpdates(product, [], productSpec)).toEqual([]);
    });
  });

  describe('optionSet saved', () => {
    it('returns OptionSetMeta update for a single parent', () => {
      const optionSet = createOptionSet(createTestOptionSetInput({
        Id: 'os-1', name: 'Size', displayOrder: 2, displayTier: 1,
      }));

      const result = buildSavedUpdates(optionSet, ['prod-1'], optionSetSpec);

      expect(result).toHaveLength(1);
      expect(result[0].parentId).toBe('prod-1');
      expect(result[0].update.fieldsToSet).toEqual({
        'optionSets.os-1': { name: 'Size', displayOrder: 2, displayTier: 1 },
      });
    });

    it('returns empty array when no parents', () => {
      const optionSet = createOptionSet(createTestOptionSetInput({ Id: 'os-1' }));
      expect(buildSavedUpdates(optionSet, [], optionSetSpec)).toEqual([]);
    });
  });

  describe('optionSet deleted', () => {
    it('deletes optionSets and optionSetsSelection for a single parent', () => {
      const optionSet = createOptionSet(createTestOptionSetInput({ Id: 'os-1' }));
      const result = buildDeletedUpdates(optionSet, ['prod-1'], optionSetSpec);

      expect(result).toHaveLength(1);
      expect(result[0].update.fieldsToDelete).toEqual([
        'optionSets.os-1',
        'optionSetsSelection.os-1',
      ]);
    });

    it('returns empty array when no parents', () => {
      const optionSet = createOptionSet(createTestOptionSetInput({ Id: 'os-1' }));
      expect(buildDeletedUpdates(optionSet, [], optionSetSpec)).toEqual([]);
    });
  });

  describe('option saved', () => {
    it('returns OptionMeta update for a single parent', () => {
      const option = createOption(createTestOptionInput({
        Id: 'opt-1', name: 'Large', isActive: true,
      }));

      const result = buildSavedUpdates(option, ['os-1'], optionSpec);

      expect(result).toHaveLength(1);
      expect(result[0].parentId).toBe('os-1');
      expect(result[0].update.fieldsToSet).toEqual({
        'options.opt-1': { name: 'Large', isActive: true },
      });
    });

    it('returns empty array when no parents', () => {
      const option = createOption(createTestOptionInput({ Id: 'opt-1' }));
      expect(buildSavedUpdates(option, [], optionSpec)).toEqual([]);
    });
  });

  describe('option deleted', () => {
    it('deletes options + removes from optionDisplayOrder and preselectedOptionIds', () => {
      const option = createOption(createTestOptionInput({ Id: 'opt-1' }));
      const result = buildDeletedUpdates(option, ['os-1'], optionSpec);

      expect(result).toHaveLength(1);
      expect(result[0].update.fieldsToDelete).toEqual(['options.opt-1']);
      expect(result[0].update.arrayFieldRemovals).toEqual({
        optionDisplayOrder: 'opt-1',
        preselectedOptionIds: 'opt-1',
      });
    });

    it('returns empty array when no parents', () => {
      const option = createOption(createTestOptionInput({ Id: 'opt-1' }));
      expect(buildDeletedUpdates(option, [], optionSpec)).toEqual([]);
    });
  });
});
