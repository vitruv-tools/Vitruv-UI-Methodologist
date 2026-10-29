import { createHypernymSource, type HypernymTable } from '../../../../../utils/semanticOverlap/improved/lexical/hypernymSource';
import { hypernymSimilarity } from '../../../../../utils/semanticOverlap/improved/measures/hypernymMeasure';
import { nameTokens } from '../../../../../utils/semanticOverlap/improved/measures/profiles';
import { DEFAULT_IMPROVED_SETTINGS } from '../../../../../utils/semanticOverlap/improved/settings';
import { createWordNetSource } from '../../../../../utils/semanticOverlap/lexical/wordNetSource';
import synonymTable from '../../../../../assets/wordnet/oewn-2025-synonyms.json';
import hypernymTable from '../../../../../assets/wordnet/oewn-2025-hypernyms.json';

const table: HypernymTable = {
  source: 'test', version: '1', license: '-', url: '-',
  words: ['component', 'entity', 'item', 'part'],
  senses: [[2], [0], [3], [1]],
  parents: [[], [0], [1], [1]],
};
const tokens = (list: string[], weights?: number[]) => ({ tokens: list, tokenSynonyms: list.map(() => new Set<string>()), tokenWeights: weights });
const ctx = (hypernyms = createHypernymSource(table)) => ({ settings: DEFAULT_IMPROVED_SETTINGS, hypernyms });

describe('hypernym measure', () => {
  it('averages the best Wu-Palmer match per token in both directions', () => {
    // component ↔ item = 2·2/(3+3); entity has no counterpart beyond depth 1 (2·1/(1+3)).
    expect(hypernymSimilarity(tokens(['component']), tokens(['item']), ctx())).toBeCloseTo(4 / 6);
    const a = tokens(['component', 'entity']);
    const b = tokens(['item']);
    expect(hypernymSimilarity(a, b, ctx())).toBeCloseTo(((4 / 6 + 0.5) / 2 + 4 / 6) / 2);
  });

  it('weights tokens by their IDF', () => {
    const weighted = hypernymSimilarity(tokens(['component', 'entity'], [1, 0]), tokens(['item']), ctx());
    expect(weighted).toBeCloseTo(4 / 6);
  });

  it('is 0 without hypernym data', () => {
    expect(hypernymSimilarity(tokens(['component']), tokens(['item']), { settings: DEFAULT_IMPROVED_SETTINGS, hypernyms: null })).toBe(0);
  });

  it('relates BrakeComponent and Item with the bundled table', () => {
    const lexical = createWordNetSource(synonymTable);
    const real = createHypernymSource(hypernymTable as HypernymTable);
    const named = (name: string) => tokens(nameTokens(name, lexical));
    expect(hypernymSimilarity(named('BrakeComponent'), named('Item'), ctx(real))).toBeGreaterThan(0.5);
  });
});
