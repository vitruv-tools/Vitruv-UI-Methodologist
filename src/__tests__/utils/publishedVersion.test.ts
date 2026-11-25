import { describe, expect, it } from 'vitest';
import { publishedLayoutPositions, publishedVersionPath } from '../../utils/publishedVersion';

describe('publishedVersionPath', () => {
  it('is the read-only page of the project', () => {
    expect(publishedVersionPath(23)).toBe('/canvas/23/published');
  });
});

describe('publishedLayoutPositions', () => {
  it('reads the box position of each metamodel, keyed by its library id', () => {
    const positions = publishedLayoutPositions({
      metaModels: { '6': { x: 10, y: 20 }, '12': { x: -5.5, y: 0 } },
      reactions: { '6': { box: { x: 1, y: 1 } } },
    });

    expect([...positions.entries()]).toEqual([
      [6, { x: 10, y: 20 }],
      [12, { x: -5.5, y: 0 }],
    ]);
  });

  it('skips entries that are not a finite position under a numeric id', () => {
    const positions = publishedLayoutPositions({
      metaModels: {
        '6': { x: 10 },
        '7': { x: 'a', y: 1 },
        '8': { x: Number.POSITIVE_INFINITY, y: 1 },
        abc: { x: 1, y: 1 },
        '9': null,
        '10': { x: 3, y: 4 },
      },
    });

    expect([...positions.entries()]).toEqual([[10, { x: 3, y: 4 }]]);
  });

  it('is empty without a usable layout', () => {
    expect(publishedLayoutPositions(undefined).size).toBe(0);
    expect(publishedLayoutPositions(null).size).toBe(0);
    expect(publishedLayoutPositions('layout').size).toBe(0);
    expect(publishedLayoutPositions({ metaModels: [] }).size).toBe(0);
  });
});
