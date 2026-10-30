import { improvementsOf, resolveImprovedSettings, type ImprovementId } from '../../../../utils/semanticOverlap/improved/settings';
import { resolveSettings } from '../../../../utils/semanticOverlap/settings';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { serializeOverlapResult } from '../../../../utils/semanticOverlap/overlapResult';
import { modelBasePath } from '../../../../utils/semanticOverlap/improved/embeddings/modelManifest';
import { MODEL_ROOT, embeddingTableFor } from './embeddingFixture';
import { familyMeans, formatScores, loadScenario, runScenario, scenarios, type ScenarioId, type Scores } from './suite';

/** Improvements of the improved approach's version 0.2 default. */
export const IMPROVED_02: readonly ImprovementId[] = ['type-object'];

/** How to provide the files of a skipped scenario. */
const FETCH_HINT = {
  downloaded: 'node scripts/fetch-overlap-benchmark.mjs',
  local: 'node scripts/fetch-overlap-benchmark.mjs --brake <brakesystem.ecore>',
  committed: '',
};

/**
 * Class-level F of paper approach and improved 0.2 on the scenarios of the 0.2 evaluation
 * (improved 0.2 baseline); they must not change while the suite grows.
 */
const RECORDED_02: Partial<Record<ScenarioId, { paper: number; improved: number }>> = {
  fig1: { paper: 1, improved: 1 },
  'ecore-uml20': { paper: 0.751, improved: 0.751 },
  'brake-bom': { paper: 0, improved: 1 },
  'bom-brake': { paper: 0, improved: 1 },
};

/**
 * Opt-in report over every scenario and family for the paper approach and improved 0.2:
 * OVERLAP_BENCHMARK=1 npx vitest run src/__tests__/utils/semanticOverlap/benchmark/suiteReport.test.ts
 * Scenarios whose metamodels are missing are listed as skipped, never failed.
 */
describe.skipIf(!process.env.OVERLAP_BENCHMARK)('benchmark suite report', () => {
  it('prints class and feature scores per scenario and family, and keeps the 0.2 scores', () => {
    const lines = ['Scenario                         approach     class                     feature'];
    const classScores = { paper: {} as Partial<Record<ScenarioId, Scores>>, improved: {} as Partial<Record<ScenarioId, Scores>> };
    for (const scenario of scenarios()) {
      const loaded = loadScenario(scenario.id);
      if (!loaded) {
        lines.push(`${scenario.label.padEnd(33)}skipped: ${scenario.origin} file missing (${FETCH_HINT[scenario.origin]})`);
        continue;
      }
      const runs = {
        paper: runScenario(loaded, 'paper', seed => resolveSettings({ seed })),
        improved: runScenario(loaded, 'improved', seed => resolveImprovedSettings({ seed, improvements: improvementsOf(IMPROVED_02) })),
      };
      for (const [approach, run] of Object.entries(runs) as ['paper' | 'improved', typeof runs.paper][]) {
        classScores[approach][scenario.id] = run.scores.class;
        lines.push(`${scenario.label.padEnd(33)}${(approach === 'paper' ? 'paper' : 'improved 0.2').padEnd(13)}`
          + `${formatScores(run.scores.class)}    ${formatScores(run.scores.feature)}`);
      }
    }
    lines.push('', 'Family                 paper                     improved 0.2');
    const families = { paper: familyMeans(classScores.paper), improved: familyMeans(classScores.improved) };
    for (const family of Object.keys(families.paper.perFamily) as (keyof typeof families.paper.perFamily)[]) {
      lines.push(`${family.padEnd(23)}${formatScores(families.paper.perFamily[family])}    ${formatScores(families.improved.perFamily[family])}`);
    }
    lines.push(`${'average over families'.padEnd(23)}${formatScores(families.paper.average)}    ${formatScores(families.improved.average)}`);
    process.stdout.write(`${lines.join('\n')}\n`);

    for (const [id, recorded] of Object.entries(RECORDED_02) as [ScenarioId, { paper: number; improved: number }][]) {
      if (!classScores.paper[id]) continue;
      expect({ id, f: classScores.paper[id]!.fMeasure }).toEqual({ id, f: expect.closeTo(recorded.paper, 3) });
      expect({ id, f: classScores.improved[id]!.fMeasure }).toEqual({ id, f: expect.closeTo(recorded.improved, 3) });
    }
  }, 1_800_000);
});

const MODEL_PRESENT = existsSync(path.join(MODEL_ROOT, modelBasePath('minilm'), 'manifest.json'));

/** Opt-in: the embedding improvement alone gives identical results on repeated runs. */
describe.skipIf(!process.env.OVERLAP_BENCHMARK || !MODEL_PRESENT)('embedding determinism (local model)', () => {
  it.each(['fig1', 'wimmer-1'] as ScenarioId[])('%s: two runs with the same seed are identical', async id => {
    const loaded = loadScenario(id)!;
    const settings = () => resolveImprovedSettings({ seed: 1, improvements: improvementsOf(['embeddings']) });
    const run = async () => runScenario(loaded, 'improved', settings, [1], await embeddingTableFor(loaded)).results[0];
    const [first, second] = [await run(), await run()];
    expect(first.embeddingModel?.id).toBe('minilm');
    expect(first.correspondences.some(c => c.scores.embedding !== undefined)).toBe(true);
    expect(serializeOverlapResult(second)).toBe(serializeOverlapResult(first));
  }, 120_000);
});

/**
 * Opt-in regression checks of the improved approach's current default against improved 0.2 on the
 * whole suite. A missed criterion fails here.
 */
describe.skipIf(!process.env.OVERLAP_BENCHMARK)('improved default vs. improved 0.2', () => {
  const runDefault = async () => {
    const perScenario: Partial<Record<ScenarioId, Scores>> = {};
    const before: Partial<Record<ScenarioId, Scores>> = {};
    const results: Partial<Record<ScenarioId, ReturnType<typeof runScenario>['results']>> = {};
    for (const scenario of scenarios()) {
      const loaded = loadScenario(scenario.id);
      if (!loaded) continue;
      const table = MODEL_PRESENT ? await embeddingTableFor(loaded) : null;
      const current = runScenario(loaded, 'improved', seed => resolveImprovedSettings({ seed }), undefined, table);
      perScenario[scenario.id] = current.scores.class;
      results[scenario.id] = current.results;
      before[scenario.id] = runScenario(loaded, 'improved', seed => resolveImprovedSettings({ seed, improvements: improvementsOf(IMPROVED_02) })).scores.class;
    }
    return { current: familyMeans(perScenario), previous: familyMeans(before), perScenario, results };
  };
  let run: Awaited<ReturnType<typeof runDefault>>;
  beforeAll(async () => { run = await runDefault(); }, 3_600_000);

  it('raises the Wimmer family F by at least 0.15', () => {
    expect(run.current.perFamily.wimmer!.fMeasure).toBeGreaterThanOrEqual(run.previous.perFamily.wimmer!.fMeasure + 0.15);
  });

  it('raises the family average, loses at most 0.02 per family, keeps Brake ↔ BOM and 5 of 6 Fig. 1 correspondences', () => {
    expect(run.current.average.fMeasure).toBeGreaterThan(run.previous.average.fMeasure);
    for (const [family, scores] of Object.entries(run.current.perFamily)) {
      const previous = run.previous.perFamily[family as keyof typeof run.previous.perFamily]!.fMeasure;
      expect({ family, f: scores!.fMeasure >= previous - 0.02 - 1e-9 }).toEqual({ family, f: true });
    }
    if (run.perScenario['brake-bom']) expect(run.perScenario['brake-bom'].fMeasure).toBeCloseTo(1, 3);
    if (run.perScenario['bom-brake']) expect(run.perScenario['bom-brake'].fMeasure).toBeCloseTo(1, 3);
    const fig1 = loadScenario('fig1')!;
    const expected = [...fig1.reference.correspondences, ...(fig1.reference.features ?? [])];
    for (const result of run.results.fig1!) {
      const keys = new Set([...result.correspondences, ...result.correspondences.flatMap(c => c.children ?? [])]
        .flatMap(c => c.sources.flatMap(s => c.targets.map(t => `${s.qualifiedName}->${t.qualifiedName}`))));
      const found = expected.filter(e => e.sources.every(s => e.targets.every(t => keys.has(`${s}->${t}`))));
      expect(found.length).toBeGreaterThanOrEqual(5);
    }
  });

  it('finds Tree.parent ↔ Node.incoming.source as a path in at least 8 of 10 seeds', () => {
    const hits = run.results.tree2graph!.filter(result => result.correspondences.flatMap(c => c.children ?? []).some(c => c.kind === 'path'
      && c.sources[0].qualifiedName === 'tree.Tree.parent' && c.targets[0].qualifiedName === 'graph.Node.incoming.source'));
    expect(hits.length).toBeGreaterThanOrEqual(8);
  });
});
