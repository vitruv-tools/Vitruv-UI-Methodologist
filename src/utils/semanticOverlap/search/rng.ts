/** Seeded pseudo-random numbers, so analyses with a fixed seed are reproducible. */
export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
  pick<T>(items: readonly T[]): T;
  /** Fisher–Yates shuffle of a copy. */
  shuffle<T>(items: readonly T[]): T[];
}

/** mulberry32: small, fast 32-bit generator; good enough for search heuristics, not for security. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (maxExclusive: number) => Math.floor(next() * maxExclusive);
  return {
    next,
    int,
    pick: items => items[int(items.length)],
    shuffle: items => {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = int(i + 1);
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
  };
}

/** A fresh uint32 seed for new analyses (not used inside the search). */
export function randomSeed(): number {
  return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
}

/** Deterministic 32-bit string hash (FNV-1a), e.g. to derive child seeds. */
export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
