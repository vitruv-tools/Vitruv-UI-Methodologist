import type { ClassNode, FeatureNode, MetamodelGraph } from '../../types';

/** Own and inherited attributes and references of a class (supertypes within the same file). */
export function featuresWithInherited(graph: MetamodelGraph, qualifiedName: string): FeatureNode[] {
  const byName = new Map(graph.classes.map(c => [c.qualifiedName, c]));
  const seen = new Set<string>();
  const result: FeatureNode[] = [];
  const visit = (node: ClassNode | undefined) => {
    if (!node || seen.has(node.qualifiedName)) return;
    seen.add(node.qualifiedName);
    result.push(...node.attributes, ...node.references);
    node.superTypes.forEach(parent => visit(byName.get(parent)));
  };
  visit(byName.get(qualifiedName));
  return result;
}
