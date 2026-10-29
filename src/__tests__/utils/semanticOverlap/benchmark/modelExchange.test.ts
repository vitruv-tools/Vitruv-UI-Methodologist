import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { readMetamodelGraph } from '../../../../utils/semanticOverlap/ecore/readMetamodelGraph';
import { createWordNetSource } from '../../../../utils/semanticOverlap/lexical/wordNetSource';
import { runOverlapAnalysis } from '../../../../utils/semanticOverlap/runOverlapAnalysis';
import { resolveSettings } from '../../../../utils/semanticOverlap/settings';
import type { OverlapResult } from '../../../../utils/semanticOverlap/types';
import table from '../../../../assets/wordnet/oewn-2025-synonyms.json';
import { BENCHMARK_DIR, METAMODEL_DIR, SEEDS, evaluate, formatScores, mean, type Scores } from './suite';

export { evaluate } from './suite';

/**
 * Model exchange experiment of Kessentini et al. (2014, §5.1.1) on the ModelCVS metamodels.
 * Opt-in: OVERLAP_BENCHMARK=1 npx vitest run src/__tests__/utils/semanticOverlap/benchmark
 * (fetch the metamodels first with `node scripts/fetch-overlap-benchmark.mjs`).
 */
interface Expected { source: string; target: string; scenario: string; correspondences: { sources: string[]; targets: string[] }[] }

/** Paper Appendix A, GAMMA (their approach), per scenario. */
const PAPER: Record<string, Scores> = {
  'Ecore -> UML 2.0 CD': { precision: 0.64, recall: 0.89, fMeasure: 0.75 },
};
const PAPER_AVERAGE: Scores = { precision: 0.79, recall: 0.72, fMeasure: 0.74 };
const TOLERANCE = 0.1;

const lexical = createWordNetSource(table);

const load = (file: string, id: number) =>
  readMetamodelGraph(readFileSync(path.join(METAMODEL_DIR, file), 'utf8'), {
    libraryId: id, name: file, ecoreFileId: id, contentHash: file,
  });

/** Class-level precision, recall and F-measure on (source class, target class) pairs (§5.2). */
const evaluateClasses = (result: OverlapResult, expected: Expected): Scores =>
  evaluate(result, { correspondences: expected.correspondences }).class;

const format = formatScores;

const scenarios = (): Expected[] => ['ecore-uml20.expected.json']
  .map(file => JSON.parse(readFileSync(path.join(BENCHMARK_DIR, file), 'utf8')) as Expected);

describe.skipIf(!process.env.OVERLAP_BENCHMARK)('model exchange benchmark (SC-004)', () => {
  it('reaches the paper\'s results minus 0.10', () => {
    if (!existsSync(METAMODEL_DIR)) throw new Error('Run `node scripts/fetch-overlap-benchmark.mjs` first.');
    const perScenario = scenarios().map(expected => {
      const source = load(expected.source, 1);
      const target = load(expected.target, 2);
      const runs = SEEDS.map(seed => evaluateClasses(
        runOverlapAnalysis({ source, target, settings: resolveSettings({ seed }) }, { lexical }), expected));
      return { expected, scores: mean(runs) };
    });
    const average = mean(perScenario.map(s => s.scores));

    console.log(['Scenario'.padEnd(24) + 'measured                  paper (GAMMA)',
      ...perScenario.map(({ expected, scores }) =>
        `${expected.scenario.padEnd(24)}${format(scores)}    ${PAPER[expected.scenario] ? format(PAPER[expected.scenario]) : '–'}`),
      `${'Average'.padEnd(24)}${format(average)}    ${format(PAPER_AVERAGE)}`].join('\n'));

    for (const { expected, scores } of perScenario) {
      const paper = PAPER[expected.scenario];
      if (!paper) continue;
      expect(scores.precision).toBeGreaterThanOrEqual(paper.precision - TOLERANCE);
      expect(scores.recall).toBeGreaterThanOrEqual(paper.recall - TOLERANCE);
      expect(scores.fMeasure).toBeGreaterThanOrEqual(paper.fMeasure - TOLERANCE);
    }
    // Averages only say something across several scenarios; with one they repeat the scenario.
    if (perScenario.length > 1) {
      expect(average.precision).toBeGreaterThanOrEqual(PAPER_AVERAGE.precision - TOLERANCE);
      expect(average.recall).toBeGreaterThanOrEqual(PAPER_AVERAGE.recall - TOLERANCE);
      expect(average.fMeasure).toBeGreaterThanOrEqual(PAPER_AVERAGE.fMeasure - TOLERANCE);
    }
  }, 600_000);
});

describe('model exchange benchmark smoke check', () => {
  it.skipIf(!existsSync(METAMODEL_DIR))('produces a result for Ecore -> UML 2.0 with one fast run', () => {
    const result = runOverlapAnalysis(
      { source: load('Ecore.ecore', 1), target: load('UML_2.0_CD.ecore', 2), settings: resolveSettings({ seed: 1 }, 'fast') },
      { lexical },
    );
    expect(result.correspondences.length).toBeGreaterThan(0);
  }, 60_000);
});
