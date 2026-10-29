import type { ClassNode, FeatureNode, MetamodelGraph } from '../../types';
import type { ElementProfile, SimilarityMeasure } from './types';
import { ROLES } from './types';

const IDENTIFIER_NAMES = new Set(['id', 'identifier', 'key', 'uuid']);
/** Indices of the boolean components; the others are counts. */
const BOOLEAN_COMPONENTS = new Set([0, 1, 2, 4]);

/** Own and inherited attributes and references of a class (supertypes within the same file). */
function allFeatures(byName: Map<string, ClassNode>, node: ClassNode): FeatureNode[] {
  const seen = new Set<string>();
  const result: FeatureNode[] = [];
  const visit = (current: ClassNode | undefined) => {
    if (!current || seen.has(current.qualifiedName)) return;
    seen.add(current.qualifiedName);
    result.push(...current.attributes, ...current.references);
    current.superTypes.forEach(parent => visit(byName.get(parent)));
  };
  visit(node);
  return result;
}

/**
 * Role of every class in its metamodel, as a vector:
 * 0 abstract, 1 root container (no containment points to it, it contains something),
 * 2 contained part (a containment points to it or a supertype), 3 transitive subclasses (≤ 5),
 * 4 has an identifier attribute, 5 own + inherited attributes (≤ 10),
 * 6 own + inherited references (≤ 10), 7 owned containment references (≤ 5).
 */
export function roleVectors(graph: MetamodelGraph): Map<string, number[]> {
  const byName = new Map(graph.classes.map(c => [c.qualifiedName, c]));
  const bySimpleName = new Map<string, string>();
  for (const node of graph.classes) if (!bySimpleName.has(node.name)) bySimpleName.set(node.name, node.qualifiedName);
  const containmentTargets = new Set(graph.classes
    .flatMap(c => c.references.filter(r => r.containment).map(r => bySimpleName.get(r.typeName)))
    .filter((name): name is string => name !== undefined));
  const children = new Map<string, string[]>();
  for (const node of graph.classes) {
    for (const parent of node.superTypes) children.set(parent, [...(children.get(parent) ?? []), node.qualifiedName]);
  }
  const ancestors = (node: ClassNode): string[] => {
    const seen = new Set<string>();
    const stack = [...node.superTypes];
    while (stack.length > 0) {
      const next = stack.pop()!;
      if (seen.has(next)) continue;
      seen.add(next);
      stack.push(...(byName.get(next)?.superTypes ?? []));
    }
    return [...seen];
  };
  const descendants = (qualifiedName: string): number => {
    const seen = new Set<string>();
    const stack = [...(children.get(qualifiedName) ?? [])];
    while (stack.length > 0) {
      const next = stack.pop()!;
      if (seen.has(next)) continue;
      seen.add(next);
      stack.push(...(children.get(next) ?? []));
    }
    return seen.size;
  };
  return new Map(graph.classes.map(node => {
    const features = allFeatures(byName, node);
    const attributes = features.filter(f => f.kind === 'attribute');
    const references = features.filter(f => f.kind === 'reference');
    const containsSomething = references.some(r => r.containment);
    const contained = [node.qualifiedName, ...ancestors(node)].some(name => containmentTargets.has(name));
    const identifier = attributes.some(a => a.isId || IDENTIFIER_NAMES.has(a.name.toLowerCase()));
    return [node.qualifiedName, [
      node.isAbstract ? 1 : 0,
      !containmentTargets.has(node.qualifiedName) && containsSomething ? 1 : 0,
      contained ? 1 : 0,
      Math.min(5, descendants(node.qualifiedName)),
      identifier ? 1 : 0,
      Math.min(10, attributes.length),
      Math.min(10, references.length),
      Math.min(5, node.references.filter(r => r.containment).length),
    ]];
  }));
}

/** Mean over the components: booleans 1 if equal, counts `1 − |a − b| / max(a, b)` (1 if both 0). */
export function roleSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let sum = 0;
  for (let k = 0; k < a.length; k++) {
    if (BOOLEAN_COMPONENTS.has(k)) sum += a[k] === b[k] ? 1 : 0;
    else sum += Math.max(a[k], b[k]) === 0 ? 1 : 1 - Math.abs(a[k] - b[k]) / Math.max(a[k], b[k]);
  }
  return sum / a.length;
}

/**
 * Compares what two classes are for in their metamodels (root container, contained part,
 * abstract base, identified element, …) instead of how many members they declare.
 */
export const classRoleMeasure: SimilarityMeasure = {
  id: ROLES,
  version: '1',
  level: 'class',
  score: (source: ElementProfile, target: ElementProfile) =>
    roleSimilarity(source.roleVector ?? [], target.roleVector ?? []),
};

