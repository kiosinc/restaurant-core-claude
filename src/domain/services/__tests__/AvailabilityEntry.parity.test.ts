/**
 * Parity guard for the P41 `AvailabilityEntry` declaration (rcc#163, contract rcc#162 §1).
 *
 * The canonical interface lives in `@kiosinc/commons-types` (`types/availabilityTypes.ts`,
 * kiosinc/kios-commons-types#74); `AvailabilityEntryService.ts` declares a structurally
 * assignable copy (Admin `Timestamp` for `updatedAt` where commons-types has
 * `FirestoreTimestampLike`). The checked-in snapshot `fixtures/availabilityEntry.contract.json`
 * is this repo's pin of that shape — there is no snapshot on the commons-types side.
 *
 * Tests are excluded from `tsconfig.json`, so a type-level assertion here would be checked by
 * nothing. Instead the service module is read as TEXT, parsed with the TypeScript compiler API,
 * and the members of `interface AvailabilityEntry` are extracted as `{ name, optional, type }` —
 * an add, remove, rename, retype, reorder or optionality flip all change that array. The
 * anti-tautology test below mutates the source three ways to prove the extractor is not
 * trivially agreeing with the snapshot.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as ts from 'typescript';
import { describe, it, expect } from 'vitest';
import { ENTRY_WRITABLE_FIELDS } from '../AvailabilityEntryService';

interface ExtractedMember {
  name: string;
  optional: boolean;
  type: string;
}

interface ContractSnapshot {
  source: string;
  interface: string;
  members: ExtractedMember[];
}

const SOURCE_PATH = join(process.cwd(), 'src/domain/services/AvailabilityEntryService.ts');
const SNAPSHOT_PATH = join(process.cwd(), 'src/domain/services/__tests__/fixtures/availabilityEntry.contract.json');

const source = readFileSync(SOURCE_PATH, 'utf8');
const snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as ContractSnapshot;

/**
 * `{ name, optional, type }` for every property of `interface <interfaceName>` in `sourceText`,
 * in declaration order. Type text is whitespace-normalised so a reflowed union still matches.
 */
function extractInterfaceMembers(sourceText: string, interfaceName: string): ExtractedMember[] {
  const sf = ts.createSourceFile('AvailabilityEntryService.ts', sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const decl = sf.statements.find(
    (statement): statement is ts.InterfaceDeclaration =>
      ts.isInterfaceDeclaration(statement) && statement.name.text === interfaceName,
  );
  if (!decl) throw new Error(`interface ${interfaceName} not found in source`);

  return decl.members.map((member) => {
    if (!ts.isPropertySignature(member) || !member.type) {
      throw new Error(`interface ${interfaceName}: unsupported member '${member.getText(sf)}'`);
    }
    return {
      name: member.name.getText(sf),
      optional: member.questionToken !== undefined,
      type: member.type.getText(sf).replace(/\s+/g, ' '),
    };
  });
}

const extracted = extractInterfaceMembers(source, snapshot.interface);
const snapshotNames = snapshot.members.map((member) => member.name);
const extractedNames = extracted.map((member) => member.name);

/** Applies a single textual mutation and refuses to proceed if it did not change anything. */
function mutate(from: string, to: string): string {
  const mutated = source.replace(from, to);
  expect(mutated).not.toBe(source);
  return mutated;
}

describe('AvailabilityEntry parity with @kiosinc/commons-types (#163)', () => {
  it('the rcc AvailabilityEntry declaration equals the checked-in snapshot member-for-member, in order', () => {
    expect(snapshot.interface).toBe('AvailabilityEntry');
    expect(extracted).toEqual(snapshot.members);
  });

  it('both the declaration and the snapshot include isInventoryTracked', () => {
    expect(extractedNames).toContain('isInventoryTracked');
    expect(snapshotNames).toContain('isInventoryTracked');
    // Optional (absent = tracked), and a plain boolean — gateway#375's `false` must be storable.
    expect(extracted.find((member) => member.name === 'isInventoryTracked')).toEqual({
      name: 'isInventoryTracked', optional: true, type: 'boolean',
    });
  });

  it('neither contains isAvailable', () => {
    expect(extractedNames).not.toContain('isAvailable');
    expect(snapshotNames).not.toContain('isAvailable');
    // `ENTRY_WRITABLE_FIELDS` is what stops a JS caller writing it; it must not be listed either.
    expect(ENTRY_WRITABLE_FIELDS).not.toContain('isAvailable');
  });

  it('the extractor detects a rename, an optionality flip, and a retype', () => {
    const renamed = mutate('isHidden?: boolean', 'isHidden2?: boolean');
    expect(extractInterfaceMembers(renamed, 'AvailabilityEntry')).not.toEqual(snapshot.members);

    const flipped = mutate('isHidden?: boolean', 'isHidden: boolean');
    expect(extractInterfaceMembers(flipped, 'AvailabilityEntry')).not.toEqual(snapshot.members);

    const retyped = mutate('count?: number', 'count?: string');
    expect(extractInterfaceMembers(retyped, 'AvailabilityEntry')).not.toEqual(snapshot.members);

    // And a reorder — the snapshot is ordered, so `toEqual` on the array must see it.
    const reordered = [...snapshot.members].reverse();
    expect(extracted).not.toEqual(reordered);
  });

  it('ENTRY_WRITABLE_FIELDS equals the snapshot member names minus updatedAt', () => {
    expect([...ENTRY_WRITABLE_FIELDS]).toEqual(snapshotNames.filter((name) => name !== 'updatedAt'));
  });

  it("the snapshot's source note names @kiosinc/commons-types availabilityTypes.ts", () => {
    expect(snapshot.source).toContain('@kiosinc/commons-types');
    expect(snapshot.source).toContain('availabilityTypes.ts');
    expect(snapshot.source).toContain('kiosinc/kios-commons-types#74');
    expect(snapshot.source).toContain('kiosinc/restaurant-core-claude#162');
  });
});
