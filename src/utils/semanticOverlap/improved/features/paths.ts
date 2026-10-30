import type { ElementRef, FeatureNode, MetamodelGraph, Side } from '../../types';
import { featuresWithInherited } from '../hierarchy/features';
import type { MatchingProblem } from '../matchingProblem';

/**
 * Path correspondences (Fang 2022): a feature on one side corresponds to a navigation over two
 * features on the other side (`Tree.parent ↔ Node.incoming.source`). Proposed after the feature
 * search, only for features it left unmatched, greedily and without randomness.
 */

export interface PathCandidate {
  first: FeatureNode;
  second: FeatureNode;
  /** The path as a synthetic feature of the start class, for profiling and scoring. */
  feature: FeatureNode;
  ref: ElementRef;
}

const isMany = (feature: FeatureNode) => feature.upper !== 1;

/**
 * Every navigation `r.g` of exactly two features from the given classes: r is a reference of the
 * class (own or inherited), g a feature of r's type (own or inherited). Its type is g's; it is
 * many-valued when r or g is. Round trips (g is the opposite of r, e.g. `incoming.target` back to
 * the start node) lead back to the start object and are left out.
 */
export function pathCandidates(graph: MetamodelGraph, classes: readonly ElementRef[], side: Side): PathCandidate[] {
  return classes.flatMap(start => featuresWithInherited(graph, start.qualifiedName)
    .filter(first => first.kind === 'reference')
    .flatMap(first => {
      const type = graph.classes.find(c => c.name === first.typeName);
      if (!type) return [];
      return featuresWithInherited(graph, type.qualifiedName).filter(second => second.qualifiedName !== first.opposite).map((second): PathCandidate => {
        const qualifiedName = `${start.qualifiedName}.${first.name}.${second.name}`;
        const feature: FeatureNode = {
          ...second,
          name: `${first.name} ${second.name}`,
          qualifiedName,
          owner: start.qualifiedName,
          lower: Math.min(first.lower, second.lower),
          upper: isMany(first) || isMany(second) ? -1 : 1,
          opposite: null,
        };
        return {
          first, second, feature,
          ref: { side, kind: second.kind, qualifiedName, name: `${first.name}.${second.name}`, containingClass: start.qualifiedName, path: [first.name, second.name] },
        };
      });
    }));
}

export interface PathPick {
  /** Index into the problem's sources. */
  source: number;
  /** Index into the problem's targets. */
  target: number;
}

/**
 * Greedy pick on a problem of unmatched features × path candidates (or the reverse): the best
 * pairs first, each element at most once, only pairs scoring at least τ; ties are broken by the
 * qualified names, so the result is deterministic.
 */
export function pickPaths(problem: MatchingProblem, tau: number): PathPick[] {
  const { n, m, matrices } = problem;
  const pairs: (PathPick & { score: number })[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      const score = matrices.combined[i * m + j];
      if (score >= tau) pairs.push({ source: i, target: j, score });
    }
  }
  const name = (pick: PathPick) => `${problem.sources[pick.source].ref.qualifiedName}|${problem.targets[pick.target].ref.qualifiedName}`;
  pairs.sort((a, b) => b.score - a.score || name(a).localeCompare(name(b)));
  const usedSources = new Set<number>();
  const usedTargets = new Set<number>();
  const picks: PathPick[] = [];
  for (const pair of pairs) {
    if (usedSources.has(pair.source) || usedTargets.has(pair.target)) continue;
    usedSources.add(pair.source);
    usedTargets.add(pair.target);
    picks.push({ source: pair.source, target: pair.target });
  }
  return picks;
}
