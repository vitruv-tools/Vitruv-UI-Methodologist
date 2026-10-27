import { createRng, hashString, randomSeed } from '../../../../utils/semanticOverlap/search/rng';

describe('createRng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    expect(Array.from({ length: 5 }, () => a.next())).toEqual(Array.from({ length: 5 }, () => b.next()));
  });

  it('produces different sequences for different seeds', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });

  it('keeps int() and next() in range', () => {
    const rng = createRng(3);
    for (let i = 0; i < 1000; i++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      const int = rng.int(7);
      expect(Number.isInteger(int) && int >= 0 && int < 7).toBe(true);
    }
  });

  it('shuffles a copy deterministically', () => {
    const items = [1, 2, 3, 4, 5];
    const shuffled = createRng(9).shuffle(items);
    expect(items).toEqual([1, 2, 3, 4, 5]);
    expect([...shuffled].sort()).toEqual(items);
    expect(createRng(9).shuffle(items)).toEqual(shuffled);
  });

  it('hashes strings deterministically and returns uint32 seeds', () => {
    expect(hashString('c-1')).toBe(hashString('c-1'));
    expect(hashString('c-1')).not.toBe(hashString('c-2'));
    const seed = randomSeed();
    expect(Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff).toBe(true);
  });
});
