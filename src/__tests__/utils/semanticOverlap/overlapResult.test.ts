import { createWordNetSource } from '../../../utils/semanticOverlap/lexical/wordNetSource';
import { OverlapResultFormatError, parseOverlapResult, serializeOverlapResult } from '../../../utils/semanticOverlap/overlapResult';
import { runOverlapAnalysis } from '../../../utils/semanticOverlap/runOverlapAnalysis';
import { resolveSettings } from '../../../utils/semanticOverlap/settings';
import table from '../../../assets/wordnet/oewn-2025-synonyms.json';
import { ecoreExcerpt, umlExcerpt } from './fixtures';

const result = runOverlapAnalysis(
  { source: ecoreExcerpt(), target: umlExcerpt(), settings: resolveSettings({ seed: 3 }, 'fast') },
  { lexical: createWordNetSource(table), now: () => 0, createId: () => 'r' },
);

describe('overlap result format', () => {
  it('round-trips through JSON unchanged (SC-008)', () => {
    expect(parseOverlapResult(serializeOverlapResult(result))).toEqual(result);
  });

  it.each([
    ['not JSON', () => '{'],
    ['another schema version', () => JSON.stringify({ ...result, schemaVersion: 2 })],
    ['a missing source', () => JSON.stringify({ ...result, source: undefined })],
    ['a non-uint32 seed', () => JSON.stringify({ ...result, settings: { ...result.settings, seed: -3 } })],
    ['a score out of range', () => JSON.stringify({ ...result, correspondences: [{ ...result.correspondences[0], score: 1.5 }] })],
    ['a correspondence without targets', () => JSON.stringify({ ...result, correspondences: [{ ...result.correspondences[0], targets: [] }] })],
  ])('rejects %s', (_label, make) => {
    expect(() => parseOverlapResult(make())).toThrow(OverlapResultFormatError);
  });
});
