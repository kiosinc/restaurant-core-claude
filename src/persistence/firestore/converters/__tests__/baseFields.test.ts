import { toDateSafe, baseFieldsFromFirestore, baseFieldsToFirestore } from '../baseFields';

describe('toDateSafe', () => {
  it('converts an ISO string to a Date', () => {
    const result = toDateSafe('2025-06-15T12:00:00.000Z');
    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toBe('2025-06-15T12:00:00.000Z');
  });

  it('converts a Firestore Timestamp (object with toDate) to a Date', () => {
    const expected = new Date('2025-06-15T12:00:00.000Z');
    const firestoreTimestamp = { toDate: () => expected };
    const result = toDateSafe(firestoreTimestamp);
    expect(result).toBeInstanceOf(Date);
    expect(result).toBe(expected);
  });

  it('converts a Unix epoch number to a Date', () => {
    const result = toDateSafe(1750000000000);
    expect(result).toBeInstanceOf(Date);
    expect(result.getTime()).toBe(1750000000000);
  });

  it('does not throw for null input', () => {
    expect(() => toDateSafe(null)).not.toThrow();
    expect(toDateSafe(null)).toBeInstanceOf(Date);
  });
});

describe('baseFieldsFromFirestore', () => {
  it('parses ISO string fields correctly', () => {
    const data = {
      created: '2025-01-01T00:00:00.000Z',
      updated: '2025-06-01T00:00:00.000Z',
      isDeleted: false,
    };
    const result = baseFieldsFromFirestore(data, 'test-id');
    expect(result.Id).toBe('test-id');
    expect(result.created.toISOString()).toBe('2025-01-01T00:00:00.000Z');
    expect(result.updated.toISOString()).toBe('2025-06-01T00:00:00.000Z');
    expect(result.isDeleted).toBe(false);
  });

  it('parses Firestore Timestamp fields correctly', () => {
    const date1 = new Date('2025-01-01T00:00:00.000Z');
    const date2 = new Date('2025-06-01T00:00:00.000Z');
    const data = {
      created: { toDate: () => date1 },
      updated: { toDate: () => date2 },
      isDeleted: false,
    };
    const result = baseFieldsFromFirestore(data, 'test-id');
    expect(result.created).toBe(date1);
    expect(result.updated).toBe(date2);
  });

  it('round-trips Firestore Timestamps through fromFirestore → toFirestore without error', () => {
    const date1 = new Date('2025-01-01T00:00:00.000Z');
    const date2 = new Date('2025-06-01T00:00:00.000Z');
    const data = {
      created: { toDate: () => date1 },
      updated: { toDate: () => date2 },
      isDeleted: false,
    };
    const parsed = baseFieldsFromFirestore(data, 'test-id');
    const entity = {
      ...parsed,
      created: parsed.created,
      updated: parsed.updated,
      isDeleted: parsed.isDeleted,
    };
    const output = baseFieldsToFirestore(entity);
    expect(output.created).toBe('2025-01-01T00:00:00.000Z');
    expect(output.updated).toBe('2025-06-01T00:00:00.000Z');
    expect(output.isDeleted).toBe(false);
  });
});
