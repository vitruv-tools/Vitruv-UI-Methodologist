import type { LexicalSource } from '../lexical/wordNetSource';
import { tokenize } from '../lexical/tokenize';
import type { AnalysisSettings, ClassNode, FeatureNode, MetamodelGraph, Side } from '../types';
import type { ElementProfile, NameTokens } from './types';

/**
 * Weight of context tokens (feature and operation names of a class) relative to the element's own
 * name tokens, so that the name dominates the vocabulary but the context still counts (paper §3.2.1).
 */
export const CONTEXT_TOKEN_WEIGHT = 0.5;

const nameTokensWithSynonyms = (name: string, lexical: LexicalSource): NameTokens => {
  const tokens = nameTokens(name, lexical);
  return { tokens, tokenSynonyms: tokens.map(token => new Set(lexical.synonyms(token))) };
};

/** Lemmatised tokens of a name; unknown words stay as they are. */
export function nameTokens(name: string, lexical: LexicalSource): string[] {
  return tokenize(name).map(token => lexical.lemma(token) ?? token);
}

function buildVocabulary(
  ownTokens: readonly string[],
  contextTokens: readonly string[],
  lexical: LexicalSource,
  synonymWeight: number,
): { vocabulary: Map<string, number>; norm: number } {
  const vocabulary = new Map<string, number>();
  const add = (term: string, weight: number) => vocabulary.set(term, (vocabulary.get(term) ?? 0) + weight);
  const addWithSynonyms = (token: string, weight: number) => {
    add(token, weight);
    if (synonymWeight > 0) {
      for (const synonym of lexical.synonyms(token)) add(synonym, synonymWeight * weight);
    }
  };
  ownTokens.forEach(token => addWithSynonyms(token, 1));
  contextTokens.forEach(token => addWithSynonyms(token, CONTEXT_TOKEN_WEIGHT));
  let squares = 0;
  for (const weight of vocabulary.values()) squares += weight * weight;
  return { vocabulary, norm: Math.sqrt(squares) };
}

/** Depth of inheritance per class (longest path to a root within the file; cycles are cut). */
function inheritanceDepths(classes: readonly ClassNode[]): Map<string, number> {
  const byName = new Map(classes.map(c => [c.qualifiedName, c]));
  const depths = new Map<string, number>();
  const depth = (name: string, visiting: Set<string>): number => {
    const known = depths.get(name);
    if (known !== undefined) return known;
    const node = byName.get(name);
    if (!node || visiting.has(name)) return 0;
    visiting.add(name);
    const parents = node.superTypes.filter(s => byName.has(s));
    const value = parents.length === 0 ? 0 : 1 + Math.max(...parents.map(p => depth(p, visiting)));
    visiting.delete(name);
    depths.set(name, value);
    return value;
  };
  classes.forEach(c => depth(c.qualifiedName, new Set()));
  return depths;
}

/**
 * Class profiles. Metrics (paper §3.1): NAT (own attributes), NAC (own references), WMC (operations,
 * weight 1 each), DIT (depth of inheritance), NOC (direct subclasses). The vocabulary contains the
 * class name and the names of its features and operations, each with WordNet synonyms.
 */
export function buildClassProfiles(
  graph: MetamodelGraph,
  side: Side,
  lexical: LexicalSource,
  settings: AnalysisSettings,
): ElementProfile[] {
  const depths = inheritanceDepths(graph.classes);
  const children = new Map<string, number>();
  for (const node of graph.classes) {
    for (const parent of node.superTypes) children.set(parent, (children.get(parent) ?? 0) + 1);
  }
  return graph.classes.map(node => {
    const tokens = nameTokens(node.name, lexical);
    const context = [
      ...node.attributes, ...node.references,
    ].flatMap(feature => nameTokens(feature.name, lexical))
      .concat(node.operations.flatMap(op => nameTokens(op.name, lexical)));
    return {
      ref: { side, kind: 'class', qualifiedName: node.qualifiedName, name: node.name },
      nameLower: node.name.toLowerCase(),
      tokens,
      tokenSynonyms: tokens.map(token => new Set(lexical.synonyms(token))),
      ...buildVocabulary(tokens, context, lexical, settings.synonymWeight),
      neighbours: [...new Set([
        ...node.superTypes.map(qualifiedName => qualifiedName.slice(qualifiedName.lastIndexOf('.') + 1)),
        ...node.references.map(reference => reference.typeName),
      ])].filter(Boolean).map(name => nameTokensWithSynonyms(name, lexical)),
      metrics: [
        node.attributes.length,
        node.references.length,
        node.operations.length,
        depths.get(node.qualifiedName) ?? 0,
        children.get(node.qualifiedName) ?? 0,
      ],
    };
  });
}

const TYPE_CATEGORY_CODES: Record<FeatureNode['typeCategory'], number> = { primitive: 0, enum: 1, class: 2 };

/**
 * Feature profiles. Metrics: kind (0 attribute, 1 reference), lower bound (capped at 2), upper bound
 * (many and values ≥ 2 → 2), containment (0/1), type category (0 primitive, 1 enum, 2 class).
 */
export function buildFeatureProfiles(
  features: readonly FeatureNode[],
  side: Side,
  lexical: LexicalSource,
  settings: AnalysisSettings,
): ElementProfile[] {
  return features.map(feature => {
    const tokens = nameTokens(feature.name, lexical);
    return {
      ref: {
        side,
        kind: feature.kind,
        qualifiedName: feature.qualifiedName,
        name: feature.name,
        containingClass: feature.owner,
      },
      nameLower: feature.name.toLowerCase(),
      tokens,
      tokenSynonyms: tokens.map(token => new Set(lexical.synonyms(token))),
      ...buildVocabulary(tokens, [], lexical, settings.synonymWeight),
      neighbours: feature.typeName ? [nameTokensWithSynonyms(feature.typeName, lexical)] : [],
      metrics: [
        feature.kind === 'reference' ? 1 : 0,
        Math.min(2, Math.max(0, feature.lower)),
        feature.upper < 0 || feature.upper >= 2 ? 2 : feature.upper,
        feature.containment ? 1 : 0,
        TYPE_CATEGORY_CODES[feature.typeCategory],
      ],
    };
  });
}
