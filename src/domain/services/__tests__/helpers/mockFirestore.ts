import { vi } from 'vitest';

// In-memory doc stores keyed by collection path
const docStores = new Map<string, Map<string, any>>();

export function registerCollection(path: string, docs: Array<{ id: string; data: Record<string, any> }>) {
  const store = new Map<string, any>();
  for (const doc of docs) {
    store.set(doc.id, doc.data);
  }
  docStores.set(path, store);
}

function makeDocRef(collectionPath: string, docId: string) {
  return {
    path: `${collectionPath}/${docId}`,
    id: docId,
    _collectionPath: collectionPath,
    _docId: docId,
  };
}

function makeCollectionRef(path: string) {
  return {
    path,
    doc: (id: string) => makeDocRef(path, id),
    get: vi.fn(async () => {
      const store = docStores.get(path) ?? new Map();
      return {
        docs: [...store.entries()].map(([id, data]) => ({
          id,
          data: () => ({ ...data }),
          exists: true,
        })),
      };
    }),
    where: vi.fn((..._args: any[]) => ({
      select: vi.fn(() => ({
        get: vi.fn(async () => {
          // For syncTraceId queries
          const field = _args[0];
          const value = _args[2];
          const store = docStores.get(path) ?? new Map();
          const matching = [...store.entries()]
            .filter(([, data]) => data[field] === value)
            .map(([id]) => ({ id, data: () => ({}), exists: true }));
          return { docs: matching };
        }),
      })),
      get: vi.fn(async () => {
        const field = _args[0];
        const value = _args[2];
        const store = docStores.get(path) ?? new Map();
        const matching = [...store.entries()]
          .filter(([, data]) => data[field] === value)
          .map(([id, data]) => ({ id, data: () => ({ ...data }), exists: true }));
        return { docs: matching };
      }),
    })),
    select: vi.fn((...fields: string[]) => ({
      get: vi.fn(async () => {
        const store = docStores.get(path) ?? new Map();
        return {
          docs: [...store.entries()].map(([id, data]) => ({
            id,
            data: () => {
              const result: Record<string, any> = {};
              for (const f of fields) {
                if (data[f] !== undefined) result[f] = data[f];
              }
              return result;
            },
            exists: true,
          })),
        };
      }),
    })),
  };
}

// Path → collectionRef mapping
const collectionPaths: Record<string, ReturnType<typeof makeCollectionRef>> = {};

export function getOrCreateCollectionRef(path: string) {
  if (!collectionPaths[path]) {
    collectionPaths[path] = makeCollectionRef(path);
  }
  return collectionPaths[path];
}

export const transactionSets: Array<{ ref: any; data: any }> = [];

export const mockTransaction = {
  get: vi.fn(),
  set: vi.fn((...args: any[]) => {
    transactionSets.push({ ref: args[0], data: args[1] });
  }),
};

export const mockDb = {
  collection: vi.fn((name: string) => getOrCreateCollectionRef(name)),
  runTransaction: vi.fn(async (fn: (t: any) => Promise<void>) => {
    await fn(mockTransaction);
  }),
  getAll: vi.fn(async (...refs: any[]) => {
    return refs.map((ref: any) => {
      const store = docStores.get(ref._collectionPath);
      const data = store?.get(ref._docId);
      return {
        id: ref._docId,
        exists: !!data,
        data: () => (data ? { ...data } : undefined),
        ref,
      };
    });
  }),
};

export function resetMockFirestore() {
  vi.clearAllMocks();
  transactionSets.length = 0;
  docStores.clear();
  Object.keys(collectionPaths).forEach((key) => delete collectionPaths[key]);
}
