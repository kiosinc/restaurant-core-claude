import { describe, it, expect, beforeEach } from 'vitest';
import {
  CascadeGraphRegistry,
  CascadeNode,
  createDefaultCascadeGraph,
} from '../CascadeGraphRegistry';

describe('CascadeGraphRegistry', () => {
  let registry: CascadeGraphRegistry;

  beforeEach(() => {
    registry = new CascadeGraphRegistry();
  });

  // ─── register / resolve ─────────────────────────────────────────────

  describe('register and resolve', () => {
    it('round-trips a registered node', () => {
      const node: CascadeNode = {
        entityType: 'product',
        parents: [{ target: 'category', tier: 'field' }],
      };
      registry.register(node);
      expect(registry.resolve('product')).toEqual(node);
    });

    it('returns undefined for unregistered entity type', () => {
      expect(registry.resolve('nonexistent')).toBeUndefined();
    });
  });

  // ─── getAncestors ────────────────────────────────────────────────────

  describe('getAncestors', () => {
    it('returns direct parents', () => {
      registry.register({ entityType: 'option', parents: [{ target: 'optionSet', tier: 'field' }] });
      registry.register({ entityType: 'optionSet', parents: [] });

      const result = registry.getAncestors('option');
      expect(result).toEqual(['optionSet']);
    });

    it('returns full ancestor chain', () => {
      registry.register({ entityType: 'option', parents: [{ target: 'optionSet', tier: 'field' }] });
      registry.register({ entityType: 'optionSet', parents: [{ target: 'product', tier: 'field' }] });
      registry.register({ entityType: 'product', parents: [{ target: 'category', tier: 'field' }] });
      registry.register({ entityType: 'category', parents: [] });

      const result = registry.getAncestors('option');
      expect(result).toEqual(['optionSet', 'product', 'category']);
    });

    it('filters by tier', () => {
      registry.register({
        entityType: 'product',
        parents: [
          { target: 'category', tier: 'field' },
          { target: 'menuGroup', tier: 'field' },
        ],
      });
      registry.register({ entityType: 'menuGroup', parents: [{ target: 'menu', tier: 'rebuild' }] });
      registry.register({ entityType: 'category', parents: [] });
      registry.register({ entityType: 'menu', parents: [] });

      const fieldOnly = registry.getAncestors('product', 'field');
      expect(fieldOnly).toContain('category');
      expect(fieldOnly).toContain('menuGroup');
      expect(fieldOnly).not.toContain('menu');
    });

    it('returns rebuild-tier ancestors only when filtered', () => {
      registry.register({ entityType: 'menuGroup', parents: [{ target: 'menu', tier: 'rebuild' }] });
      registry.register({ entityType: 'menu', parents: [] });

      const rebuildOnly = registry.getAncestors('menuGroup', 'rebuild');
      expect(rebuildOnly).toEqual(['menu']);
    });

    it('handles multi-parent relationships', () => {
      registry.register({
        entityType: 'product',
        parents: [
          { target: 'category', tier: 'field' },
          { target: 'menuGroup', tier: 'field' },
        ],
      });
      registry.register({ entityType: 'category', parents: [] });
      registry.register({ entityType: 'menuGroup', parents: [] });

      const result = registry.getAncestors('product');
      expect(result).toContain('category');
      expect(result).toContain('menuGroup');
      expect(result).toHaveLength(2);
    });

    it('handles cycles safely', () => {
      registry.register({ entityType: 'a', parents: [{ target: 'b', tier: 'field' }] });
      registry.register({ entityType: 'b', parents: [{ target: 'a', tier: 'field' }] });

      const result = registry.getAncestors('a');
      expect(result).toContain('b');
      // Should not infinite loop — the visited set prevents it
    });

    it('returns empty array for entity with no parents', () => {
      registry.register({ entityType: 'menu', parents: [] });
      expect(registry.getAncestors('menu')).toEqual([]);
    });

    it('returns empty array for unregistered entity', () => {
      expect(registry.getAncestors('unknown')).toEqual([]);
    });
  });

  // ─── affectsMenus ───────────────────────────────────────────────────

  describe('affectsMenus', () => {
    beforeEach(() => {
      registry = createDefaultCascadeGraph();
    });

    it('returns true for option (cascades up to menu)', () => {
      expect(registry.affectsMenus('option')).toBe(true);
    });

    it('returns true for product (cascades up to menu via menuGroup)', () => {
      expect(registry.affectsMenus('product')).toBe(true);
    });

    it('returns true for menuGroup (direct rebuild parent is menu)', () => {
      expect(registry.affectsMenus('menuGroup')).toBe(true);
    });

    it('returns true for collection (direct rebuild parent is menu)', () => {
      expect(registry.affectsMenus('collection')).toBe(true);
    });

    it('returns false for category (no path to menu)', () => {
      expect(registry.affectsMenus('category')).toBe(false);
    });

    it('returns true for menu itself', () => {
      expect(registry.affectsMenus('menu')).toBe(true);
    });
  });

  // ─── createDefaultCascadeGraph ──────────────────────────────────────

  describe('createDefaultCascadeGraph', () => {
    it('registers 7 nodes', () => {
      const graph = createDefaultCascadeGraph();
      expect(graph.size).toBe(7);
    });

    it('product has multi-parent edges to category and menuGroup', () => {
      const graph = createDefaultCascadeGraph();
      const node = graph.resolve('product');
      expect(node).toBeDefined();
      expect(node!.parents).toHaveLength(2);
      expect(node!.parents).toContainEqual({ target: 'category', tier: 'field' });
      expect(node!.parents).toContainEqual({ target: 'menuGroup', tier: 'field' });
    });
  });

  // ─── clear ──────────────────────────────────────────────────────────

  describe('clear', () => {
    it('empties the registry', () => {
      registry.register({ entityType: 'option', parents: [] });
      registry.register({ entityType: 'product', parents: [] });
      expect(registry.size).toBe(2);

      registry.clear();
      expect(registry.size).toBe(0);
      expect(registry.resolve('option')).toBeUndefined();
    });
  });
});
