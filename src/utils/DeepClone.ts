/**
 * Deeply clones plain objects, collections, dates, regex values, and circular references.
 * @template T
 * @param {T} obj - Value to clone.
 * @param {WeakMap<object, unknown>} seen - Cache used for circular-reference handling.
 * @returns {T} Deep-cloned value.
 */
export function deepClone<T>(obj: T, seen = new WeakMap()): T {
  // Primitives & functions
  if (obj === null || typeof obj !== "object")
    return obj;

  // Circular reference
  if (seen.has(obj))
    return seen.get(obj);

  // Special cases
  if (obj instanceof Date)
    return new Date(obj) as T;
  if (obj instanceof RegExp)
    return new RegExp(obj) as T;
  if (obj instanceof Map) {
    const map = new Map();
    seen.set(obj, map);
    obj.forEach((v, k) => {
      map.set(deepClone(k, seen), deepClone(v, seen));
    });
    return map as T;
  }
  if (obj instanceof Set) {
    const set = new Set();
    seen.set(obj, set);
    obj.forEach(v => set.add(deepClone(v, seen)));
    return set as T;
  }

  // Create clone with same prototype
  const clone = Object.create(Object.getPrototypeOf(obj));
  seen.set(obj, clone);

  // Copy all properties (incl. non-enumerable & symbols)
  for (const key of Reflect.ownKeys(obj)) {
    const desc = Object.getOwnPropertyDescriptor(obj, key);
    if (desc == undefined)
      continue;
    if ("value" in desc) {
      desc.value = deepClone(desc.value, seen);
    }
    Object.defineProperty(clone, key, desc);
  }

  return clone;
}
