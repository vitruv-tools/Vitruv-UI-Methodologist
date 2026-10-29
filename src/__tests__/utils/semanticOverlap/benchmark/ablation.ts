import { IMPROVEMENT_IDS, improvementsOf, resolveImprovedSettings, type ImprovementId } from '../../../../utils/semanticOverlap/improved/settings';
import { resolveSettings } from '../../../../utils/semanticOverlap/settings';
import { loadScenario, mean, runScenario, scenarios, type LevelScores, type LoadedScenario, type ScenarioId, type Scores } from './suite';

/**
 * Ablation of the improved approach's improvements on the benchmark suite: each improvement alone,
 * then a combination that keeps only improvements that still help together with the others.
 */

/** Minimum change of the average class-level F-measure that counts. */
export const THRESHOLD = 0.02;

export type Classification = 'helpful' | 'neutral' | 'harmful';

/**
 * Helpful: average F rises by ≥ 0.02 and no scenario drops by more than 0.02. Harmful: average F
 * drops by more than 0.02. Otherwise neutral.
 */
export function classify(deltaAverage: number, deltaPerScenario: readonly number[]): Classification {
  const EPSILON = 1e-9;
  if (deltaAverage >= THRESHOLD - EPSILON && deltaPerScenario.every(d => d >= -THRESHOLD - EPSILON)) return 'helpful';
  if (deltaAverage < -THRESHOLD - EPSILON) return 'harmful';
  return 'neutral';
}

export interface ConfigurationResult {
  /** Enabled improvements; `null` for the paper approach. */
  configuration: ImprovementId[] | null;
  perScenario: Partial<Record<ScenarioId, LevelScores>>;
  /** Class level, mean over the available scenarios. */
  average: Scores;
}

export interface Decision {
  improvement: ImprovementId;
  step: 'single' | 'leave-one-out' | 'add-one';
  delta: { average: number; perScenario: Partial<Record<ScenarioId, number>> };
  classification: Classification;
  kept: boolean;
  reason: string;
}

/** Scenarios whose metamodels are available, loaded once. */
export function availableScenarios(): LoadedScenario[] {
  return scenarios().map(s => loadScenario(s.id)).filter((s): s is LoadedScenario => s !== null);
}

/** Settings of a configuration (default values, only the given improvements on). */
export const configurationSettings = (enabled: readonly ImprovementId[], seed: number) =>
  resolveImprovedSettings({ seed, improvements: improvementsOf(enabled) });

function summarise(configuration: ImprovementId[] | null, runs: [ScenarioId, LevelScores][]): ConfigurationResult {
  return {
    configuration,
    perScenario: Object.fromEntries(runs),
    average: mean(runs.map(([, scores]) => scores.class)),
  };
}

export function evaluatePaper(loaded: readonly LoadedScenario[]): ConfigurationResult {
  return summarise(null, loaded.map(s => [s.scenario.id, runScenario(s, 'paper', seed => resolveSettings({ seed })).scores]));
}

export function evaluateConfiguration(enabled: readonly ImprovementId[], loaded: readonly LoadedScenario[]): ConfigurationResult {
  const sorted = IMPROVEMENT_IDS.filter(id => enabled.includes(id));
  return summarise(sorted, loaded.map(s => [s.scenario.id, runScenario(s, 'improved', seed => configurationSettings(sorted, seed)).scores]));
}

/** Change of the class-level F-measure from `before` to `after`, on average and per scenario. */
export function delta(before: ConfigurationResult, after: ConfigurationResult): Decision['delta'] {
  const perScenario: Partial<Record<ScenarioId, number>> = {};
  for (const [id, scores] of Object.entries(after.perScenario) as [ScenarioId, LevelScores][]) {
    perScenario[id] = scores.class.fMeasure - (before.perScenario[id]?.class.fMeasure ?? 0);
  }
  return { average: after.average.fMeasure - before.average.fMeasure, perScenario };
}

export const classifyDelta = (d: Decision['delta']) => classify(d.average, Object.values(d.perScenario) as number[]);

const keyOf = (set: readonly ImprovementId[]) => IMPROVEMENT_IDS.filter(id => set.includes(id)).join('+');
const MAX_ROUNDS = 5;

export interface CombinationResult {
  final: ImprovementId[];
  steps: Decision[];
}

/**
 * Combination procedure: start with the improvements that help alone; drop each one whose removal
 * does not cost at least the threshold (another improvement overshadows it); add each other one that
 * helps on top of the combination; repeat until nothing changes (at most 5 rounds; on a cycle the
 * smaller combination wins). `evaluate` is called with sorted improvement lists and may be memoised.
 */
export function selectCombination(
  evaluate: (enabled: ImprovementId[]) => ConfigurationResult,
  singles: readonly { improvement: ImprovementId; classification: Classification }[],
): CombinationResult {
  const cache = new Map<string, ConfigurationResult>();
  const run = (enabled: readonly ImprovementId[]) => {
    const sorted = IMPROVEMENT_IDS.filter(id => enabled.includes(id));
    const key = keyOf(sorted);
    if (!cache.has(key)) cache.set(key, evaluate(sorted));
    return cache.get(key)!;
  };
  let current: ImprovementId[] = IMPROVEMENT_IDS.filter(id => singles.some(s => s.improvement === id && s.classification === 'helpful'));
  const steps: Decision[] = [];
  const seen: ImprovementId[][] = [current];
  for (let round = 0; round < MAX_ROUNDS; round++) {
    let changed = false;
    for (const id of [...current]) {
      const without = current.filter(other => other !== id);
      const d = delta(run(without), run(current));
      const classification = classifyDelta(d);
      const kept = classification === 'helpful';
      steps.push({
        improvement: id, step: 'leave-one-out', delta: d, classification, kept,
        reason: kept ? 'removing it costs at least the threshold' : 'removing it does not cost the threshold (overshadowed or neutral)',
      });
      if (!kept) {
        current = without;
        changed = true;
      }
    }
    for (const id of IMPROVEMENT_IDS.filter(other => !current.includes(other))) {
      const withIt = [...current, id];
      const d = delta(run(current), run(withIt));
      const classification = classifyDelta(d);
      const kept = classification === 'helpful';
      steps.push({
        improvement: id, step: 'add-one', delta: d, classification, kept,
        reason: kept ? 'helps on top of the combination' : 'does not help on top of the combination',
      });
      if (kept) {
        current = IMPROVEMENT_IDS.filter(other => withIt.includes(other));
        changed = true;
      }
    }
    if (!changed) break;
    const repeat = seen.findIndex(set => keyOf(set) === keyOf(current));
    if (repeat >= 0) {
      current = seen.slice(repeat).reduce((smallest, set) => (set.length < smallest.length ? set : smallest));
      break;
    }
    seen.push(current);
  }
  return { final: current, steps };
}
