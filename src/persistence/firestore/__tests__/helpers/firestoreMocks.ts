import { vi } from 'vitest';

export const mockTransaction = { set: vi.fn(), update: vi.fn(), delete: vi.fn() };
export const mockDocRef: Record<string, any> = { get: vi.fn(), update: vi.fn(), path: 'mocked/path' };
export const mockQuery = { get: vi.fn() };
export const mockCollectionRef = {
  doc: vi.fn(() => mockDocRef),
  where: vi.fn(() => mockQuery),
};

mockDocRef.collection = vi.fn(() => mockCollectionRef);

export const mockDb = {
  collection: vi.fn(() => mockCollectionRef),
  doc: vi.fn(() => mockDocRef),
  runTransaction: vi.fn(async (fn: (t: any) => Promise<void>) => fn(mockTransaction)),
};
