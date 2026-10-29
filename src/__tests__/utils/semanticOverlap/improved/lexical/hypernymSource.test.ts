import { createHypernymSource, type HypernymTable } from '../../../../../utils/semanticOverlap/improved/lexical/hypernymSource';
import realTable from '../../../../../assets/wordnet/oewn-2025-hypernyms.json';

// entity(0) → part(1) → component(2), item(3); entity(0) → instrument(4) → caliper(5)
const table: HypernymTable = {
  source: 'test', version: '1', license: '-', url: '-',
  words: ['caliper', 'component', 'entity', 'item', 'part'],
  senses: [[5, 2], [2], [0], [3], [1]],
  parents: [[], [0], [1], [1], [0], [4]],
};
const source = createHypernymSource(table);

describe('hypernym source', () => {
  it('computes the depth as the longest path to a root', () => {
    expect(source.depth(0)).toBe(1);
    expect(source.depth(2)).toBe(3);
    expect(source.depth(5)).toBe(3);
  });

  it('computes Wu-Palmer similarity over the first senses', () => {
    // lcs(component, item) = part (depth 2): 2·2 / (3 + 3)
    expect(source.wuPalmer('component', 'item', 3)).toBeCloseTo(4 / 6);
    // caliper's first sense is the instrument (lcs entity: 2·1/6); its second sense is a component.
    expect(source.wuPalmer('caliper', 'item', 1)).toBeCloseTo(2 / 6);
    expect(source.wuPalmer('caliper', 'item', 2)).toBeCloseTo(4 / 6);
  });

  it('gives 1 for the same known word and 0 for unknown words', () => {
    expect(source.wuPalmer('item', 'item', 3)).toBe(1);
    expect(source.wuPalmer('item', 'gadget', 3)).toBe(0);
    expect(source.isWord('item')).toBe(true);
    expect(source.senses('gadget')).toEqual([]);
  });

  it('relates component and item in the bundled Open English WordNet table', () => {
    const real = createHypernymSource(realTable as HypernymTable);
    expect(real.wuPalmer('component', 'item', 3)).toBeGreaterThan(0.5);
    expect(real.wuPalmer('component', 'item', 3)).toBeGreaterThan(real.wuPalmer('component', 'brake', 3));
  });
});
