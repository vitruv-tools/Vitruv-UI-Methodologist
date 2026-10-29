import type { ClassNode, DataTypeCategory, FeatureNode, FineDataTypeCategory, MetamodelGraph } from '../../types';
import type { ElementProfile, SimilarityMeasure } from './types';
import { DATATYPES } from './types';

export const DATA_TYPE_CATEGORIES: readonly DataTypeCategory[] = ['text', 'number', 'boolean', 'enum', 'other'];

const TEXT = new Set(['estring', 'echar', 'echaracterobject', 'string', 'char', 'character']);
const INTEGER = new Set([
  'eint', 'elong', 'eshort', 'ebyte', 'ebiginteger', 'eintegerobject', 'elongobject', 'eshortobject', 'ebyteobject',
  'int', 'integer', 'long', 'short', 'byte', 'biginteger',
]);
const DECIMAL = new Set([
  'efloat', 'edouble', 'ebigdecimal', 'efloatobject', 'edoubleobject', 'float', 'double', 'bigdecimal', 'decimal', 'real',
]);
const NUMBER = new Set(['number', 'numeric']);
const BOOLEAN = new Set(['eboolean', 'ebooleanobject', 'boolean', 'bool']);

/** The coarse category: whole and decimal numbers are both `number`. */
export const coarseCategory = (category: FineDataTypeCategory): DataTypeCategory =>
  (category === 'integer' || category === 'decimal' ? 'number' : category);

/**
 * Fine category of a data type name: whole numbers (`EInt`, `ELong`, …) and decimal numbers
 * (`EDouble`, `EFloat`, …) are told apart; custom types by the words they contain.
 */
export function fineDataTypeCategoryOfName(typeName: string): FineDataTypeCategory {
  const name = typeName.toLowerCase();
  if (TEXT.has(name)) return 'text';
  if (INTEGER.has(name)) return 'integer';
  if (DECIMAL.has(name)) return 'decimal';
  if (NUMBER.has(name)) return 'number';
  if (BOOLEAN.has(name)) return 'boolean';
  if (name.includes('string') || name.includes('text')) return 'text';
  if (/int|long/.test(name)) return 'integer';
  if (/double|float|decimal/.test(name)) return 'decimal';
  if (/number|numeric/.test(name)) return 'number';
  if (name.includes('bool')) return 'boolean';
  return 'other';
}

/** Category of a data type name; custom types by the words they contain (`MyString` → text). */
export const dataTypeCategoryOfName = (typeName: string): DataTypeCategory => coarseCategory(fineDataTypeCategoryOfName(typeName));

/** Fine category of an attribute (enum-typed attributes are `enum`). */
export function fineDataTypeCategory(feature: Pick<FeatureNode, 'typeName' | 'typeCategory'>): FineDataTypeCategory {
  return feature.typeCategory === 'enum' ? 'enum' : fineDataTypeCategoryOfName(feature.typeName);
}

/** Category of an attribute (enum-typed attributes are `enum`). */
export const dataTypeCategory = (feature: Pick<FeatureNode, 'typeName' | 'typeCategory'>): DataTypeCategory =>
  coarseCategory(fineDataTypeCategory(feature));

/**
 * Fine category a class stands for by its name, e.g. `IntegerParameterValue` → integer,
 * `NumberParameterDefinition` → number, `BoolParameterValue` → boolean; `other` when the name
 * names no data type.
 */
export function fineDataTypeCategoryOfClassName(className: string): FineDataTypeCategory {
  const words = className.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/\s+/);
  for (const word of words) {
    const category = fineDataTypeCategoryOfName(word);
    if (category !== 'other') return category;
  }
  return 'other';
}

/** Coarse category a class stands for by its name (see {@link fineDataTypeCategoryOfClassName}). */
export const dataTypeCategoryOfClassName = (className: string): DataTypeCategory =>
  coarseCategory(fineDataTypeCategoryOfClassName(className));

/**
 * Classes to try, in order, for an attribute of the given category: a whole number prefers an
 * integer class, then a general number class, then a decimal class; a decimal number prefers a
 * decimal class, then a general number class.
 */
export function categoryCandidates(category: FineDataTypeCategory): FineDataTypeCategory[] {
  switch (category) {
    case 'integer': return ['integer', 'number', 'decimal'];
    case 'decimal': return ['decimal', 'number'];
    case 'number': return ['number', 'decimal', 'integer'];
    default: return [category];
  }
}

/** Own and inherited attributes of every class (supertypes within the same file). */
function inheritedAttributes(graph: MetamodelGraph): Map<string, FeatureNode[]> {
  const byName = new Map(graph.classes.map(c => [c.qualifiedName, c]));
  const collect = (node: ClassNode, seen: Set<string>): FeatureNode[] => {
    if (seen.has(node.qualifiedName)) return [];
    seen.add(node.qualifiedName);
    return [...node.attributes, ...node.superTypes.flatMap(parent => {
      const superNode = byName.get(parent);
      return superNode ? collect(superNode, seen) : [];
    })];
  };
  return new Map(graph.classes.map(node => [node.qualifiedName, collect(node, new Set())]));
}

/** Share of each data-type category among a class's attributes; null without attributes. */
export function dataTypeHistograms(graph: MetamodelGraph): Map<string, number[] | null> {
  return new Map([...inheritedAttributes(graph)].map(([name, attributes]) => {
    if (attributes.length === 0) return [name, null];
    const counts = DATA_TYPE_CATEGORIES.map(category => attributes.filter(a => dataTypeCategory(a) === category).length);
    return [name, counts.map(count => count / attributes.length)];
  }));
}

/** Histogram intersection `1 − ½·L1`. */
export function histogramSimilarity(a: readonly number[], b: readonly number[]): number {
  let difference = 0;
  for (let k = 0; k < a.length; k++) difference += Math.abs(a[k] - b[k]);
  return 1 - difference / 2;
}

const bothHaveAttributes = (source: ElementProfile, target: ElementProfile) =>
  Boolean(source.datatypeHistogram && target.datatypeHistogram);

/**
 * Compares the mix of attribute data types (text, number, boolean, enumeration, other); `EInt` and
 * `EDouble` count as the same category. Not applicable when either class has no attributes.
 */
export const classDatatypeMeasure: SimilarityMeasure = {
  id: DATATYPES,
  version: '1',
  level: 'class',
  applicable: bothHaveAttributes,
  score: (source, target) => (bothHaveAttributes(source, target)
    ? histogramSimilarity(source.datatypeHistogram!, target.datatypeHistogram!)
    : Number.NaN),
};
