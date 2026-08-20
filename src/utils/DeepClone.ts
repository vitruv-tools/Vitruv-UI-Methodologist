/**
 * Store-safe deep cloning utilities.
 *
 * Zustand store reads should return cloned data so callers
 * can freely mutate without affecting store state.
 */

export function deepClone<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;

  if (value instanceof Set) {
    return new Set(Array.from(value).map(item => deepClone(item))) as unknown as T;
  }

  if (value instanceof Map) {
    const cloned = new Map();
    value.forEach((v, k) => cloned.set(deepClone(k), deepClone(v)));
    return cloned as unknown as T;
  }

  if (Array.isArray(value)) {
    return value.map(item => deepClone(item)) as unknown as T;
  }

  if (value instanceof Date) {
    return new Date(value) as unknown as T;
  }

  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    result[key] = deepClone((value as Record<string, unknown>)[key]);
  }
  return result as T;
}

export function deepCloneArray<T>(arr: T[]): T[] {
  return arr.map(item => deepClone(item));
}
