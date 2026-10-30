/**
 * Cache of sentence-embedding vectors across analyses. A cached vector equals a recomputed one
 * (batch size 1, fixed runtime), so the cache never changes results; it only saves time.
 */
export interface EmbeddingCache {
  get(key: string): Promise<Float32Array | undefined>;
  set(key: string, vector: Float32Array): Promise<void>;
}

/** Cache key of a text's vector: the model's checksum and the text. */
export const cacheKey = (sha256: string, text: string) => `${sha256}|${text}`;

/** In-memory cache for tests and the benchmark. */
export function memoryEmbeddingCache(): EmbeddingCache {
  const vectors = new Map<string, Float32Array>();
  return {
    get: key => Promise.resolve(vectors.get(key)),
    set: (key, vector) => {
      vectors.set(key, vector);
      return Promise.resolve();
    },
  };
}

const DATABASE = 'semantic-overlap-embeddings';
const STORE = 'vectors';

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

/**
 * IndexedDB cache (browser and worker), database `semantic-overlap-embeddings`, store `vectors`.
 * A no-op where IndexedDB is unavailable; failures count as misses.
 */
export function indexedDbEmbeddingCache(factory: IDBFactory | undefined = globalThis.indexedDB): EmbeddingCache {
  if (!factory) return { get: () => Promise.resolve(undefined), set: () => Promise.resolve() };
  let database: Promise<IDBDatabase> | null = null;
  const open = () => {
    database ??= new Promise((resolve, reject) => {
      const req = factory.open(DATABASE, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB could not be opened'));
    });
    return database;
  };
  return {
    get: async key => {
      try {
        const value = await request((await open()).transaction(STORE, 'readonly').objectStore(STORE).get(key));
        return value instanceof Float32Array ? value : undefined;
      } catch {
        return undefined;
      }
    },
    set: async (key, vector) => {
      try {
        await request((await open()).transaction(STORE, 'readwrite').objectStore(STORE).put(vector, key));
      } catch {
        // A vector that cannot be cached is computed again next time.
      }
    },
  };
}
