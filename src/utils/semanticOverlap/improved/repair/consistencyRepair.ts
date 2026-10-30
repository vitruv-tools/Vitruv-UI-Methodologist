import type { Correspondence, ElementRef, FeatureNode, MetamodelGraph, RepairRecord } from '../../types';

/**
 * Consistency repair after Fang (2022, Table 6.1) and LogMap-style greedy repair: correspondences
 * that contradict each other are removed, the lowest-scored party first, until none is left.
 * Correspondences produced by a rule (`fixed`) are never removed. Each removal is recorded.
 *
 * Rules:
 * - `subclass` (classes): a subclass mapped outside the counterpart (or its subclasses) of its
 *   superclass's counterpart; checked on both sides.
 * - `reference-ends` (features): a reference correspondence whose type classes do not correspond,
 *   including their supertypes.
 * - `opposite` (features): r ↔ r′ and opp(r) ↔ x with x ≠ opp(r′), where r′ has an opposite.
 * - `containment` (features): a containment reference mapped to a non-containment one.
 */

type Rule = RepairRecord['rule'];

interface Violation {
  rule: Rule;
  /** The parties; the lowest-scored non-fixed one is removed. */
  parties: Correspondence[];
  /** For a group, the element of each party that takes part (removed alone if the group has more). */
  members: (ElementRef | null)[];
  reason: string;
}

const summaryOf = (c: Correspondence): RepairRecord['removed'] => ({
  level: c.level,
  sources: c.sources.map(r => r.qualifiedName),
  targets: c.targets.map(r => r.qualifiedName),
  score: c.score,
});

/** Transitive supertypes of a class, including itself. */
function supertypeClosure(graph: MetamodelGraph): (qn: string) => Set<string> {
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

/** Correspondences whose class hierarchy is checked: same-concept ones and split/merge groups. */
const isStructural = (c: Correspondence) => c.kind === undefined || c.kind === 'same' || c.kind === 'split' || c.kind === 'merge';

/**
 * Removes a party of the violation: the lowest-scored one that is not fixed. A group loses only the
 * member that takes part, if it has more than one element on that side.
 */
function resolve(violation: Violation, correspondences: Correspondence[]): { next: Correspondence[]; record: RepairRecord } | null {
  const candidates = violation.parties
    .map((party, k) => ({ party, member: violation.members[k] }))
    .filter(({ party }) => !party.fixed)
    .sort((a, b) => a.party.score - b.party.score || a.party.id.localeCompare(b.party.id));
  if (candidates.length === 0) return null;
  const { party, member } = candidates[0];
  const kept = violation.parties.find(p => p !== party) ?? party;
  const side = member && party.sources.includes(member) ? 'sources' : 'targets';
  const shrink = member !== null && party[side].length > 1;
  const removed: Correspondence = shrink ? { ...party, [side]: [member] } : party;
  const next = correspondences.flatMap(c => {
    if (c !== party) return [c];
    return shrink ? [{ ...c, [side]: c[side].filter(ref => ref !== member) }] : [];
  });
  return { next, record: { rule: violation.rule, removed: summaryOf(removed), kept: summaryOf(kept), reason: violation.reason } };
}

/** Greedy loop: resolve the violation with the lowest-scored party first, at most `limit` times. */
function repairLoop(
  correspondences: Correspondence[],
  find: (current: Correspondence[]) => Violation[],
  limit: number,
): { correspondences: Correspondence[]; repairs: RepairRecord[] } {
  let current = correspondences;
  const repairs: RepairRecord[] = [];
  const lowest = (v: Violation) => Math.min(...v.parties.filter(p => !p.fixed).map(p => p.score));
  for (let iteration = 0; iteration < limit; iteration++) {
    const violations = find(current).filter(v => v.parties.some(p => !p.fixed));
    if (violations.length === 0) break;
    violations.sort((a, b) => lowest(a) - lowest(b) || a.reason.localeCompare(b.reason));
    const step = resolve(violations[0], current);
    if (!step) break;
    current = step.next;
    repairs.push(step.record);
  }
  return { correspondences: current, repairs };
}

/** `subclass` violations on one side: `own` picks that side's refs, `other` the counterpart's. */
function subclassViolations(
  correspondences: readonly Correspondence[],
  ownSupers: (qn: string) => Set<string>,
  otherSupers: (qn: string) => Set<string>,
  own: 'sources' | 'targets',
): Violation[] {
  const other = own === 'sources' ? 'targets' : 'sources';
  const violations: Violation[] = [];
  const structural = correspondences.filter(isStructural);
  for (const sup of structural) {
    for (const sub of structural) {
      if (sub === sup) continue;
      for (const a of sup[own]) {
        for (const aSub of sub[own]) {
          if (aSub.qualifiedName === a.qualifiedName || !ownSupers(aSub.qualifiedName).has(a.qualifiedName)) continue;
          const counterparts = new Set(sup[other].map(r => r.qualifiedName));
          const consistent = sub[other].some(t => [...otherSupers(t.qualifiedName)].some(s => counterparts.has(s)));
          if (consistent) continue;
          violations.push({
            rule: 'subclass', parties: [sup, sub], members: [a, aSub],
            reason: `${aSub.name} is a subclass of ${a.name}, but its counterpart is not ${sup[other].map(r => r.name).join(', ')} or one of its subclasses`,
          });
        }
      }
    }
  }
  return violations;
}

/** Removes class correspondences that contradict the class hierarchies. */
export function repairClassCorrespondences(
  correspondences: Correspondence[],
  source: MetamodelGraph,
  target: MetamodelGraph,
): { correspondences: Correspondence[]; repairs: RepairRecord[] } {
  const sourceSupers = supertypeClosure(source);
  const targetSupers = supertypeClosure(target);
  return repairLoop(correspondences, current => [
    ...subclassViolations(current, sourceSupers, targetSupers, 'sources'),
    ...subclassViolations(current, targetSupers, sourceSupers, 'targets'),
  ], source.classes.length + target.classes.length);
}

const featureIndex = (graph: MetamodelGraph) =>
  new Map(graph.classes.flatMap(c => [...c.attributes, ...c.references]).map(f => [f.qualifiedName, f] as [string, FeatureNode]));

/**
 * Removes feature correspondences (children of the class correspondences) that contradict the
 * class correspondences or each other. Path correspondences are not checked. Returns the class
 * correspondences with repaired children.
 */
export function repairFeatureCorrespondences(
  classCorrespondences: Correspondence[],
  source: MetamodelGraph,
  target: MetamodelGraph,
): { correspondences: Correspondence[]; repairs: RepairRecord[] } {
  const sourceFeatures = featureIndex(source);
  const targetFeatures = featureIndex(target);
  const sourceSupers = supertypeClosure(source);
  const targetSupers = supertypeClosure(target);
  const classOf = (graph: MetamodelGraph, f: FeatureNode) => graph.classes.find(c => c.name === f.typeName)?.qualifiedName;
  const linked = new Set(classCorrespondences.flatMap(c =>
    c.sources.flatMap(s => c.targets.map(t => `${s.qualifiedName}|${t.qualifiedName}`))));
  const classesCorrespond = (s: string, t: string) =>
    [...sourceSupers(s)].some(a => [...targetSupers(t)].some(b => linked.has(`${a}|${b}`)));
  // Class correspondences only take part as the kept party: they are made non-removable here.
  const parentOf = new Map<string, Correspondence>();
  const children = classCorrespondences.flatMap(parent => (parent.children ?? []).map(child => {
    parentOf.set(child.id, { ...parent, fixed: true });
    return child;
  }));
  const checked = (c: Correspondence) => c.kind !== 'path' && c.kind !== 'instance';

  const find = (current: Correspondence[]): Violation[] => {
    const violations: Violation[] = [];
    const pairs = current.filter(checked).flatMap(c => c.sources.flatMap(s => c.targets.map(t => ({
      c, s, t, from: sourceFeatures.get(s.qualifiedName), to: targetFeatures.get(t.qualifiedName),
    }))));
    for (const { c, s, from, to } of pairs) {
      if (from?.kind !== 'reference' || to?.kind !== 'reference') continue;
      const parent = parentOf.get(c.id)!;
      if (from.containment !== to.containment) {
        violations.push({ rule: 'containment', parties: [c, parent], members: [s, null],
          reason: `${from.name} is ${from.containment ? '' : 'not '}a containment, ${to.name} is ${to.containment ? '' : 'not '}one` });
      }
      const [fromType, toType] = [classOf(source, from), classOf(target, to)];
      if (fromType && toType && !classesCorrespond(fromType, toType)) {
        violations.push({ rule: 'reference-ends', parties: [c, parent], members: [s, null],
          reason: `the types of ${from.name} and ${to.name} do not correspond` });
      }
      if (from.opposite && to.opposite) {
        for (const other of pairs) {
          if (other.c === c || other.s.qualifiedName !== from.opposite || other.t.qualifiedName === to.opposite) continue;
          violations.push({ rule: 'opposite', parties: [c, other.c], members: [s, other.s],
            reason: `${from.name} and ${other.from?.name ?? other.s.name} are opposites, but their counterparts are not` });
        }
      }
    }
    return violations;
  };
  const { correspondences: repaired, repairs } = repairLoop(children, find, sourceFeatures.size + targetFeatures.size);
  // Removed children are gone; children that lost a group member are replaced (ids are unique).
  const byId = new Map(repaired.map(c => [c.id, c]));
  const keptChildren = (children: Correspondence[]) => children.flatMap(child => byId.get(child.id) ?? []);
  return {
    correspondences: classCorrespondences.map(parent => (parent.children ? { ...parent, children: keptChildren(parent.children) } : parent)),
    repairs,
  };
}

/** Share of classes and features in some correspondence, per side. */
export function coverage(
  correspondences: readonly Correspondence[],
  source: MetamodelGraph,
  target: MetamodelGraph,
): { source: { classes: number; features: number }; target: { classes: number; features: number } } {
  const used = { source: new Set<string>(), target: new Set<string>() };
  const collect = (c: Correspondence) => {
    c.sources.forEach(r => used.source.add(r.qualifiedName));
    c.targets.forEach(r => used.target.add(r.qualifiedName));
    c.children?.forEach(collect);
  };
  correspondences.forEach(collect);
  const share = (graph: MetamodelGraph, names: Set<string>) => {
    const features = graph.classes.flatMap(c => [...c.attributes, ...c.references]);
    const ratio = (count: number, total: number) => (total === 0 ? 0 : Math.round((count / total) * 1000) / 1000);
    return {
      classes: ratio(graph.classes.filter(c => names.has(c.qualifiedName)).length, graph.classes.length),
      features: ratio(features.filter(f => names.has(f.qualifiedName)).length, features.length),
    };
  };
  return { source: share(source, used.source), target: share(target, used.target) };
}
