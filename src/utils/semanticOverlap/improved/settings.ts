/*
 * Independent copy of the paper approach's `settings.ts`; evolves separately — do not
 * import from the paper pipeline for logic.
 */
import type { AnalysisSettings, Effort, GaSettings, SaSettings } from '../types';

const BALANCED_GA: GaSettings = {
  populationSize: 60,
  generations: 150,
  crossoverRate: 0.9,
  mutationRate: 0.2,
  mutatedFraction: 0.05,
  stallGenerations: 25,
};

const BALANCED_SA: SaSettings = {
  startTemperature: 0.05,
  endTemperature: 1e-4,
  coolingFactor: 0.95,
  iterationsPerElement: 1,
};

const EFFORT_FACTORS: Record<Effort, number> = { fast: 0.4, balanced: 1, thorough: 2.5 };

/** GA/SA parameters per effort level: `fast` = 0.4×, `thorough` = 2.5× the balanced effort. */
export const EFFORT_PRESETS: Record<Effort, { ga: GaSettings; sa: SaSettings }> = Object.fromEntries(
  (Object.keys(EFFORT_FACTORS) as Effort[]).map(effort => {
    const factor = EFFORT_FACTORS[effort];
    return [effort, {
      ga: {
        ...BALANCED_GA,
        populationSize: Math.round(BALANCED_GA.populationSize * factor),
        generations: Math.round(BALANCED_GA.generations * factor),
      },
      sa: { ...BALANCED_SA, iterationsPerElement: BALANCED_SA.iterationsPerElement * factor },
    }];
  }),
) as Record<Effort, { ga: GaSettings; sa: SaSettings }>;

/** Defaults follow the paper where it gives values (equal weights, α = β = 0.5). */
export const DEFAULT_SETTINGS: AnalysisSettings = {
  seed: 1,
  effort: 'balanced',
  weights: { structural: 0.5, syntactic: 0.5 },
  syntactic: { alpha: 0.5, beta: 0.5 },
  synonymWeight: 1,
  nullScore: 0.25,
  maxTargetsPerElement: 2,
  ga: EFFORT_PRESETS.balanced.ga,
  sa: EFFORT_PRESETS.balanced.sa,
  // Additional measures (extensions of the paper's measures, tuned on the benchmark).
  measures: [{ id: 'name-tokens', weight: 0.75 }, { id: 'neighbourhood', weight: 0.4 }],
  strategy: 'hybrid-ga-sa',
};

/** Defaults overridden by `partial`; GA/SA parameters come from the effort preset unless given. */
export function resolveSettings(partial: Partial<AnalysisSettings> = {}, effort?: Effort): AnalysisSettings {
  const chosenEffort = effort ?? partial.effort ?? DEFAULT_SETTINGS.effort;
  const preset = EFFORT_PRESETS[chosenEffort];
  return {
    ...DEFAULT_SETTINGS,
    ...partial,
    effort: chosenEffort,
    ga: { ...preset.ga, ...(effort ? {} : partial.ga) },
    sa: { ...preset.sa, ...(effort ? {} : partial.sa) },
  };
}

const TOLERANCE = 1e-9;

const isUnit = (value: number) => Number.isFinite(value) && value >= 0 && value <= 1;

/** Returns human-readable problems; an empty list means the settings are valid. */
export function validateSettings(settings: AnalysisSettings): string[] {
  const problems: string[] = [];
  const { weights, syntactic, ga, sa } = settings;
  if (!isUnit(weights.structural) || !isUnit(weights.syntactic)
      || Math.abs(weights.structural + weights.syntactic - 1) > TOLERANCE) {
    problems.push('Structural and syntactic weight must be between 0 and 1 and add up to 1.');
  }
  if (!isUnit(syntactic.alpha) || !isUnit(syntactic.beta)
      || Math.abs(syntactic.alpha + syntactic.beta - 1) > TOLERANCE) {
    problems.push('Vocabulary (α) and edit-distance (β) weight must be between 0 and 1 and add up to 1.');
  }
  if (!Number.isInteger(settings.seed) || settings.seed < 0 || settings.seed > 0xffffffff) {
    problems.push('Seed must be a whole number between 0 and 4294967295.');
  }
  if (!Number.isInteger(settings.maxTargetsPerElement)
      || settings.maxTargetsPerElement < 1 || settings.maxTargetsPerElement > 5) {
    problems.push('Maximum targets per element must be a whole number from 1 to 5.');
  }
  if (!isUnit(settings.nullScore)) problems.push('Null score must be between 0 and 1.');
  if (!(settings.synonymWeight >= 0)) problems.push('Synonym weight must not be negative.');
  if (!(sa.coolingFactor > 0 && sa.coolingFactor < 1)) problems.push('Cooling factor must be between 0 and 1 (exclusive).');
  if (!(sa.startTemperature > sa.endTemperature && sa.endTemperature > 0)) {
    problems.push('Start temperature must be greater than the end temperature, which must be positive.');
  }
  if (!(sa.iterationsPerElement > 0)) problems.push('Iterations per element must be positive.');
  if (!Number.isInteger(ga.populationSize) || ga.populationSize < 2) problems.push('Population size must be a whole number of at least 2.');
  if (!Number.isInteger(ga.generations) || ga.generations < 1) problems.push('Generations must be a whole number of at least 1.');
  if (!isUnit(ga.crossoverRate) || !isUnit(ga.mutationRate) || !isUnit(ga.mutatedFraction)) {
    problems.push('Crossover rate, mutation rate and mutated share must be between 0 and 1.');
  }
  if (!Number.isInteger(ga.stallGenerations) || ga.stallGenerations < 1) problems.push('Stall generations must be a whole number of at least 1.');
  if (settings.measures.some(m => !(m.weight >= 0))) problems.push('Measure weights must not be negative.');
  return problems;
}

/** The nine switchable improvements of the improved approach. */
export const IMPROVEMENT_IDS = [
  'adaptive-weights', 'hypernyms', 'compounds', 'idf', 'roles', 'datatypes', 'type-object', 'flooding', 'hierarchy-both',
] as const;
export type ImprovementId = typeof IMPROVEMENT_IDS[number];

export const IMPROVEMENT_LABELS: Record<ImprovementId, string> = {
  'adaptive-weights': 'Adaptive measure weighting',
  hypernyms: 'WordNet hypernyms',
  compounds: 'Compound words & abbreviations',
  idf: 'Token weighting (IDF)',
  roles: 'Class roles',
  datatypes: 'Attribute data types',
  'type-object': 'Type-object pattern',
  flooding: 'Similarity flooding',
  'hierarchy-both': 'Hierarchy collapsing (both sides)',
};

export interface ImprovementParams {
  /** λ in `(1 − λ)·combined + λ·flood`. */
  floodingWeight: number;
  floodingMaxIterations: number;
  hypernymWeight: number;
  /** Senses per word considered by Wu-Palmer similarity. */
  hypernymSenses: number;
  roleWeight: number;
  datatypeWeight: number;
  /** Minimum concrete subclasses of a base class to count as type-object counterpart. */
  typeObjectMinSubclasses: number;
}

export interface ImprovedSettings extends AnalysisSettings {
  improvements: Record<ImprovementId, boolean>;
  params: ImprovementParams;
}

/**
 * Improvements switched on by default: the combination selected by the ablation over the benchmark
 * suite. Only the type-object pattern changed the average F-measure by at least 0.02 there; the
 * others stay available as switches.
 */
export const DEFAULT_COMBINATION: readonly ImprovementId[] = ['type-object'];

export const DEFAULT_PARAMS: ImprovementParams = {
  floodingWeight: 0.5,
  floodingMaxIterations: 30,
  hypernymWeight: 0.5,
  hypernymSenses: 3,
  roleWeight: 0.5,
  datatypeWeight: 0.5,
  typeObjectMinSubclasses: 2,
};

export const improvementsOf = (enabled: readonly ImprovementId[]): Record<ImprovementId, boolean> =>
  Object.fromEntries(IMPROVEMENT_IDS.map(id => [id, enabled.includes(id)])) as Record<ImprovementId, boolean>;

export const DEFAULT_IMPROVED_SETTINGS: ImprovedSettings = {
  ...DEFAULT_SETTINGS,
  improvements: improvementsOf(DEFAULT_COMBINATION),
  params: DEFAULT_PARAMS,
};

/** Like {@link resolveSettings}, plus improvements and their parameters. */
export function resolveImprovedSettings(partial: Partial<ImprovedSettings> = {}, effort?: Effort): ImprovedSettings {
  return {
    ...resolveSettings(partial, effort),
    improvements: { ...DEFAULT_IMPROVED_SETTINGS.improvements, ...partial.improvements },
    params: { ...DEFAULT_PARAMS, ...partial.params },
  };
}

const inRange = (value: number, min: number, max: number) => Number.isFinite(value) && value >= min && value <= max;
const isIntInRange = (value: number, min: number, max: number) => Number.isInteger(value) && value >= min && value <= max;

/** Problems of the base settings plus those of the improvements and their parameters. */
export function validateImprovedSettings(settings: ImprovedSettings): string[] {
  const problems = validateSettings(settings);
  const { improvements, params } = settings;
  if (!improvements || IMPROVEMENT_IDS.some(id => typeof improvements[id] !== 'boolean')) {
    problems.push('Every improvement must be switched on or off.');
  }
  if (!params) return [...problems, 'Improvement parameters are missing.'];
  if (!inRange(params.floodingWeight, 0, 1)) problems.push('Flooding weight must be between 0 and 1.');
  if (!isIntInRange(params.floodingMaxIterations, 1, 100)) problems.push('Flooding iterations must be a whole number from 1 to 100.');
  if (!(params.hypernymWeight >= 0)) problems.push('Hypernym weight must not be negative.');
  if (!isIntInRange(params.hypernymSenses, 1, 10)) problems.push('Hypernym senses must be a whole number from 1 to 10.');
  if (!(params.roleWeight >= 0)) problems.push('Role weight must not be negative.');
  if (!(params.datatypeWeight >= 0)) problems.push('Data-type weight must not be negative.');
  if (!isIntInRange(params.typeObjectMinSubclasses, 2, Number.MAX_SAFE_INTEGER)) {
    problems.push('Minimum subclasses for the type-object pattern must be a whole number of at least 2.');
  }
  return problems;
}

/** True if the improvement is switched on (false for settings without improvements). */
export const isOn = (settings: AnalysisSettings, id: ImprovementId): boolean =>
  (settings as Partial<ImprovedSettings>).improvements?.[id] === true;
