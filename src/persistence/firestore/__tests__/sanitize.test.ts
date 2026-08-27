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
});
