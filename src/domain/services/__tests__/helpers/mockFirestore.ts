/**
 * In-memory Firestore double shared by the service test suites.
 *
 * #88: doc-level `get()` / `set()` / `update()` were added on top of the original
 * collection-level reads. Both layers are backed by the SAME `docStores` map, so the view is
 * coherent in both directions: a doc written through `docRef.set()` is visible to a later
 * `collection.get()` / `where()` / `db.getAll()` on that path, and docs seeded through
 * `registerCollection()` are visible to `docRef.get()` / `docRef.update()`.
 *
 * Two deliberate limitations — extend the mock rather than silently assuming otherwise:
 *  1. **No dotted field paths and no `FieldValue` sentinels.** `set`/`update` payloads are
 *     treated as plain top-level fields; `'a.b'` becomes a literal key named `'a.b'` and a
 *     sentinel such as `FieldValue.delete()` is stored verbatim instead of being interpreted.
 *  2. **Merge is shallow.** `set(data, { merge: true })` and `update(data)` spread one level
 *     only; nested objects are replaced wholesale, never deep-merged.
 *
 * Assert doc-level writes against the exported `docWrites` ledger, NOT against per-ref spies:
 * `collection.doc(id)` mints a fresh ref object on every call, so a spy captured from one ref
 * never sees the write issued through another.
 */
import { vi } from 'vitest';

// In-memory doc stores keyed by collection path
const docStores = new Map<string, Map<string, any>>();

/**
 * #88: single accessor for the backing store of a collection path, creating it on first use.
 * Doc-level writes go through this so they land in the same map the collection-level reads
 * (`makeCollectionRef.get`/`where`/`select`, `mockDb.getAll`) serve from.
 */
function getOrCreateStore(path: string): Map<string, any> {
  let store = docStores.get(path);
  if (!store) {
    store = new Map<string, any>();
    docStores.set(path, store);
  }
  return store;
}

/**
 * #88: ledger of doc-level (non-transactional) writes — the `ManagedMenuService` equivalent of
 * `transactionSets`. Appended to by `docRef.set()` / `docRef.update()`, cleared by
 * `resetMockFirestore()`.
 */
export const docWrites: Array<{ path: string; id: string; op: 'set' | 'update'; data: any }> = [];

export function registerCollection(path: string, docs: Array<{ id: string; data: Record<string, any> }>) {
  const store = new Map<string, any>();
  for (const doc of docs) {
    store.set(doc.id, doc.data);
  }
  docStores.set(path, store);
}

function makeDocRef(collectionPath: string, docId: string) {
  const docPath = `${collectionPath}/${docId}`;
  return {
    path: docPath,
    id: docId,
    _collectionPath: collectionPath,
    _docId: docId,
    // #88: plain functions, not vi.fn — a fresh ref is minted per `collection.doc(id)` call, so
    // per-ref spies would be useless for assertions. Use `docWrites` instead.
    get: async () => {
      const data = docStores.get(collectionPath)?.get(docId);
      return {
        id: docId,
        exists: data !== undefined,
        data: () => (data ? { ...data } : undefined),
      };
    },
    set: async (data: Record<string, any>, options?: { merge?: boolean }) => {
      const store = getOrCreateStore(collectionPath);
      const existing = options?.merge ? store.get(docId) : undefined;
      // #88: shallow merge only — see the header note on the mock's limitations.
      store.set(docId, { ...existing, ...data });
      docWrites.push({ path: docPath, id: docId, op: 'set', data: { ...data } });
    },
    update: async (data: Record<string, any>) => {
      const store = getOrCreateStore(collectionPath);
      const existing = store.get(docId);
      // #88: real Firestore's `update()` carries an implicit "document must exist"
      // precondition and rejects with NOT_FOUND otherwise (the same semantic documented at
      // AvailabilityService.ts:110). Mirror it so tests cannot pass against a doc that is
      // absent in production.
      if (existing === undefined) {
        throw new Error(`NOT_FOUND: No document to update: ${docPath}`);
      }
      store.set(docId, { ...existing, ...data });
      docWrites.push({ path: docPath, id: docId, op: 'update', data: { ...data } });
    },
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
  docWrites.length = 0; // #88
  docStores.clear();
  Object.keys(collectionPaths).forEach((key) => delete collectionPaths[key]);

  // Restore default implementations that may have been overridden by individual tests
  mockDb.runTransaction.mockImplementation(async (fn: (t: any) => Promise<void>) => {
    await fn(mockTransaction);
  });
}
