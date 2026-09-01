import { describe, it, expect } from 'vitest';
import { stripUndefined } from '../sanitize';

describe('stripUndefined (#200)', () => {
  it('drops top-level undefined keys and keeps everything else', () => {
    expect(stripUndefined({ name: 'Menu', version: undefined, isDeleted: false }))
      .toEqual({ name: 'Menu', isDeleted: false });
  });

  it('keeps null, empty string, 0 and false — only undefined is dropped', () => {
    const input = { a: null, b: '', c: 0, d: false, e: undefined };
    expect(stripUndefined(input)).toEqual({ a: null, b: '', c: 0, d: false });
  });

  it('drops undefined keys at any depth', () => {
    const input = {
      groups: { g1: { name: 'Drinks', managedBy: undefined } },
      menuAssets: { a1: { assetType: 'group', configuration: undefined } },
    };
    expect(stripUndefined(input)).toEqual({
      groups: { g1: { name: 'Drinks' } },
      menuAssets: { a1: { assetType: 'group' } },
    });
  });

  it('recurses into objects nested in arrays', () => {
    expect(stripUndefined({ rates: [{ value: 15, label: undefined }] }))
      .toEqual({ rates: [{ value: 15 }] });
  });

  it('maps array elements rather than filtering them, so indices never shift', () => {
    // An undefined element is still rejected by Firestore, but dropping it would silently
    // renumber every later entry — a worse outcome than the failed write. See the module note.
    expect(stripUndefined({ order: ['a', undefined, 'c'] }))
      .toEqual({ order: ['a', undefined, 'c'] });
  });

  it('returns Date instances by reference instead of rebuilding them from entries', () => {
    const created = new Date('2024-01-01');
    const result = stripUndefined({ created, version: undefined });
    expect(result.created).toBe(created);
    expect(result).not.toHaveProperty('version');
  });

  it('leaves non-plain objects untouched at depth', () => {
    // Stands in for a Firestore Timestamp or a FieldValue sentinel: a class instance whose own
    // enumerable entries are not its value.
    class Sentinel {
      readonly kind = 'delete';
    }
    const sentinel = new Sentinel();
    expect(stripUndefined({ nested: { field: sentinel } }).nested.field).toBe(sentinel);
  });

  it('passes primitives and null through unchanged', () => {
    expect(stripUndefined('menu')).toBe('menu');
    expect(stripUndefined(0)).toBe(0);
    expect(stripUndefined(null)).toBeNull();
    expect(stripUndefined(undefined)).toBeUndefined();
  });

  it('does not mutate its input', () => {
    const input = { name: 'Menu', version: undefined };
    stripUndefined(input);
    expect(Object.keys(input)).toEqual(['name', 'version']);
  });

  // #204: an unguarded recursion answered a self-referential payload with
  // `RangeError: Maximum call stack size exceeded`, which names neither the field nor the cause.
  // The guard is path-scoped — containers are added on entry and removed on exit — so it reports
  // a genuine cycle without misreporting a shared value.
  describe('#204 — cycle guard', () => {
    it('throws naming the field path of a self-referential object', () => {
      const groups: Record<string, unknown> = { name: 'Drinks' };
      groups.self = groups;

      expect(() => stripUndefined({ groups })).toThrow('stripUndefined: circular reference at groups.self');
    });

    it('throws naming the index of a self-referential array', () => {
      const order: unknown[] = ['a'];
      order.unshift(order);

      expect(() => stripUndefined({ order })).toThrow('stripUndefined: circular reference at order[0]');
    });

    // `<root>` is unreachable by construction and there is no test for it: `stripUndefined` seeds
    // the ancestor set empty, so the root container can never be found already on the path. A
    // cycle that closes back on the root is reported at the FIELD that closes it, as here.
    it('reports a root-closing cycle at the field that closes it, never as <root>', () => {
      const doc: Record<string, unknown> = { name: 'Menu' };
      doc.self = doc;

      expect(() => stripUndefined(doc)).toThrow('stripUndefined: circular reference at self');
    });

    // The regression this guard exists to avoid: one object referenced twice is a DAG, which
    // serializes fine. A global visited-set — rather than add-on-entry/delete-on-exit — would
    // throw here, on payloads Firestore accepts today.
    it('does not mistake a value shared by two siblings for a cycle', () => {
      const shared = { name: 'Drinks', managedBy: undefined };

      const result = stripUndefined({ first: shared, second: shared, version: undefined });

      expect(result).toEqual({ first: { name: 'Drinks' }, second: { name: 'Drinks' } });
      expect('managedBy' in result.first).toBe(false);
      expect('managedBy' in result.second).toBe(false);
    });

    it('does not throw on deep but acyclic nesting', () => {
      const root: Record<string, unknown> = {};
      let cursor = root;
      for (let i = 0; i < 50; i++) {
        const next: Record<string, unknown> = { depth: i, skipped: undefined };
        cursor.child = next;
        cursor = next;
      }

      expect(() => stripUndefined(root)).not.toThrow();
    });
  });
});
