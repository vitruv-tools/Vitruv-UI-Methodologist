import type { Correspondence, ElementRef, MetamodelGraph } from '../../types';

/**
 * Class split and merge (Fang 2022): a group correspondence whose many side holds classes that are
 * not in one hierarchy is a `split` (1 source → n targets) or a `merge` (n sources → 1 target).
 * Groups of related classes (e.g. `EAttribute, EReference → Property`) stay same-concept.
 */

/** Transitive supertypes (including the class itself) of every class of a graph. */
function supertypes(graph: MetamodelGraph): (qn: string) => Set<string> {
  const byName = new Map(graph.classes.map(c => [c.qualifiedName, c]));
  const cache = new Map<string, Set<string>>();
  const closure = (qn: string): Set<string> => {
    const cached = cache.get(qn);
    if (cached) return cached;
    const result = new Set<string>([qn]);
    cache.set(qn, result);
    for (const parent of byName.get(qn)?.superTypes ?? []) closure(parent).forEach(p => result.add(p));
    return result;
  };
  return closure;
}

/** Two classes are related when one is a transitive supertype of the other or they share a supertype. */
export function related(graph: MetamodelGraph, a: string, b: string): boolean {
  const closure = supertypes(graph);
  const [above, below] = [closure(a), closure(b)];
  return [...above].some(qn => below.has(qn));
}

const allRelated = (graph: MetamodelGraph, refs: readonly ElementRef[]) =>
  refs.every((a, i) => refs.slice(i + 1).every(b => related(graph, a.qualifiedName, b.qualifiedName)));

/**
 * Labels the search's same-concept group correspondences as `split` or `merge` when their many side
 * holds unrelated classes. An n:m group with unrelated classes on both sides stays `same` with a
 * warning, since neither kind fits it. Fixed (rule) correspondences are left alone.
 */
export function labelGroups(
  correspondences: readonly Correspondence[],
  source: MetamodelGraph,
  target: MetamodelGraph,
  warnings: string[],
): Correspondence[] {
  return correspondences.map(c => {
    if (c.fixed || (c.kind ?? 'same') !== 'same' || c.level !== 'class') return c;
    const sourcesRelated = allRelated(source, c.sources);
    const targetsRelated = allRelated(target, c.targets);
    if (c.sources.length === 1 && !targetsRelated) return { ...c, kind: 'split' as const };
    if (c.targets.length === 1 && !sourcesRelated) return { ...c, kind: 'merge' as const };
    if (c.sources.length > 1 && c.targets.length > 1 && !sourcesRelated && !targetsRelated) {
      warnings.push(`The group ${c.sources.map(r => r.name).join(', ')} ↔ ${c.targets.map(r => r.name).join(', ')} has unrelated classes on both sides; it is shown as one same-concept correspondence.`);
    }
    return c;
  });
}

/** Targets one class may have at most: raised to `splitMaxParts` while split/merge is on (class level). */
export const effectiveMaxTargets = (maxTargetsPerElement: number, splitMaxParts: number | null) =>
  (splitMaxParts === null ? maxTargetsPerElement : Math.max(maxTargetsPerElement, splitMaxParts));
