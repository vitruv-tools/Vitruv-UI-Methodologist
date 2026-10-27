import type { AnalysisSettings, Effort, GaSettings, SaSettings } from './types';

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
  nullScore: 0.35,
  maxTargetsPerElement: 2,
  ga: EFFORT_PRESETS.balanced.ga,
  sa: EFFORT_PRESETS.balanced.sa,
  measures: [],
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
