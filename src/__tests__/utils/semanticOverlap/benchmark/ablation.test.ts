import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { EmbeddingTable } from '../../../../utils/semanticOverlap/improved/embeddings/types';
import { IMPROVEMENT_IDS, type ImprovementId } from '../../../../utils/semanticOverlap/improved/settings';
import {
  availableScenarios, classifyDelta, delta, evaluateConfiguration, evaluatePaper, selectCombination,
  type ConfigurationResult, type Decision, type EvaluationContext,
} from './ablation';
import type { Calibration } from './calibrate';
import { embeddingTableFor } from './embeddingFixture';
import { FAMILY_IDS, SEEDS, formatScores, scenarios, type FamilyId, type LoadedScenario, type ScenarioId } from './suite';

/**
 * Opt-in ablation of the improved approach's improvements over all available benchmark scenarios
 * (seeds 1–10), decided on family averages:
 * OVERLAP_ABLATION=1 OVERLAP_REPORT_DIR=<dir> npx vitest run src/__tests__/utils/semanticOverlap/benchmark/ablation.test.ts
 * With the embedding model fetched (`node scripts/fetch-embedding-model.mjs`, and `--model bge-small`
 * for the comparison) the `embeddings` improvement is evaluated; otherwise it is reported as skipped.
 */
const formatDelta = (value: number | undefined) => (value === undefined ? '   –  ' : `${value >= 0 ? '+' : ''}${value.toFixed(3)}`);

function table(title: string, rows: { label: string; result: ConfigurationResult; decision?: Decision }[], families: FamilyId[]): string {
  const header = `${'configuration'.padEnd(36)}${families.map(id => id.padEnd(16)).join('')}average   Δavg    class`;
  return [title, header, ...rows.map(({ label, result, decision }) => [
    label.padEnd(36),
    families.map(id => (result.perFamily[id]?.fMeasure.toFixed(3) ?? '–').padEnd(16)).join(''),
    result.average.fMeasure.toFixed(3).padEnd(10),
    decision ? formatDelta(decision.delta.average).padEnd(8) : ''.padEnd(8),
    decision?.classification ?? '',
  ].join(''))].join('\n');
}

/** Embedding tables of all scenarios for a model, built before the (synchronous) runs. */
async function embeddingTables(loaded: readonly LoadedScenario[], model: 'minilm' | 'bge-small') {
  const tables = new Map<ScenarioId, EmbeddingTable | null>();
  for (const scenario of loaded) tables.set(scenario.scenario.id, await embeddingTableFor(scenario, model));
  return { available: [...tables.values()].every(t => t !== null), lookup: (s: LoadedScenario) => tables.get(s.scenario.id) ?? null };
}

describe.skipIf(!process.env.OVERLAP_ABLATION)('improvement ablation', () => {
  it('evaluates every improvement on its own and selects the combination', async () => {
    const loaded = availableScenarios();
    const ids = loaded.map(s => s.scenario.id);
    const families = FAMILY_IDS.filter(id => loaded.some(s => s.scenario.family === id));
    const minilm = await embeddingTables(loaded, 'minilm');
    const calibrations: Calibration[] = [];
    const context: EvaluationContext = { embeddings: minilm.lookup, calibrations };
    // Without the model, `embeddings` alone equals all off; it is reported as skipped.
    const evaluated = IMPROVEMENT_IDS.filter(id => id !== 'embeddings' || minilm.available);
    const evaluate = (enabled: ImprovementId[]) => evaluateConfiguration(enabled, loaded, context);
    const paper = evaluatePaper(loaded);
    const baseline = evaluate([]);
    const singles = evaluated.map(id => {
      const result = evaluate([id]);
      const d = delta(baseline, result);
      const classification = classifyDelta(d);
      const decision: Decision = {
        improvement: id, step: 'single', delta: d, classification, kept: classification === 'helpful',
        reason: `alone vs. all off: Δ family average ${formatDelta(d.average)}`,
      };
      return { result, decision };
    });

    const combination = selectCombination(enabled => evaluate(enabled.filter(id => evaluated.includes(id))), singles.map(s => s.decision));
    const final = evaluate(combination.final);
    const modelComparison = combination.final.includes('embeddings')
      ? await (async () => {
        const bge = await embeddingTables(loaded, 'bge-small');
        if (!bge.available) return { skipped: 'bge-small model not present' };
        const result = evaluateConfiguration(combination.final, loaded, { embeddings: bge.lookup, params: { embeddingModel: 'bge-small' } });
        return { minilm: final, bgeSmall: result, delta: delta(final, result) };
      })()
      : { skipped: 'the final combination does not use embeddings' };

    const report = {
      createdAt: new Date().toISOString(),
      seeds: SEEDS,
      scenarios: scenarios().map(s => ({ id: s.id, family: s.family, origin: s.origin, available: s.available })),
      families: FAMILY_IDS.map(id => ({ id, scenarios: scenarios().filter(s => s.family === id).map(s => s.id), available: families.includes(id) })),
      embeddingModel: minilm.available ? (await embeddingTableFor(loaded[0], 'minilm'))?.model ?? null : null,
      ...(minilm.available ? {} : { skipped: { embeddings: 'model not present' } }),
      paper,
      baseline,
      singles: singles.map(s => ({ ...s.result, decision: s.decision })),
      steps: combination.steps,
      final,
      calibrations,
      modelComparison,
      provisional: !ids.includes('ecore-uml20'),
    };
    process.stdout.write(`${[
      table('Baselines (class-level F per family)', [
        { label: 'paper approach', result: paper }, { label: 'improved, all off', result: baseline },
      ], families),
      table('Single improvements vs. all off', singles.map(s => ({ label: s.decision.improvement, ...s })), families),
      ...singles.map(s => `${s.decision.improvement.padEnd(18)} ${ids.map(id => `${id} ${s.result.perScenario[id]?.class.fMeasure.toFixed(2) ?? '–'}`).join(' | ')}`),
      ['Combination steps', ...combination.steps.map(step =>
        `${step.step.padEnd(14)}${step.improvement.padEnd(18)}Δavg ${formatDelta(step.delta.average)}  `
        + `${families.map(id => `${id} ${formatDelta(step.delta.perFamily[id])}`).join('  ')}  ${step.classification.padEnd(8)} ${step.kept ? 'keep' : 'drop'}`)].join('\n'),
      table(`Final combination: ${combination.final.join(', ') || '(none)'}`, [
        { label: 'paper approach', result: paper }, { label: 'final', result: final },
      ], families),
      ids.map(id => `${id.padEnd(14)} class ${formatScores(final.perScenario[id]?.class)}   feature ${formatScores(final.perScenario[id]?.feature)}`).join('\n'),
      `Calibrations: ${calibrations.map(c => `${c.configuration.join('+')}: τ* ${c.tau}`).join('; ') || 'none'}`,
    ].join('\n\n')}\n`);
    if (process.env.OVERLAP_REPORT_DIR) {
      mkdirSync(process.env.OVERLAP_REPORT_DIR, { recursive: true });
      writeFileSync(path.join(process.env.OVERLAP_REPORT_DIR, `ablation-${report.createdAt.replace(/[:.]/g, '-')}.json`),
        `${JSON.stringify(report, null, 2)}\n`);
    }
    expect(singles).toHaveLength(evaluated.length);
  }, 14_400_000);
});
