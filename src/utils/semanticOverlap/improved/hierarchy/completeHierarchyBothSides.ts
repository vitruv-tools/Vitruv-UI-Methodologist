import type { MetamodelGraph } from '../../types';
import type { MatchingProblem, Solution } from '../matchingProblem';
import { completeHierarchy } from '../runImprovedAnalysis';

/** Elements fixed by a rule (type-object pattern); hierarchy completion leaves them alone. */
export interface FixedElements {
  sources: ReadonlySet<number>;
  targets: ReadonlySet<number>;
}

const NONE: FixedElements = { sources: new Set(), targets: new Set() };

/** Pairs of classes related by (transitive) inheritance, as indices of the problem's elements. */
function relatedByInheritance(graph: MetamodelGraph, profiles: MatchingProblem['sources']): Map<number, Set<number>> {
  const index = new Map(profiles.map((p, k) => [p.ref.qualifiedName, k]));
  const byName = new Map(graph.classes.map(c => [c.qualifiedName, c]));
  const related = new Map<number, Set<number>>();
  const link = (a: number, b: number) => {
    if (!related.has(a)) related.set(a, new Set());
    related.get(a)!.add(b);
  };
  for (const node of graph.classes) {
    const child = index.get(node.qualifiedName);
    if (child === undefined) continue;
    const seen = new Set<string>();
    const stack = [...node.superTypes];
    while (stack.length > 0) {
      const name = stack.pop()!;
      if (seen.has(name)) continue;
      seen.add(name);
      stack.push(...(byName.get(name)?.superTypes ?? []));
      const ancestor = index.get(name);
      if (ancestor === undefined) continue;
      link(child, ancestor);
      link(ancestor, child);
    }
  }
  return related;
}

/**
 * Hierarchy completion on both sides. The target side works as in the paper approach (an
 * unmatched target joins when its best source is matched to the target's direct super- or
 * subtype). Mirrored on the source side: an unmatched source class joins its best target when that
 * target is already matched to one of the class's (transitive) super- or subclasses, so a deep
 * hierarchy (`BrakeComponent` and its subclasses) can map to one flat class. The combined
 * similarity must reach the null score; at most `maxTargetsPerElement` sources share a target.
 */
export function completeHierarchyBothSides(
  problem: MatchingProblem,
  solution: Solution,
  source: MetamodelGraph,
  target: MetamodelGraph,
  fixed: FixedElements = NONE,
): Solution {
  const targetSide = completeHierarchy(problem, solution, target);
  const { n, m, matrices, settings } = problem;
  const assignments = targetSide.assignments.map(targets => [...targets]);
  const related = relatedByInheritance(source, problem.sources);
  const sourcesOf = (j: number) => assignments.flatMap((targets, i) => (targets.includes(j) ? [i] : []));
  for (let i = 0; i < n; i++) {
    if (assignments[i].length > 0 || fixed.sources.has(i)) continue;
    let best = -1;
    for (let j = 0; j < m; j++) {
      if (fixed.targets.has(j)) continue;
      if (best < 0 || matrices.combined[i * m + j] > matrices.combined[i * m + best]) best = j;
    }
    if (best < 0 || matrices.combined[i * m + best] < settings.nullScore) continue;
    const sharing = sourcesOf(best);
    if (sharing.length >= settings.maxTargetsPerElement || !sharing.some(k => related.get(i)?.has(k))) continue;
    assignments[i] = [best];
  }
  return { assignments, fitness: problem.fitness(assignments) };
}
