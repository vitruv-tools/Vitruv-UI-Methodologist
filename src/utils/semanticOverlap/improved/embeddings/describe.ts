import { tokenize } from '../../lexical/tokenize';
import type { ClassNode, FeatureNode, MetamodelGraph } from '../../types';
import { featuresWithInherited } from '../hierarchy/features';
import { fineDataTypeCategory } from '../measures/datatypeMeasure';
import type { ElementDescription } from './types';

/**
 * Short English descriptions of metamodel elements for the sentence-embedding measure: name words,
 * kind and a little context. Pure; the same element always gives the same text.
 */

/** Lists in a class description are cut after this many entries (sorted by name). */
const MAX_LIST = 8;

/** Name words, lower case; falls back to the lower-cased name when no word survives tokenising. */
export const words = (name: string) => tokenize(name).join(' ') || name.toLowerCase();

const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name);

const classByName = (graph: MetamodelGraph, name: string) => graph.classes.find(c => c.name === name);

/** Type words of an attribute: "integer", "decimal", "text", … or the words of its type's name. */
function typeWords(feature: FeatureNode): string {
  const category = fineDataTypeCategory(feature);
  return category === 'enum' || category === 'other' ? words(feature.typeName) : category;
}

/** The class that contains `node` through a containment reference, if any (first by name). */
function containerOf(graph: MetamodelGraph, node: ClassNode): ClassNode | undefined {
  return [...graph.classes].sort(byName)
    .find(c => c.references.some(r => r.containment && r.typeName === node.name));
}

const list = (items: string[]) => items.slice(0, MAX_LIST).join(', ');

export function describeClass(node: ClassNode, graph: MetamodelGraph): string {
  const parts = [`class ${words(node.name)}`, node.isAbstract || node.isInterface ? 'abstract' : 'concrete'];
  const container = containerOf(graph, node);
  if (container) parts.push(`part of ${words(container.name)}`);
  const supertypes = node.superTypes.map(qn => graph.classes.find(c => c.qualifiedName === qn)).filter((c): c is ClassNode => !!c);
  if (supertypes.length > 0) parts.push(`kind of ${list(supertypes.sort(byName).map(c => words(c.name)))}`);
  if (node.attributes.length > 0) {
    parts.push(`attributes: ${list([...node.attributes].sort(byName).map(a => `${words(a.name)} (${typeWords(a)})`))}`);
  }
  if (node.references.length > 0) {
    parts.push(`references: ${list([...node.references].sort(byName).map(r => `${words(r.name)} (${words(r.typeName)})`))}`);
  }
  return `${parts.join('. ')}.`;
}

const ownerName = (feature: FeatureNode) => words(feature.owner.split('.').pop() ?? feature.owner);

export function describeFeature(feature: FeatureNode): string {
  if (feature.kind === 'attribute') return `attribute ${words(feature.name)} of ${ownerName(feature)}, ${typeWords(feature)}`;
  const parts = [`reference ${words(feature.name)} of ${ownerName(feature)}`, `${feature.upper === 1 ? 'one' : 'many'} ${words(feature.typeName)}`];
  if (feature.containment) parts.push('containment');
  return parts.join(', ');
}

/** A navigation `first.second` from the owner of `first`, e.g. "path incoming source of node, edge then node". */
export function describePath(first: FeatureNode, second: FeatureNode): string {
  const secondType = second.kind === 'attribute' ? typeWords(second) : words(second.typeName);
  return `path ${words(first.name)} ${words(second.name)} of ${ownerName(first)}, ${words(first.typeName)} then ${secondType}`;
}

/**
 * Every length-2 navigation `<reference>.<feature>`: each reference at its declaring class, each
 * second feature own or inherited, round trips over the opposite left out (as path correspondences
 * use them).
 */
export function pathsOf(graph: MetamodelGraph): [FeatureNode, FeatureNode][] {
  return graph.classes.flatMap(node => node.references.flatMap(reference => {
    const type = classByName(graph, reference.typeName);
    if (!type) return [];
    return featuresWithInherited(graph, type.qualifiedName)
      .filter(second => second.qualifiedName !== reference.opposite)
      .map((second): [FeatureNode, FeatureNode] => [reference, second]);
  }));
}

/**
 * Descriptions of all classes and features (and, with `paths`, all length-2 navigations) of both
 * metamodels, one per distinct text, in a stable order: classes before features, source before
 * target, each in file order. Inherited features are described once, at their declaring class.
 */
export function describeAll(source: MetamodelGraph, target: MetamodelGraph, options: { paths?: boolean } = {}): ElementDescription[] {
  const all: ElementDescription[] = [];
  const graphs = [source, target];
  for (const graph of graphs) {
    for (const node of graph.classes) all.push({ qualifiedName: node.qualifiedName, level: 'class', text: describeClass(node, graph) });
  }
  for (const graph of graphs) {
    for (const feature of graph.classes.flatMap(c => [...c.attributes, ...c.references])) {
      all.push({ qualifiedName: feature.qualifiedName, level: 'feature', text: describeFeature(feature) });
    }
    if (options.paths) {
      for (const [first, second] of pathsOf(graph)) {
        all.push({ qualifiedName: `${first.qualifiedName}.${second.name}`, level: 'feature', text: describePath(first, second) });
      }
    }
  }
  const seen = new Set<string>();
  return all.filter(d => !seen.has(d.text) && seen.add(d.text));
}
