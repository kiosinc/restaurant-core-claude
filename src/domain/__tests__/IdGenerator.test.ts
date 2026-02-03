import { describe, it, expect } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { IdGenerator } from '../IdGenerator';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class UuidGeneratorForTest implements IdGenerator {
  generate(): string {
    return uuidv4();
  }
}

describe('IdGenerator', () => {
  it('UuidGenerator produces valid UUID v4', () => {
    const generator = new UuidGeneratorForTest();
    const id = generator.generate();
    expect(id).toMatch(UUID_V4_REGEX);
  });

  it('UuidGenerator produces unique IDs', () => {
    const generator = new UuidGeneratorForTest();
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      ids.add(generator.generate());
    }
    expect(ids.size).toBe(1000);
  });

  it('Custom IdGenerator works', () => {
    let counter = 0;
    const generator: IdGenerator = {
      generate(): string {
        return `id-${++counter}`;
      },
    };
    expect(generator.generate()).toBe('id-1');
    expect(generator.generate()).toBe('id-2');
    expect(generator.generate()).toBe('id-3');
  });
});
