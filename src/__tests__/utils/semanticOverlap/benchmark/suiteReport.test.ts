import { resolveImprovedSettings } from '../../../../utils/semanticOverlap/improved/settings';
import { resolveSettings } from '../../../../utils/semanticOverlap/settings';
import { formatScores, loadScenario, runScenario, scenarios } from './suite';

/**
 * Opt-in report over every scenario × approach with default settings:
 * OVERLAP_BENCHMARK=1 npx vitest run src/__tests__/utils/semanticOverlap/benchmark/suiteReport.test.ts
 * Scenarios whose metamodels are missing are listed as skipped, never failed.
 */
describe.skipIf(!process.env.OVERLAP_BENCHMARK)('benchmark suite report', () => {
  it('prints class and feature scores per scenario and approach', () => {
    const lines = ['Scenario            approach   class                     feature'];
    const ecoreUml: Record<string, number> = {};
    for (const scenario of scenarios()) {
      const loaded = loadScenario(scenario.id);
      if (!loaded) {
        lines.push(`${scenario.label.padEnd(20)}skipped (${scenario.origin} file missing)`);
        continue;
      }
      const runs = {
        paper: runScenario(loaded, 'paper', seed => resolveSettings({ seed })),
        improved: runScenario(loaded, 'improved', seed => resolveImprovedSettings({ seed })),
      };
      if (scenario.id === 'ecore-uml20') {
        ecoreUml.paper = runs.paper.scores.class.fMeasure;
        ecoreUml.improved = runs.improved.scores.class.fMeasure;
      }
      for (const [approach, run] of Object.entries(runs)) {
        lines.push(`${scenario.label.padEnd(20)}${approach.padEnd(11)}${formatScores(run.scores.class)}    ${formatScores(run.scores.feature)}`);
      }
    }
    console.log(lines.join('\n'));
    expect(lines.length).toBeGreaterThan(1);
    // The improved defaults may not lose more than 0.02 class-level F on Ecore -> UML 2.0.
    if (ecoreUml.paper !== undefined) expect(ecoreUml.improved).toBeGreaterThanOrEqual(ecoreUml.paper - 0.02);
  }, 600_000);
});
