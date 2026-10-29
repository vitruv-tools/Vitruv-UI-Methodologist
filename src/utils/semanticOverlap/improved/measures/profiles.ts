/*
 * Independent copy of the paper approach's `measures/profiles.ts`; evolves separately — do not
 * import from the paper pipeline for logic.
 */
import type { LexicalSource } from '../../lexical/wordNetSource';
import { tokenize } from '../../lexical/tokenize';
import type { AnalysisSettings, ClassNode, FeatureNode, MetamodelGraph, Side } from '../../types';
import type { ElementProfile, NameTokens } from './types';
import { acronymOf, expandAbbreviation, initialsOf, rawWords } from '../lexical/abbreviations';
import { splitCompound } from '../lexical/compounds';
import { roleVectors } from './roleMeasure';
import { dataTypeHistograms } from './datatypeMeasure';

/**
 * Weight of context tokens (feature and operation names of a class) relative to the element's own
 * name tokens, so that the name dominates the vocabulary but the context still counts (paper §3.2.1).
 */
export const CONTEXT_TOKEN_WEIGHT = 0.5;

/** Extra inputs of the improved approach's profiles; absent fields keep the paper behaviour. */
export interface ProfileOptions {
  /** Token → IDF weight (max 1); absent means every token weighs 1. */
  idf?: ReadonlyMap<string, number>;
  /** Split compounds and expand abbreviations; `isWord` is the dictionary. */
  compounds?: { isWord: (word: string) => boolean };
}

/** Acronym and initials of a name, only with compound handling. */
const acronymFields = (name: string, options: ProfileOptions) => {
  if (!options.compounds) return {};
  const acronym = acronymOf(name);
  return { ...(acronym ? { acronym } : {}), initials: initialsOf(rawWords(name)) };
};

const weightOf = (token: string, options: ProfileOptions) => options.idf?.get(token) ?? 1;
const withWeights = (tokens: string[], options: ProfileOptions) =>
  (options.idf ? { tokenWeights: tokens.map(token => weightOf(token, options)) } : {});

const nameTokensWithSynonyms = (name: string, lexical: LexicalSource, options: ProfileOptions = {}): NameTokens => {
  const tokens = nameTokens(name, lexical, options);
  return {
    tokens,
    tokenSynonyms: tokens.map(token => new Set(lexical.synonyms(token))),
    ...withWeights(tokens, options),
    ...acronymFields(name, options),
  };
};

/**
 * Lemmatised tokens of a name; unknown words stay as they are. With compound handling, unknown
 * tokens are split into dictionary words and abbreviations add the words they stand for (the
 * abbreviation itself is kept, so `id` still matches `id`).
 */
export function nameTokens(name: string, lexical: LexicalSource, options: ProfileOptions = {}): string[] {
  const lemma = (token: string) => lexical.lemma(token) ?? token;
  const tokens = tokenize(name).map(lemma);
  if (!options.compounds) return tokens;
  const { isWord } = options.compounds;
  return tokens.flatMap(token => {
    const parts = splitCompound(token, isWord).map(lemma);
    return [...parts, ...expandAbbreviation(token).filter(word => !parts.includes(word))];
  });
}

function buildVocabulary(
  ownTokens: readonly string[],
  contextTokens: readonly string[],
  lexical: LexicalSource,
  synonymWeight: number,
  options: ProfileOptions = {},
): { vocabulary: Map<string, number>; norm: number } {
  const vocabulary = new Map<string, number>();
  const add = (term: string, weight: number) => vocabulary.set(term, (vocabulary.get(term) ?? 0) + weight);
  const addWithSynonyms = (token: string, baseWeight: number) => {
    // Synonyms inherit the weight (and IDF) of the token they expand.
    const weight = baseWeight * weightOf(token, options);
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
/** Tokens of a class's vocabulary before synonym expansion: own name, features and operations. */
export function classDocument(node: ClassNode, lexical: LexicalSource, options: ProfileOptions = {}): string[] {
  return [node.name, ...node.attributes.map(f => f.name), ...node.references.map(f => f.name), ...node.operations.map(o => o.name)]
    .flatMap(name => nameTokens(name, lexical, options));
}

export function buildClassProfiles(
  graph: MetamodelGraph,
  side: Side,
  lexical: LexicalSource,
  settings: AnalysisSettings,
  options: ProfileOptions = {},
): ElementProfile[] {
  const depths = inheritanceDepths(graph.classes);
  const roles = roleVectors(graph);
  const histograms = dataTypeHistograms(graph);
  const children = new Map<string, number>();
  for (const node of graph.classes) {
    for (const parent of node.superTypes) children.set(parent, (children.get(parent) ?? 0) + 1);
  }
  return graph.classes.map(node => {
    const tokens = nameTokens(node.name, lexical, options);
    const context = [
      ...node.attributes, ...node.references,
    ].flatMap(feature => nameTokens(feature.name, lexical, options))
      .concat(node.operations.flatMap(op => nameTokens(op.name, lexical, options)));
    return {
      ref: { side, kind: 'class', qualifiedName: node.qualifiedName, name: node.name },
      nameLower: node.name.toLowerCase(),
      tokens,
      tokenSynonyms: tokens.map(token => new Set(lexical.synonyms(token))),
      ...withWeights(tokens, options),
      ...acronymFields(node.name, options),
      roleVector: roles.get(node.qualifiedName),
      datatypeHistogram: histograms.get(node.qualifiedName) ?? null,
      ...buildVocabulary(tokens, context, lexical, settings.synonymWeight, options),
      neighbours: [...new Set([
        ...node.superTypes.map(qualifiedName => qualifiedName.slice(qualifiedName.lastIndexOf('.') + 1)),
        ...node.references.map(reference => reference.typeName),
      ])].filter(Boolean).map(name => nameTokensWithSynonyms(name, lexical, options)),
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
  options: ProfileOptions = {},
): ElementProfile[] {
  return features.map(feature => {
    const tokens = nameTokens(feature.name, lexical, options);
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
      ...withWeights(tokens, options),
      ...acronymFields(feature.name, options),
      ...buildVocabulary(tokens, [], lexical, settings.synonymWeight, options),
      neighbours: feature.typeName ? [nameTokensWithSynonyms(feature.typeName, lexical, options)] : [],
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
