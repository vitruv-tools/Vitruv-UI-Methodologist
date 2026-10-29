import { runOverlapAnalysis } from '../runOverlapAnalysis';
import { randomSeed } from '../search/rng';
import { DEFAULT_SETTINGS, validateSettings } from '../settings';
import type { AnalysisSettings } from '../types';
import type { Approach } from './types';

/** Kessentini et al. (2014) with the documented extensions; frozen, delegates unchanged. */
export const paperApproach: Approach<AnalysisSettings> = {
  id: 'paper',
  version: '2014.1',
  label: 'Kessentini et al. 2014 (paper)',
  defaultSettings: () => ({ ...DEFAULT_SETTINGS, seed: randomSeed() }),
  validate: validateSettings,
  requiredResources: () => ['synonyms'],
  run: (input, deps) => ({
    ...runOverlapAnalysis(input, deps),
    approach: { id: paperApproach.id, version: paperApproach.version },
  }),
};
