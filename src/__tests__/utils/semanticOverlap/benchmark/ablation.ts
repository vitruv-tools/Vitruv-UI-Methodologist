import type { EmbeddingTable } from '../../../../utils/semanticOverlap/improved/embeddings/types';
import {
  IMPROVEMENT_IDS, improvementsOf, resolveImprovedSettings, type ImprovementId, type ImprovementParams,
} from '../../../../utils/semanticOverlap/improved/settings';
import { calibrate, type Calibration } from './calibrate';
import { resolveSettings } from '../../../../utils/semanticOverlap/settings';
import {
  familyMeans, loadScenario, runScenario, scenarios, type FamilyId, type LevelScores, type LoadedScenario, type ScenarioId, type Scores,
} from './suite';

/**
 * Ablation of the improved approach's improvements on the benchmark suite: each improvement alone,
 * then a combination that keeps only improvements that still help together with the others.
 */

/** Minimum change of the family-averaged class-level F-measure that counts. */
export const THRESHOLD = 0.02;

export type Classification = 'helpful' | 'neutral' | 'harmful';

/**
 * Decision rule on scenario families, so a family with many scenarios does not dominate. Helpful:
 * the average F over families rises by ≥ 0.02 and no family drops by more than 0.02. Harmful: the
 * average drops by more than 0.02. Otherwise neutral.
 */
export function classify(deltaFamilyAverage: number, deltaPerFamily: readonly number[]): Classification {
  const EPSILON = 1e-9;
  if (deltaFamilyAverage >= THRESHOLD - EPSILON && deltaPerFamily.every(d => d >= -THRESHOLD - EPSILON)) return 'helpful';
  if (deltaFamilyAverage < -THRESHOLD - EPSILON) return 'harmful';
  return 'neutral';
}

export interface ConfigurationResult {
  /** Enabled improvements; `null` for the paper approach. */
  configuration: ImprovementId[] | null;
  perScenario: Partial<Record<ScenarioId, LevelScores>>;
  /** Class level, mean over the available scenarios of each family. */
  perFamily: Partial<Record<FamilyId, Scores>>;
  /** Class level, mean over the available families. */
  average: Scores;
}

export interface Decision {
  improvement: ImprovementId;
  step: 'single' | 'leave-one-out' | 'add-one';
  /** The rule uses `average` and `perFamily`; `perScenario` is for information. */
  delta: { average: number; perFamily: Partial<Record<FamilyId, number>>; perScenario: Partial<Record<ScenarioId, number>> };
  classification: Classification;
  kept: boolean;
  reason: string;
}

/** Scenarios whose metamodels are available, loaded once. */
export function availableScenarios(): LoadedScenario[] {
  return scenarios().map(s => loadScenario(s.id)).filter((s): s is LoadedScenario => s !== null);
}

/** Settings of a configuration (default values, only the given improvements on). */
export const configurationSettings = (enabled: readonly ImprovementId[], seed: number, params: Partial<ImprovementParams> = {}) =>
  resolveImprovedSettings({ seed, improvements: improvementsOf(enabled), params: params as ImprovementParams });

/**
 * Resources of an ablation run: the embedding table per scenario (null without the model) and the
 * calibrations made so far (one per configuration with `calibrated-null`).
 */
export interface EvaluationContext {
  embeddings?: (loaded: LoadedScenario) => EmbeddingTable | null;
  calibrations?: Calibration[];
  /** Extra parameters for every configuration (e.g. another embedding model). */
  params?: Partial<ImprovementParams>;
}

export function summarise(configuration: ImprovementId[] | null, runs: [ScenarioId, LevelScores][]): ConfigurationResult {
  const { perFamily, average } = familyMeans(Object.fromEntries(runs.map(([id, scores]) => [id, scores.class])));
  return { configuration, perScenario: Object.fromEntries(runs), perFamily, average };
}

export function evaluatePaper(loaded: readonly LoadedScenario[]): ConfigurationResult {
  return summarise(null, loaded.map(s => [s.scenario.id, runScenario(s, 'paper', seed => resolveSettings({ seed })).scores]));
}

/**
 * Scores of a configuration on the loaded scenarios. A configuration with `calibrated-null` is first
 * calibrated on the same scenarios (its τ* becomes `calibratedNullScore`).
 */
export function evaluateConfiguration(
  enabled: readonly ImprovementId[],
  loaded: readonly LoadedScenario[],
  context: EvaluationContext = {},
): ConfigurationResult {
  const sorted = IMPROVEMENT_IDS.filter(id => enabled.includes(id));
  const embeddings = context.embeddings ?? (() => null);
  const params: Partial<ImprovementParams> = { ...context.params };
  if (sorted.includes('calibrated-null')) {
    const calibration = calibrate(sorted, loaded, embeddings);
    context.calibrations?.push(calibration);
    params.calibratedNullScore = calibration.tau;
  }
  return summarise(sorted, loaded.map(s => [s.scenario.id,
    runScenario(s, 'improved', seed => configurationSettings(sorted, seed, params), undefined, embeddings(s)).scores]));
}

/** Change of the class-level F-measure from `before` to `after`: family average, per family, per scenario. */
export function delta(before: ConfigurationResult, after: ConfigurationResult): Decision['delta'] {
  const perScenario: Partial<Record<ScenarioId, number>> = {};
  for (const [id, scores] of Object.entries(after.perScenario) as [ScenarioId, LevelScores][]) {
    perScenario[id] = scores.class.fMeasure - (before.perScenario[id]?.class.fMeasure ?? 0);
  }
  const perFamily: Partial<Record<FamilyId, number>> = {};
  for (const [id, scores] of Object.entries(after.perFamily) as [FamilyId, Scores][]) {
    perFamily[id] = scores.fMeasure - (before.perFamily[id]?.fMeasure ?? 0);
  }
  return { average: after.average.fMeasure - before.average.fMeasure, perFamily, perScenario };
}

export const classifyDelta = (d: Decision['delta']) => classify(d.average, Object.values(d.perFamily) as number[]);

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
