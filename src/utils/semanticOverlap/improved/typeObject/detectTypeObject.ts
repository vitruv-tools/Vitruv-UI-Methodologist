import type {
  ClassNode, CorrespondenceKind, ElementRef, FeatureNode, FineDataTypeCategory, InstanceRole, MetamodelGraph, Side, TypeObjectPattern,
} from '../../types';
import { categoryCandidates, fineDataTypeCategory, fineDataTypeCategoryOfClassName } from '../measures/datatypeMeasure';

/**
 * Rule-based detection of the type-object pattern (an *item* refers to its *type*; the type owns
 * *definitions*, the item owns *values* that refer to definitions) and of its counterpart in the
 * other metamodel (a base class with concrete subclasses holding attributes). The relation between
 * both is partly class ↔ instance: each subclass corresponds to an instance of the type class, each
 * of its attributes to an instance of the definition (and value) class for its data type.
 */

const IDENTIFIER_NAMES = new Set(['id', 'identifier', 'key', 'uuid']);
const isMany = (feature: FeatureNode) => feature.upper < 0 || feature.upper > 1;
const isMandatorySingle = (feature: FeatureNode) => feature.lower >= 1 && feature.upper === 1;
export const isIdentifier = (feature: FeatureNode) => Boolean(feature.isId) || IDENTIFIER_NAMES.has(feature.name.toLowerCase());

/** Inheritance and reference lookups of one metamodel. */
class GraphIndex {
  readonly byName: Map<string, ClassNode>;
  private readonly bySimpleName = new Map<string, ClassNode>();
  private readonly children = new Map<string, string[]>();

  constructor(readonly graph: MetamodelGraph) {
    this.byName = new Map(graph.classes.map(c => [c.qualifiedName, c]));
    for (const node of graph.classes) {
      if (!this.bySimpleName.has(node.name)) this.bySimpleName.set(node.name, node);
      for (const parent of node.superTypes) this.children.set(parent, [...(this.children.get(parent) ?? []), node.qualifiedName]);
    }
  }

  /** The class itself and its supertypes, transitively. */
  lineage(node: ClassNode): ClassNode[] {
    const seen = new Map<string, ClassNode>();
    const stack = [node];
    while (stack.length > 0) {
      const next = stack.pop()!;
      if (seen.has(next.qualifiedName)) continue;
      seen.set(next.qualifiedName, next);
      next.superTypes.forEach(parent => { const p = this.byName.get(parent); if (p) stack.push(p); });
    }
    return [...seen.values()];
  }

  references(node: ClassNode): FeatureNode[] {
    return this.lineage(node).flatMap(c => c.references);
  }

  attributes(node: ClassNode): FeatureNode[] {
    return this.lineage(node).flatMap(c => c.attributes);
  }

  typeOf(feature: FeatureNode): ClassNode | undefined {
    return this.bySimpleName.get(feature.typeName);
  }

  /** Concrete (non-abstract, non-interface) subclasses, transitively, sorted by qualified name. */
  concreteSubclasses(node: ClassNode): ClassNode[] {
    const seen = new Set<string>();
    const stack = [...(this.children.get(node.qualifiedName) ?? [])];
    while (stack.length > 0) {
      const next = stack.pop()!;
      if (seen.has(next)) continue;
      seen.add(next);
      stack.push(...(this.children.get(next) ?? []));
    }
    return [...seen].map(name => this.byName.get(name)!)
      .filter(c => !c.isAbstract && !c.isInterface)
      .sort((a, b) => a.qualifiedName.localeCompare(b.qualifiedName));
  }

  /** First class (by qualified name) that contains the given class or one of its supertypes. */
  containerOf(node: ClassNode): ClassNode | null {
    const targets = new Set(this.lineage(node).map(c => c.qualifiedName));
    return [...this.graph.classes]
      .sort((a, b) => a.qualifiedName.localeCompare(b.qualifiedName))
      .find(c => c.references.some(r => r.containment && targets.has(this.typeOf(r)?.qualifiedName ?? ''))) ?? null;
  }
}

/** Pattern roles in one metamodel (without counterpart and confidence). */
export interface DetectedPattern {
  item: ClassNode;
  type: ClassNode;
  definition: ClassNode;
  value: ClassNode;
  container: ClassNode | null;
  definitionsByCategory: Partial<Record<FineDataTypeCategory, ClassNode>>;
  valuesByCategory: Partial<Record<FineDataTypeCategory, ClassNode>>;
  /** Definition and value classes have subclasses per data type (rule 5). */
  typedSubclasses: boolean;
  /** D (V) has concrete subclasses at all; without them attributes map to D (V) itself. */
  definitionHasSubclasses: boolean;
  valueHasSubclasses: boolean;
}

/** Data-type category of a definition or value subclass: by its name or its `value` attribute. */
function categoryOfClass(index: GraphIndex, node: ClassNode): FineDataTypeCategory {
  const byName = fineDataTypeCategoryOfClassName(node.name);
  if (byName !== 'other') return byName;
  const value = index.attributes(node).find(a => a.name.toLowerCase() === 'value');
  return value ? fineDataTypeCategory(value) : 'other';
}

/** The class for an attribute's category, trying related number categories (see categoryCandidates). */
function classForCategory(byCategory: Partial<Record<FineDataTypeCategory, ClassNode>>, category: FineDataTypeCategory) {
  for (const candidate of categoryCandidates(category)) {
    if (byCategory[candidate]) return byCategory[candidate];
  }
  return undefined;
}

function subclassesByCategory(index: GraphIndex, node: ClassNode): Partial<Record<FineDataTypeCategory, ClassNode>> {
  const result: Partial<Record<FineDataTypeCategory, ClassNode>> = {};
  for (const sub of index.concreteSubclasses(node)) {
    const category = categoryOfClass(index, sub);
    if (category !== 'other' && !result[category]) result[category] = sub;
  }
  return result;
}

/**
 * Rules 1–4 must hold: item I has a mandatory single non-containment reference to type T; T contains
 * many definitions D; I contains many values V; V has a mandatory single reference to D or a
 * supertype of D. Rules 5 (data-type subclasses of D and V) and 6 (a container) are optional.
 */
export function detectPattern(graph: MetamodelGraph): DetectedPattern | null {
  const index = new GraphIndex(graph);
  const classes = [...graph.classes].sort((a, b) => a.qualifiedName.localeCompare(b.qualifiedName));
  for (const item of classes) {
    for (const typeRef of index.references(item).filter(r => !r.containment && isMandatorySingle(r))) {
      const type = index.typeOf(typeRef);
      if (!type || type === item) continue;
      for (const definitionRef of index.references(type).filter(r => r.containment && isMany(r))) {
        const definition = index.typeOf(definitionRef);
        if (!definition) continue;
        const definitionLineage = new Set(index.lineage(definition).map(c => c.qualifiedName));
        for (const valueRef of index.references(item).filter(r => r.containment && isMany(r))) {
          const value = index.typeOf(valueRef);
          if (!value || value === definition || value === type) continue;
          const refersToDefinition = index.references(value)
            .some(r => isMandatorySingle(r) && definitionLineage.has(index.typeOf(r)?.qualifiedName ?? ''));
          if (!refersToDefinition) continue;
          const definitionsByCategory = subclassesByCategory(index, definition);
          const valuesByCategory = subclassesByCategory(index, value);
          const containers = [index.containerOf(item), index.containerOf(type)];
          return {
            item, type, definition, value,
            container: containers.find(c => c && c !== type && c !== item) ?? null,
            definitionsByCategory,
            valuesByCategory,
            typedSubclasses: Object.keys(definitionsByCategory).length > 0 && Object.keys(valuesByCategory).length > 0,
            definitionHasSubclasses: index.concreteSubclasses(definition).length > 0,
            valueHasSubclasses: index.concreteSubclasses(value).length > 0,
          };
        }
      }
    }
  }
  return null;
}

export interface Counterpart {
  base: ClassNode;
  subclasses: ClassNode[];
  container: ClassNode | null;
}

/**
 * A base class with at least `minSubclasses` concrete subclasses, each with at least one (own or
 * inherited) attribute, contained by some class. Most subclasses win, then the qualified name.
 */
export function findCounterpart(graph: MetamodelGraph, minSubclasses: number): Counterpart | null {
  const index = new GraphIndex(graph);
  const candidates = graph.classes
    .map(base => ({ base, subclasses: index.concreteSubclasses(base), container: index.containerOf(base) }))
    .filter(c => c.container !== null && c.subclasses.length >= minSubclasses
      && c.subclasses.every(sub => index.attributes(sub).length > 0))
    .sort((a, b) => b.subclasses.length - a.subclasses.length || a.base.qualifiedName.localeCompare(b.base.qualifiedName));
  return candidates[0] ?? null;
}

/** A correspondence fixed by the rule; element names are qualified, `side` is the instantiated side. */
export interface FixedCorrespondence {
  sources: ElementRef[];
  targets: ElementRef[];
  kind: CorrespondenceKind;
  instance?: { side: Side; role: InstanceRole };
  confidence: number;
}

export interface TypeObjectMatch {
  pattern: TypeObjectPattern;
  /** Class level: container ↔ container, base ↔ item, each subclass ↔ instance of the type. */
  classFixed: FixedCorrespondence[];
  /** Feature level, per subclass (qualified name): attribute ↔ instance of definition / value. */
  featureFixed: Map<string, FixedCorrespondence[]>;
  /** Classes of both sides the rule explains (removed from the search), by side. */
  covered: { source: Set<string>; target: Set<string> };
}

const classRef = (node: ClassNode, side: Side): ElementRef =>
  ({ side, kind: 'class', qualifiedName: node.qualifiedName, name: node.name });
const attributeRef = (feature: FeatureNode, side: Side): ElementRef =>
  ({ side, kind: 'attribute', qualifiedName: feature.qualifiedName, name: feature.name, containingClass: feature.owner });

/**
 * Detects the pattern in one metamodel and its counterpart in the other and returns the fixed
 * correspondences, oriented from `source` to `target`. Null if the pattern is on both sides, on
 * neither side, or has no counterpart.
 */
export function detectTypeObject(source: MetamodelGraph, target: MetamodelGraph, minSubclasses: number): TypeObjectMatch | null {
  const inSource = detectPattern(source);
  const inTarget = detectPattern(target);
  if (Boolean(inSource) === Boolean(inTarget)) return null;
  const patternSide: Side = inTarget ? 'target' : 'source';
  const otherSide: Side = patternSide === 'target' ? 'source' : 'target';
  const pattern = (inTarget ?? inSource)!;
  const otherGraph = patternSide === 'target' ? source : target;
  const counterpart = findCounterpart(otherGraph, minSubclasses);
  if (!counterpart) return null;
  const otherIndex = new GraphIndex(otherGraph);

  // Orients a pair (other-side element, pattern-side element) from source to target.
  const fixed = (other: ElementRef, patternElement: ElementRef, kind: CorrespondenceKind, role?: InstanceRole, confidence = 1): FixedCorrespondence => ({
    sources: [patternSide === 'target' ? other : patternElement],
    targets: [patternSide === 'target' ? patternElement : other],
    kind,
    ...(role ? { instance: { side: patternSide, role } } : {}),
    confidence,
  });

  const featureFixed = new Map<string, FixedCorrespondence[]>();
  const attributes = new Map<string, FeatureNode>();
  let mapped = 0;
  for (const sub of counterpart.subclasses) {
    const list: FixedCorrespondence[] = [];
    for (const attribute of otherIndex.attributes(sub).filter(a => !isIdentifier(a))) {
      attributes.set(attribute.qualifiedName, attribute);
      const category = fineDataTypeCategory(attribute);
      // With data-type subclasses, an attribute whose category has none stays unmatched.
      const definition = pattern.definitionHasSubclasses ? classForCategory(pattern.definitionsByCategory, category) : pattern.definition;
      const value = pattern.valueHasSubclasses ? classForCategory(pattern.valuesByCategory, category) : pattern.value;
      if (definition) list.push(fixed(attributeRef(attribute, otherSide), classRef(definition, patternSide), 'instance', 'definition'));
      if (value) list.push(fixed(attributeRef(attribute, otherSide), classRef(value, patternSide), 'instance', 'value'));
    }
    featureFixed.set(sub.qualifiedName, list);
  }
  for (const attribute of attributes.values()) {
    const category = fineDataTypeCategory(attribute);
    if (!pattern.definitionHasSubclasses || classForCategory(pattern.definitionsByCategory, category)) mapped++;
  }
  const share = attributes.size === 0 ? 1 : mapped / attributes.size;
  const confidence = (pattern.typedSubclasses ? 1 : 0.8) * share;
  for (const list of featureFixed.values()) list.forEach(c => { c.confidence = confidence; });

  const classFixed: FixedCorrespondence[] = [];
  if (counterpart.container && pattern.container) {
    classFixed.push(fixed(classRef(counterpart.container, otherSide), classRef(pattern.container, patternSide), 'same', undefined, confidence));
  }
  classFixed.push(fixed(classRef(counterpart.base, otherSide), classRef(pattern.item, patternSide), 'same', undefined, confidence));
  for (const sub of counterpart.subclasses) {
    classFixed.push(fixed(classRef(sub, otherSide), classRef(pattern.type, patternSide), 'instance', 'type', confidence));
  }

  const patternClasses = [
    pattern.item, pattern.type, pattern.definition, pattern.value, pattern.container,
    ...Object.values(pattern.definitionsByCategory), ...Object.values(pattern.valuesByCategory),
  ].filter((c): c is ClassNode => Boolean(c)).map(c => c.qualifiedName);
  const otherClasses = [counterpart.base, counterpart.container, ...counterpart.subclasses]
    .filter((c): c is ClassNode => Boolean(c)).map(c => c.qualifiedName);
  const name = (c: ClassNode) => c.qualifiedName;
  const names = (byCategory: Partial<Record<FineDataTypeCategory, ClassNode>>) =>
    Object.fromEntries(Object.entries(byCategory).map(([category, c]) => [category, c!.qualifiedName])) as Partial<Record<FineDataTypeCategory, string>>;

  return {
    pattern: {
      side: patternSide,
      item: name(pattern.item),
      type: name(pattern.type),
      definition: name(pattern.definition),
      value: name(pattern.value),
      container: pattern.container ? name(pattern.container) : null,
      definitionsByCategory: names(pattern.definitionsByCategory),
      valuesByCategory: names(pattern.valuesByCategory),
      counterpart: {
        base: name(counterpart.base),
        subclasses: counterpart.subclasses.map(name),
        container: counterpart.container ? name(counterpart.container) : null,
      },
      confidence,
    },
    classFixed,
    featureFixed,
    covered: patternSide === 'target'
      ? { source: new Set(otherClasses), target: new Set(patternClasses) }
      : { source: new Set(patternClasses), target: new Set(otherClasses) },
  };
}
