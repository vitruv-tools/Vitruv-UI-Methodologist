import { lemmatize } from '../../lexical/lemmatize';
import { tokenize } from '../../lexical/tokenize';
import type { ClassNode, ElementRef, FeatureNode, MetamodelGraph, Side } from '../../types';
import { featuresWithInherited } from '../hierarchy/features';
import type { FixedCorrespondence } from '../typeObject/detectTypeObject';

/**
 * Conditional correspondences (Wimmer et al. 2010, A2I; Fang 2022, Table 6.1): a class C whose
 * enumeration or boolean attribute selects among the subclasses of a class P on the other side
 * (`Brake` with `kind = DISC` ↔ `DiscBrake`). A rule in the style of the type-object rule: each
 * match is a fixed correspondence `C ↔ Sᵢ`; the matched subclasses leave the search, C stays in it.
 */

export interface ConditionalCorrespondence extends FixedCorrespondence {
  condition: { attribute: string; value: string };
}

export interface ConditionalMatch {
  classFixed: ConditionalCorrespondence[];
  /** Subclasses explained by the rule (removed from the search). */
  covered: { source: Set<string>; target: Set<string> };
}

const BOOLEAN_PREFIXES = new Set(['is', 'has', 'can']);

const classRef = (side: Side, node: ClassNode): ElementRef => ({ side, kind: 'class', qualifiedName: node.qualifiedName, name: node.name });

/** All transitive subclasses of every class. */
function subclassesOf(graph: MetamodelGraph): Map<string, ClassNode[]> {
  const direct = new Map<string, ClassNode[]>();
  for (const node of graph.classes) {
    for (const parent of node.superTypes) direct.set(parent, [...(direct.get(parent) ?? []), node]);
  }
  const all = new Map<string, ClassNode[]>();
  const collect = (qn: string, seen: Set<string>): ClassNode[] => {
    const result: ClassNode[] = [];
    for (const child of direct.get(qn) ?? []) {
      if (seen.has(child.qualifiedName)) continue;
      seen.add(child.qualifiedName);
      result.push(child, ...collect(child.qualifiedName, seen));
    }
    return result;
  };
  for (const node of graph.classes) all.set(node.qualifiedName, collect(node.qualifiedName, new Set([node.qualifiedName])));
  return all;
}

interface Candidate {
  attribute: FeatureNode;
  /** Value → subclass. */
  matches: [string, ClassNode][];
  /** Number of possible values (literals, or 2 for a boolean). */
  values: number;
  base: ClassNode;
}

/**
 * The best way the attributes of `node` select among the subclasses of a class on the other side:
 * enumerations need ≥ 2 literals matching distinct subclasses and at least half of the literals
 * matching; a boolean matches when its words name exactly one subclass.
 */
function bestCandidate(
  node: ClassNode,
  own: MetamodelGraph,
  other: MetamodelGraph,
  otherSubclasses: Map<string, ClassNode[]>,
  words: (name: string) => string[],
): Candidate | null {
  const contains = (container: string[], part: string[]) => part.length > 0 && part.every(word => container.includes(word));
  const candidates: Candidate[] = [];
  for (const attribute of featuresWithInherited(own, node.qualifiedName).filter(f => f.kind === 'attribute')) {
    const literals = own.enums.find(e => e.name === attribute.typeName)?.literals;
    const isBoolean = attribute.typeName === 'EBoolean' || attribute.typeName === 'EBooleanObject';
    if (!literals && !isBoolean) continue;
    for (const base of other.classes) {
      const subclasses = otherSubclasses.get(base.qualifiedName) ?? [];
      if (subclasses.filter(s => !s.isAbstract && !s.isInterface).length < 2) continue;
      // A value matches the subclass whose name words contain its words (or the reverse), the closest first.
      const subclassFor = (value: string[]) => subclasses
        .filter(s => contains(words(s.name), value) || contains(value, words(s.name)))
        .sort((a, b) => words(a.name).length - words(b.name).length || a.qualifiedName.localeCompare(b.qualifiedName))[0];
      const matches: [string, ClassNode][] = [];
      if (literals) {
        const used = new Set<string>();
        for (const literal of literals) {
          const subclass = subclassFor(words(literal));
          if (subclass && !used.has(subclass.qualifiedName)) {
            used.add(subclass.qualifiedName);
            matches.push([literal, subclass]);
          }
        }
        if (matches.length < 2 || matches.length * 2 < literals.length) continue;
      } else {
        const named = subclasses.filter(s => contains(words(s.name), words(attribute.name).filter(w => !BOOLEAN_PREFIXES.has(w))));
        if (named.length !== 1) continue;
        matches.push(['true', named[0]]);
        const others = subclasses.filter(s => s !== named[0] && !s.isAbstract && !s.isInterface);
        if (others.length === 1) matches.push(['false', others[0]]);
      }
      candidates.push({ attribute, matches, values: literals?.length ?? 2, base });
    }
  }
  candidates.sort((a, b) => b.matches.length - a.matches.length
    || a.attribute.qualifiedName.localeCompare(b.attribute.qualifiedName) || a.base.qualifiedName.localeCompare(b.base.qualifiedName));
  return candidates[0] ?? null;
}

/**
 * Detects conditional correspondences in both directions. When both sides qualify, the side with
 * more matched values wins; on a tie, the source side. `isWord` lemmatises name words (optional).
 */
export function detectConditional(
  source: MetamodelGraph,
  target: MetamodelGraph,
  isWord: (word: string) => boolean = () => false,
): ConditionalMatch | null {
  const words = (name: string) => tokenize(name).map(token => lemmatize(token, isWord));
  const sideMatches = (side: Side) => {
    const [own, other] = side === 'source' ? [source, target] : [target, source];
    const otherSubclasses = subclassesOf(other);
    return own.classes.flatMap(node => {
      const candidate = bestCandidate(node, own, other, otherSubclasses, words);
      return candidate ? [{ node, candidate }] : [];
    });
  };
  const count = (found: ReturnType<typeof sideMatches>) => found.reduce((sum, f) => sum + f.candidate.matches.length, 0);
  const fromSource = sideMatches('source');
  const fromTarget = sideMatches('target');
  const side: Side = count(fromTarget) > count(fromSource) ? 'target' : 'source';
  const found = side === 'source' ? fromSource : fromTarget;
  if (found.length === 0) return null;
  const otherSide: Side = side === 'source' ? 'target' : 'source';
  const covered = { source: new Set<string>(), target: new Set<string>() };
  const classFixed = found.flatMap(({ node, candidate }) => {
    // Confidence: the share of the attribute's values that select a subclass.
    const confidence = Math.min(1, candidate.matches.length / candidate.values);
    return candidate.matches.map(([value, subclass]): ConditionalCorrespondence => {
      covered[otherSide].add(subclass.qualifiedName);
      const own = classRef(side, node);
      const counterpart = classRef(otherSide, subclass);
      return {
        sources: [side === 'source' ? own : counterpart],
        targets: [side === 'source' ? counterpart : own],
        kind: 'conditional',
        condition: { attribute: candidate.attribute.qualifiedName, value },
        confidence,
      };
    });
  });
  return { classFixed, covered };
}
