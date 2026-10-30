import { analysisSettingsOf, classMatrices } from '../../../../utils/semanticOverlap/improved/runImprovedAnalysis';
import { createDefaultMeasureRegistry } from '../../../../utils/semanticOverlap/improved/measures/registry';
import type { EmbeddingTable } from '../../../../utils/semanticOverlap/improved/embeddings/types';
import { improvementsOf, resolveImprovedSettings, type ImprovementId } from '../../../../utils/semanticOverlap/improved/settings';
import { benchmarkDeps, FAMILY_IDS, pairKeys, type FamilyId, type LoadedScenario } from './suite';

/**
 * Calibration of the acceptance threshold (null score) for one configuration of improvements, after
 * Fang (2022, §5.4.2): the midpoint between the mean combined similarity of reference class pairs
 * (correct) and of all other class pairs (incorrect). Means are taken per scenario, then per family,
 * then over families. Only class-level matrices are computed, so no search runs and the result does
 * not depend on the seed.
 */
export interface Calibration {
  configuration: ImprovementId[];
  meanCorrect: number;
  meanIncorrect: number;
  tau: number;
  perFamily: Partial<Record<FamilyId, { meanCorrect: number; meanIncorrect: number }>>;
}

const mean = (values: readonly number[]) => (values.length === 0 ? 0 : values.reduce((s, v) => s + v, 0) / values.length);
const round3 = (value: number) => Math.round(value * 1000) / 1000;

export function calibrate(
  configuration: readonly ImprovementId[],
  scenarios: readonly LoadedScenario[],
  embeddingsFor: (scenario: LoadedScenario) => EmbeddingTable | null = () => null,
): Calibration {
  const measures = createDefaultMeasureRegistry();
  const { lexical, hypernyms } = benchmarkDeps();
  const perScenario = scenarios.map(loaded => {
    const embeddings = configuration.includes('embeddings') ? embeddingsFor(loaded) : null;
    const settings = analysisSettingsOf(resolveImprovedSettings({ seed: 1, improvements: improvementsOf(configuration) }), { embeddings: embeddings !== null });
    const { matrices } = classMatrices({ source: loaded.source, target: loaded.target, settings }, settings,
      { lexical, hypernyms: hypernyms ?? null, measures, embeddings });
    const expected = new Set([...pairKeys(loaded.reference.correspondences)].map(key => key.split(' #')[0]));
    const correct: number[] = [];
    const incorrect: number[] = [];
    loaded.source.classes.forEach((s, i) => loaded.target.classes.forEach((t, j) => {
      (expected.has(`${s.qualifiedName} -> ${t.qualifiedName}`) ? correct : incorrect).push(matrices.combined[i * matrices.m + j]);
    }));
    return { family: loaded.scenario.family, meanCorrect: mean(correct), meanIncorrect: mean(incorrect) };
  });
  const perFamily: Calibration['perFamily'] = {};
  for (const family of FAMILY_IDS) {
    const members = perScenario.filter(s => s.family === family);
    if (members.length === 0) continue;
    perFamily[family] = { meanCorrect: mean(members.map(m => m.meanCorrect)), meanIncorrect: mean(members.map(m => m.meanIncorrect)) };
  }
  const families = Object.values(perFamily);
  const meanCorrect = mean(families.map(f => f.meanCorrect));
  const meanIncorrect = mean(families.map(f => f.meanIncorrect));
  return { configuration: [...configuration], meanCorrect, meanIncorrect, tau: round3((meanCorrect + meanIncorrect) / 2), perFamily };
}
