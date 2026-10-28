import { createDefaultMeasureRegistry } from '../../../utils/semanticOverlap/measures/registry';
import { computeMatrices } from '../../../utils/semanticOverlap/measures/similarityMatrices';
import type { ElementProfile } from '../../../utils/semanticOverlap/measures/types';
import { createMatchingProblem } from '../../../utils/semanticOverlap/search/matchingProblem';
import { resolveSettings } from '../../../utils/semanticOverlap/settings';
import type { AnalysisSettings } from '../../../utils/semanticOverlap/types';

/** Profile with a name, single-token vocabulary and metrics, for measure and search tests. */
export function profile(name: string, side: 'source' | 'target', metrics: number[] = [0, 0, 0, 0, 0], extraTerms: string[] = []): ElementProfile {
  const vocabulary = new Map<string, number>();
  for (const term of [name.toLowerCase(), ...extraTerms]) vocabulary.set(term, (vocabulary.get(term) ?? 0) + 1);
  const norm = Math.sqrt([...vocabulary.values()].reduce((s, w) => s + w * w, 0));
  return {
    ref: { side, kind: 'class', qualifiedName: `p.${name}`, name },
    nameLower: name.toLowerCase(),
    tokens: [name.toLowerCase()],
    tokenSynonyms: [new Set<string>()],
    neighbours: [],
    vocabulary,
    norm,
    metrics,
  };
}

/** n×n problem where source i is most similar to target i ("diagonal"). */
export function diagonalProblem(n: number, overrides: Partial<AnalysisSettings> = {}) {
  const names = Array.from({ length: n }, (_, i) => `Element${String.fromCharCode(65 + i)}`);
  const sources = names.map((name, i) => profile(name, 'source', [i + 1, i, 0, 0, 0]));
  const targets = names.map((name, i) => profile(name, 'target', [i + 1, i, 0, 0, 0]));
  const settings = resolveSettings({ seed: 11, ...overrides }, 'fast');
  const registry = createDefaultMeasureRegistry();
  const matrices = computeMatrices('class', sources, targets, registry, settings);
  return createMatchingProblem('class', sources, targets, matrices, registry, settings);
}
