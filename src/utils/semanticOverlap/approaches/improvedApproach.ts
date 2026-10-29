import { runImprovedAnalysis } from '../improved/runImprovedAnalysis';
import { DEFAULT_IMPROVED_SETTINGS, validateImprovedSettings, type ImprovedSettings } from '../improved/settings';
import { randomSeed } from '../search/rng';
import type { Approach, ResourceId } from './types';

/** Copy of the paper approach that is improved over time (switchable improvements). */
export const improvedApproach: Approach<ImprovedSettings> = {
  id: 'improved',
  version: '0.2',
  label: 'Improved',
  defaultSettings: () => ({ ...DEFAULT_IMPROVED_SETTINGS, seed: randomSeed() }),
  validate: validateImprovedSettings,
  requiredResources: settings => {
    const resources: ResourceId[] = ['synonyms'];
    if (settings.improvements.hypernyms || settings.improvements.compounds) resources.push('hypernyms');
    return resources;
  },
  run: (input, deps) => ({
    ...runImprovedAnalysis(input, deps),
    approach: { id: improvedApproach.id, version: improvedApproach.version },
  }),
};
