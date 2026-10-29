import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { IMPROVEMENT_IDS } from '../../../../utils/semanticOverlap/improved/settings';
import {
  availableScenarios, classifyDelta, delta, evaluateConfiguration, evaluatePaper, selectCombination,
  type ConfigurationResult, type Decision,
} from './ablation';
import { SEEDS, formatScores, scenarios, type ScenarioId } from './suite';

/**
 * Opt-in ablation of the improved approach's improvements over all available benchmark scenarios
 * (seeds 1–10):
 * OVERLAP_ABLATION=1 OVERLAP_REPORT_DIR=<dir> npx vitest run src/__tests__/utils/semanticOverlap/benchmark/ablation.test.ts
 */
const formatDelta = (value: number | undefined) => (value === undefined ? '   –  ' : `${value >= 0 ? '+' : ''}${value.toFixed(3)}`);

function table(title: string, rows: { label: string; result: ConfigurationResult; decision?: Decision }[], ids: ScenarioId[]): string {
  const header = `${'configuration'.padEnd(36)}${ids.map(id => id.padEnd(14)).join('')}average   Δavg    class`;
  return [title, header, ...rows.map(({ label, result, decision }) => [
    label.padEnd(36),
    ids.map(id => (result.perScenario[id]?.class.fMeasure.toFixed(3) ?? '–').padEnd(14)).join(''),
    result.average.fMeasure.toFixed(3).padEnd(10),
    decision ? formatDelta(decision.delta.average).padEnd(8) : ''.padEnd(8),
    decision?.classification ?? '',
  ].join(''))].join('\n');
}

describe.skipIf(!process.env.OVERLAP_ABLATION)('improvement ablation', () => {
  it('evaluates every improvement on its own and selects the combination', () => {
    const loaded = availableScenarios();
    const ids = loaded.map(s => s.scenario.id);
    const paper = evaluatePaper(loaded);
    const baseline = evaluateConfiguration([], loaded);
    const singles = IMPROVEMENT_IDS.map(id => {
      const result = evaluateConfiguration([id], loaded);
      const d = delta(baseline, result);
      const classification = classifyDelta(d);
      const decision: Decision = {
        improvement: id, step: 'single', delta: d, classification, kept: classification === 'helpful',
        reason: `alone vs. all off: Δavg ${formatDelta(d.average)}`,
      };
      return { result, decision };
    });

    const combination = selectCombination(enabled => evaluateConfiguration(enabled, loaded), singles.map(s => s.decision));
    const final = evaluateConfiguration(combination.final, loaded);

    const report = {
      createdAt: new Date().toISOString(),
      seeds: SEEDS,
      scenarios: scenarios().map(s => ({ id: s.id, origin: s.origin, available: s.available })),
      paper,
      baseline,
      singles: singles.map(s => ({ ...s.result, decision: s.decision })),
      steps: combination.steps,
      final,
      provisional: !ids.includes('ecore-uml20'),
    };
    console.log([
      table('Baselines (class-level F per scenario)', [
        { label: 'paper approach', result: paper }, { label: 'improved, all off', result: baseline },
      ], ids),
      table('Single improvements vs. all off', singles.map(s => ({ label: s.decision.improvement, ...s })), ids),
      ...singles.map(s => `${s.decision.improvement.padEnd(18)} ${ids.map(id => `${id} ${formatScores(s.result.perScenario[id]?.class)}`).join(' | ')}`),
      ['Combination steps', ...combination.steps.map(step =>
        `${step.step.padEnd(14)}${step.improvement.padEnd(18)}Δavg ${formatDelta(step.delta.average)}  `
        + `${ids.map(id => `${id} ${formatDelta(step.delta.perScenario[id])}`).join('  ')}  ${step.classification.padEnd(8)} ${step.kept ? 'keep' : 'drop'}`)].join('\n'),
      table(`Final combination: ${combination.final.join(', ') || '(none)'}`, [
        { label: 'paper approach', result: paper }, { label: 'final', result: final },
      ], ids),
      ids.map(id => `${id.padEnd(14)} class ${formatScores(final.perScenario[id]?.class)}   feature ${formatScores(final.perScenario[id]?.feature)}`).join('\n'),
    ].join('\n\n'));
    if (process.env.OVERLAP_REPORT_DIR) {
      mkdirSync(process.env.OVERLAP_REPORT_DIR, { recursive: true });
      writeFileSync(path.join(process.env.OVERLAP_REPORT_DIR, `ablation-${report.createdAt.replace(/[:.]/g, '-')}.json`),
        `${JSON.stringify(report, null, 2)}\n`);
    }
    expect(singles).toHaveLength(IMPROVEMENT_IDS.length);
  }, 1_800_000);
});
