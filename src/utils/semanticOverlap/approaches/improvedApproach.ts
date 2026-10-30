import { IMPROVED_VERSION, runImprovedAnalysis } from '../improved/runImprovedAnalysis';
import { describeAll } from '../improved/embeddings/describe';
import { DEFAULT_IMPROVED_SETTINGS, isOn, validateImprovedSettings, type ImprovedSettings } from '../improved/settings';
import { randomSeed } from '../search/rng';
import type { Approach, ResourceId } from './types';

/** Copy of the paper approach that is improved over time (switchable improvements). */
export const improvedApproach: Approach<ImprovedSettings> = {
  id: 'improved',
  version: IMPROVED_VERSION,
  label: 'Improved',
  defaultSettings: () => ({ ...DEFAULT_IMPROVED_SETTINGS, seed: randomSeed() }),
  validate: validateImprovedSettings,
  requiredResources: settings => {
    const resources: ResourceId[] = ['synonyms'];
    if (settings.improvements.hypernyms || settings.improvements.compounds) resources.push('hypernyms');
    if (settings.improvements.embeddings) resources.push('embeddings');
    return resources;
  },
  describe: ({ source, target, settings }) => describeAll(source, target, { paths: isOn(settings, 'paths') }),
  run: (input, deps) => ({
    ...runImprovedAnalysis(input, deps),
    approach: { id: improvedApproach.id, version: improvedApproach.version },
  }),
};
