import type { Edge, Node } from 'reactflow';
import type { ViewType } from '../hooks/useViewTypes';
import {
  parseEcoreMetamodelMetrics,
  type EcoreMetamodelMetrics,
} from './ecoreMetrics';
import {
  countOclConstraints,
  extractOclMentionedNames,
  extractReactionClassReferences,
  parseOclConstraints,
  parseReactionFileMetrics,
  type OclConstraint,
  type ReactionBlockMetrics,
  type ReactionClassReferences,
  type ReactionFileMetrics,
} from './reactionMetrics';

export interface MetamodelFileInput {
  id: string;
  fileName: string;
  fileContent: string;
}

export interface ReactionSpecInput {
  id: string;
  sourceId: string;
  targetId: string;
  sourceName: string;
  targetName: string;
  code: string;
}

export interface MethodologistMetricsInput {
  metamodels: MetamodelFileInput[];
  reactions: ReactionSpecInput[];
  viewTypes: ViewType[];
  oclContent: string;
}

export interface CorrespondenceTypeMetrics {
  id: string;
  sourceName: string;
  targetName: string;
  reactionCount: number;
  routineCount: number;
  correspondenceTypeCount: number;
  correspondenceTypeKeys: string[];
  linesOfCode: number;
  direction: 'one-way' | 'both-ways';
  reactions: ReactionBlockMetrics[];
}

export interface MetamodelLinkMetrics {
  id: string;
  name: string;
  fanIn: number;
  fanOut: number;
  isOrphan: boolean;
  concreteClassCount: number;
  coveredConcreteClassCount: number;
  uncoveredClassNames: string[];
}

export interface OclReactionGapItem {
  name: string;
  contextClass: string;
}

export interface ClassHotspot {
  className: string;
  metamodel: string;
  oclRuleCount: number;
  reactionFileCount: number;
  score: number;
}

export interface MethodologistMetrics {
  metamodels: EcoreMetamodelMetrics[];
  classCount: number;
  attributesTotal: number;
  referencesTotal: number;
  containmentReferences: number;
  nonContainmentReferences: number;
  enumCount: number;
  enumLiteralCount: number;
  packageCount: number;
  abstractClassCount: number;
  concreteClassCount: number;
  viewTypeCount: number;
  viewpointCount: number;
  singleViewTypeCount: number;
  multiViewTypeCount: number;
  correspondenceTypeCount: number;
  correspondenceTypes: CorrespondenceTypeMetrics[];
  reactionCount: number;
  oclConstraintCount: number;
  operationsTotal: number;
  nocMax: number;
  nocAvg: number;
  containmentHeightMax: number;
  crossPackageReferences: number;
  avgLocPerReaction: number;
  orphanMetamodelCount: number;
  linkedMetamodelCount: number;
  coveredConcreteClassCount: number;
  correspondenceCoveragePercent: number;
  metamodelLinks: MetamodelLinkMetrics[];
  attributesPerClass: number;
  referencesPerClass: number;
  containmentRatio: number;
  classesCoveredByViews: number;
  classesCoveredByViewsRatio: number;
  viewClassesAggregated: number;
  reactionsPerCorrespondenceType: number;
  reactionComplexityRatio: number;
  constraintDensity: number;
  metamodelToViewRatio: number;
  viewTypePairCount: number;
  correspondenceToViewPairRatio: number;
  modularizationRatio: number;
  associationCount: number;
  reactionTotalLoc: number;
  oneWayReactionPairCount: number;
  bidirectionalReactionPairCount: number;
  detectOnlyClassNames: string[];
  repairOnlyClassNames: string[];
  detectAndRepairClassNames: string[];
  unprotectedClassNames: string[];
  unprotectedAssociationNames: string[];
  oclRulesWithoutReaction: OclReactionGapItem[];
  hotspotClasses: ClassHotspot[];
}

export function safeRatio(numerator: number, denominator: number): number {
  if (denominator === 0 || !Number.isFinite(numerator) || !Number.isFinite(denominator)) return 0;
  return numerator / denominator;
}

function unorderedPairCount(n: number): number {
  if (n < 2) return 0;
  return (n * (n - 1)) / 2;
}

function computeViewProjection(
  metamodels: Array<EcoreMetamodelMetrics & { id: string }>,
  viewTypes: ViewType[],
): { uniqueClassCount: number; aggregatedClassCount: number } {
  const byId = new Map(metamodels.map(mm => [mm.id, mm]));
  const unique = new Set<string>();
  let aggregatedClassCount = 0;
  for (const viewType of viewTypes) {
    for (const nodeId of viewType.linkedNodeIds) {
      const mm = byId.get(nodeId);
      if (!mm) continue;
      aggregatedClassCount += mm.classCount;
      for (const cls of mm.classes) {
        unique.add(`${mm.id}::${cls.id}`);
      }
    }
  }
  return { uniqueClassCount: unique.size, aggregatedClassCount };
}

function fileBaseName(fileName: string): string {
  return fileName.replace(/\.ecore$/i, '') || fileName;
}

function nodeDisplayName(node: Node | undefined, fallback: string): string {
  if (!node) return fallback;
  const fileName = typeof node.data?.fileName === 'string' ? node.data.fileName : '';
  return fileBaseName(fileName) || fallback;
}

function metamodelDedupeKey(node: Node): string {
  const metaModelId = node.data?.metaModelId;
  if (typeof metaModelId === 'number' && Number.isFinite(metaModelId)) return `mm:${metaModelId}`;
  const ecoreFileId = node.data?.ecoreFileId;
  if (typeof ecoreFileId === 'number' && Number.isFinite(ecoreFileId)) return `file:${ecoreFileId}`;
  const fileName = typeof node.data?.fileName === 'string' ? node.data.fileName.trim().toLowerCase() : '';
  if (fileName) return `name:${fileName}`;
  return `id:${node.id}`;
}

/**
 * Maps every metamodel node id to the id of the node that represents it in the metrics.
 *
 * Canvas copies of the same metamodel are collapsed into the first one (see
 * {@link collectMetamodelInputs}), but reaction edges may still be attached to a copy.
 * Ids of nodes that are not metamodels are not in the map.
 */
export function canonicalMetamodelNodeIds(nodes: Node[]): Map<string, string> {
  const firstByKey = new Map<string, string>();
  const canonical = new Map<string, string>();
  for (const node of nodes) {
    if (node.type !== 'ecoreFile') continue;
    const key = metamodelDedupeKey(node);
    const first = firstByKey.get(key) ?? node.id;
    firstByKey.set(key, first);
    canonical.set(node.id, first);
  }
  return canonical;
}

export function collectMetamodelInputs(nodes: Node[]): MetamodelFileInput[] {
  const seen = new Set<string>();
  const inputs: MetamodelFileInput[] = [];
  for (const node of nodes) {
    if (node.type !== 'ecoreFile') continue;
    const key = metamodelDedupeKey(node);
    if (seen.has(key)) continue;
    seen.add(key);
    inputs.push({
      id: node.id,
      fileName: typeof node.data?.fileName === 'string' ? node.data.fileName : node.id,
      fileContent: typeof node.data?.fileContent === 'string' ? node.data.fileContent : '',
    });
  }
  return inputs;
}

export function collectReactionInputs(
  nodes: Node[],
  edges: Edge[],
  codeByEdgeId: Record<string, string> = {},
): ReactionSpecInput[] {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const canonicalIds = canonicalMetamodelNodeIds(nodes);
  return edges
    .filter(e => e.type === 'reactions')
    .map(edge => {
      const stored = typeof edge.data?.code === 'string' ? edge.data.code : '';
      const code = codeByEdgeId[edge.id] || stored;
      return {
        id: edge.id,
        // Edges attached to a duplicate metamodel node count for the node that was kept.
        sourceId: canonicalIds.get(edge.source) ?? edge.source,
        targetId: canonicalIds.get(edge.target) ?? edge.target,
        sourceName: nodeDisplayName(byId.get(edge.source), 'source'),
        targetName: nodeDisplayName(byId.get(edge.target), 'target'),
        code,
      };
    });
}

function toCorrespondenceType(
  spec: ReactionSpecInput,
  parsed: ReactionFileMetrics,
  direction: 'one-way' | 'both-ways',
): CorrespondenceTypeMetrics {
  return {
    id: spec.id,
    sourceName: spec.sourceName,
    targetName: spec.targetName,
    reactionCount: parsed.reactionCount,
    routineCount: parsed.routineCount,
    correspondenceTypeCount: parsed.correspondenceTypeCount,
    correspondenceTypeKeys: parsed.correspondenceTypeKeys,
    linesOfCode: parsed.linesOfCode,
    direction,
    reactions: parsed.reactions,
  };
}

function pairKey(left: string, right: string): string {
  return left < right ? `${left}||${right}` : `${right}||${left}`;
}

function localNameOf(value: string): string {
  return (value.split('::').pop() || value).trim();
}

function toLowerSet(names: Iterable<string>): Set<string> {
  return new Set(
    [...names].map(name => localNameOf(name).toLowerCase()).filter(Boolean),
  );
}

function computeReactionDirections(reactions: ReactionSpecInput[]): {
  directionById: Map<string, 'one-way' | 'both-ways'>;
  oneWayReactionPairCount: number;
  bidirectionalReactionPairCount: number;
} {
  const directionById = new Map<string, 'one-way' | 'both-ways'>();
  const seenPairs = new Set<string>();
  let oneWayReactionPairCount = 0;
  let bidirectionalReactionPairCount = 0;

  for (const spec of reactions) {
    const reverse = reactions.some(other => other.sourceId === spec.targetId && other.targetId === spec.sourceId);
    directionById.set(spec.id, reverse ? 'both-ways' : 'one-way');
    const key = pairKey(spec.sourceId, spec.targetId);
    if (seenPairs.has(key)) continue;
    seenPairs.add(key);
    if (reverse) bidirectionalReactionPairCount += 1;
    else oneWayReactionPairCount += 1;
  }

  return { directionById, oneWayReactionPairCount, bidirectionalReactionPairCount };
}

type MetamodelWithId = EcoreMetamodelMetrics & { id: string };

/** A concrete or abstract class, identified by its metamodel and its path inside it. */
interface ClassEntry {
  key: string;
  className: string;
  packagePath: string;
  metamodel: MetamodelWithId;
  isAbstract: boolean;
}

/** A metamodel (or one package of it, when `path` is set) that a qualifier points to. */
interface QualifierTarget {
  metamodel: MetamodelWithId;
  path: string | null;
}

function classKeyOf(metamodelId: string, classId: string): string {
  return `${metamodelId}|${classId}`;
}

function normalizeUri(uri: string): string {
  const trimmed = uri.trim();
  let end = trimmed.length;
  while (end > 0 && trimmed[end - 1] === '/') end -= 1;
  return trimmed.slice(0, end);
}

function buildClassEntries(metamodels: MetamodelWithId[]): ClassEntry[] {
  return metamodels.flatMap(metamodel => metamodel.classes.map(cls => ({
    key: classKeyOf(metamodel.id, cls.id),
    className: cls.name,
    packagePath: cls.packagePath,
    metamodel,
    isAbstract: cls.isAbstract,
  })));
}

/** Finds the metamodels or packages a qualifier (`Alias`, `pkg`, `a::b`) stands for. */
function resolveQualifier(
  metamodels: MetamodelWithId[],
  qualifier: string,
  uri: string | undefined,
): QualifierTarget[] {
  if (uri) {
    const wanted = normalizeUri(uri);
    const byUri = metamodels.flatMap(metamodel => metamodel.packages
      .filter(pkg => pkg.nsURI && normalizeUri(pkg.nsURI) === wanted)
      .map(pkg => ({ metamodel, path: pkg.path })));
    if (byUri.length > 0) return byUri;
  }

  const wanted = (qualifier.split('::').pop() || qualifier).trim().toLowerCase();
  if (!wanted) return [];
  const targets: QualifierTarget[] = [];
  for (const metamodel of metamodels) {
    const byName = metamodel.packages.filter(pkg =>
      pkg.name.toLowerCase() === wanted || (pkg.nsPrefix !== '' && pkg.nsPrefix.toLowerCase() === wanted));
    if (byName.length > 0) targets.push(...byName.map(pkg => ({ metamodel, path: pkg.path })));
    else if (metamodel.name.toLowerCase() === wanted) targets.push({ metamodel, path: null });
  }
  return targets;
}

function classesOfTarget(entries: ClassEntry[], target: QualifierTarget, className: string): ClassEntry[] {
  return entries.filter(entry =>
    entry.metamodel.id === target.metamodel.id
    && entry.className === className
    && (target.path === null || entry.packagePath === target.path));
}

function narrowToMetamodel(targets: QualifierTarget[], metamodelIds: Array<string | null>): QualifierTarget[] {
  const wanted = new Set(metamodelIds.filter((id): id is string => id !== null));
  const narrowed = targets.filter(target => wanted.has(target.metamodel.id));
  return narrowed.length > 0 ? narrowed : targets;
}

/**
 * The classes a reactions file refers to, credited only to the metamodel each qualifier
 * resolves to. A qualifier that fits several metamodels is settled by the file header
 * (`in reaction to changes in` / `execute actions in`) and by the reaction's own endpoints;
 * if that still leaves several, the reference is dropped rather than guessed.
 */
function resolveReactionClasses(
  spec: ReactionSpecInput,
  parsed: ReactionClassReferences,
  metamodels: MetamodelWithId[],
  entries: ClassEntry[],
): Set<string> {
  const keys = new Set<string>();
  for (const ref of parsed.references) {
    const alias = ref.qualifier.split('::')[0];
    const uri = parsed.aliases.get(ref.qualifier) ?? parsed.aliases.get(alias);
    let targets = resolveQualifier(metamodels, ref.qualifier, uri)
      .filter(target => classesOfTarget(entries, target, ref.className).length > 0);

    if (targets.length > 1) {
      if (alias === parsed.sourceAlias) targets = narrowToMetamodel(targets, [spec.sourceId]);
      else if (alias === parsed.targetAlias) targets = narrowToMetamodel(targets, [spec.targetId]);
    }
    if (targets.length > 1) targets = narrowToMetamodel(targets, [spec.sourceId, spec.targetId]);
    if (new Set(targets.map(target => target.metamodel.id)).size > 1) continue;

    for (const target of targets) {
      classesOfTarget(entries, target, ref.className).forEach(entry => keys.add(entry.key));
    }
  }
  return keys;
}

/**
 * The classes an OCL rule is about. A qualified context (`library::Book`) is matched like a
 * reaction qualifier; an unqualified one, or a qualifier that matches nothing, falls back to
 * the class name, which OCL cannot tell apart between metamodels.
 */
function resolveOclContext(
  rule: OclConstraint,
  metamodels: MetamodelWithId[],
  entries: ClassEntry[],
): ClassEntry[] {
  if (!rule.contextClass) return [];
  if (rule.contextQualifier) {
    const targets = resolveQualifier(metamodels, rule.contextQualifier, undefined);
    const qualified = targets.flatMap(target => classesOfTarget(entries, target, rule.contextClass));
    if (qualified.length > 0) return qualified;
  }
  return entries.filter(entry => entry.className === rule.contextClass);
}

/** Class name, prefixed with its subpackage when the same name exists in another package. */
function packageQualifiedName(packagePath: string, className: string): string {
  return packagePath ? `${packagePath}/${className}` : className;
}

function classLabeler(entries: ClassEntry[]): (entry: ClassEntry) => string {
  const counts = new Map<string, number>();
  for (const entry of entries) counts.set(entry.className, (counts.get(entry.className) ?? 0) + 1);
  return entry => ((counts.get(entry.className) ?? 0) > 1
    ? `${entry.metamodel.name}::${packageQualifiedName(entry.packagePath, entry.className)}`
    : entry.className);
}

function computeConsistencyInsights(
  metamodels: MetamodelWithId[],
  reactionClassKeys: Set<string>[],
  oclContent: string,
): {
  detectOnlyClassNames: string[];
  repairOnlyClassNames: string[];
  detectAndRepairClassNames: string[];
  unprotectedClassNames: string[];
  unprotectedAssociationNames: string[];
  oclRulesWithoutReaction: OclReactionGapItem[];
  hotspotClasses: ClassHotspot[];
} {
  const entries = buildClassEntries(metamodels);
  const labelOf = classLabeler(entries);
  const oclRules = parseOclConstraints(oclContent);
  const oclMentionSet = toLowerSet(extractOclMentionedNames(oclContent));
  const ruleClassKeys = oclRules.map(rule => new Set(resolveOclContext(rule, metamodels, entries).map(e => e.key)));
  const oclContextKeys = new Set(ruleClassKeys.flatMap(keys => [...keys]));
  const reactionKeys = new Set(reactionClassKeys.flatMap(keys => [...keys]));

  const detectOnlyClassNames: string[] = [];
  const repairOnlyClassNames: string[] = [];
  const detectAndRepairClassNames: string[] = [];
  const unprotectedClassNames: string[] = [];
  const unprotectedKeys = new Set<string>();

  for (const entry of entries) {
    if (entry.isAbstract) continue;
    const inOcl = oclContextKeys.has(entry.key);
    const inReaction = reactionKeys.has(entry.key);
    if (inOcl && inReaction) detectAndRepairClassNames.push(labelOf(entry));
    else if (inOcl) detectOnlyClassNames.push(labelOf(entry));
    else if (inReaction) repairOnlyClassNames.push(labelOf(entry));
    else {
      unprotectedClassNames.push(labelOf(entry));
      unprotectedKeys.add(entry.key);
    }
  }

  const unprotectedAssociationNames = metamodels.flatMap(mm => mm.associations.map(assoc => ({ mm, assoc })))
    .filter(({ mm, assoc }) =>
      !oclMentionSet.has(assoc.name.toLowerCase()) && unprotectedKeys.has(classKeyOf(mm.id, assoc.ownerId)))
    .map(({ assoc }) => `${assoc.ownerClass}.${assoc.name}`);

  const oclRulesWithoutReaction = oclRules.filter((rule, index) =>
    rule.contextClass.length > 0 && ![...ruleClassKeys[index]].some(key => reactionKeys.has(key)));

  const hotspotClasses = entries
    .map(entry => {
      const oclRuleCount = ruleClassKeys.filter(keys => keys.has(entry.key)).length;
      const reactionFileCount = reactionClassKeys.filter(keys => keys.has(entry.key)).length;
      return {
        className: entry.className,
        metamodel: entry.metamodel.name,
        oclRuleCount,
        reactionFileCount,
        score: oclRuleCount + reactionFileCount,
      };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.className.localeCompare(b.className) || a.metamodel.localeCompare(b.metamodel))
    .slice(0, 10);

  return {
    detectOnlyClassNames,
    repairOnlyClassNames,
    detectAndRepairClassNames,
    unprotectedClassNames,
    unprotectedAssociationNames,
    oclRulesWithoutReaction: oclRulesWithoutReaction.map(({ name, contextClass }) => ({ name, contextClass })),
    hotspotClasses,
  };
}

function computeMetamodelLinks(
  metamodels: MetamodelWithId[],
  reactions: ReactionSpecInput[],
  reactionClassKeys: Set<string>[],
): MetamodelLinkMetrics[] {
  const fanIn = new Map<string, number>();
  const fanOut = new Map<string, number>();
  for (const mm of metamodels) {
    fanIn.set(mm.id, 0);
    fanOut.set(mm.id, 0);
  }
  // Edges whose endpoint is not a known metamodel node cannot link anything.
  for (const spec of reactions) {
    if (fanOut.has(spec.sourceId)) fanOut.set(spec.sourceId, (fanOut.get(spec.sourceId) ?? 0) + 1);
    if (fanIn.has(spec.targetId)) fanIn.set(spec.targetId, (fanIn.get(spec.targetId) ?? 0) + 1);
  }
  const referenced = new Set(reactionClassKeys.flatMap(keys => [...keys]));

  return metamodels.map(mm => {
    const concrete = mm.classes.filter(cls => !cls.isAbstract);
    const nameCounts = new Map<string, number>();
    for (const cls of concrete) nameCounts.set(cls.name, (nameCounts.get(cls.name) ?? 0) + 1);
    const uncovered = concrete
      .filter(cls => !referenced.has(classKeyOf(mm.id, cls.id)))
      .map(cls => ((nameCounts.get(cls.name) ?? 0) > 1 ? packageQualifiedName(cls.packagePath, cls.name) : cls.name));
    const inCount = fanIn.get(mm.id) ?? 0;
    const outCount = fanOut.get(mm.id) ?? 0;
    return {
      id: mm.id,
      name: mm.name,
      fanIn: inCount,
      fanOut: outCount,
      isOrphan: inCount + outCount === 0,
      concreteClassCount: concrete.length,
      coveredConcreteClassCount: concrete.length - uncovered.length,
      uncoveredClassNames: uncovered,
    };
  });
}

export function computeMethodologistMetrics(input: MethodologistMetricsInput): MethodologistMetrics {
  const metamodels = input.metamodels.map(mm => {
    const parsed = parseEcoreMetamodelMetrics(mm.fileContent, fileBaseName(mm.fileName));
    return { ...parsed, id: mm.id, name: fileBaseName(mm.fileName) || parsed.name };
  });

  const directions = computeReactionDirections(input.reactions);
  const correspondenceTypes = input.reactions.map(spec =>
    toCorrespondenceType(
      spec,
      parseReactionFileMetrics(spec.code),
      directions.directionById.get(spec.id) ?? 'one-way',
    ),
  );

  const uniqueViewpoints = new Set(
    input.viewTypes.map(vt => vt.label.trim()).filter(Boolean),
  );

  const classEntries = buildClassEntries(metamodels);
  const reactionClassKeys = input.reactions.map(spec =>
    resolveReactionClasses(spec, extractReactionClassReferences(spec.code), metamodels, classEntries));
  const metamodelLinks = computeMetamodelLinks(metamodels, input.reactions, reactionClassKeys);
  const reactionLocs = correspondenceTypes.flatMap(ct => ct.reactions.map(r => r.linesOfCode));
  const coveredConcreteClassCount = metamodelLinks.reduce((s, l) => s + l.coveredConcreteClassCount, 0);
  const classCount = metamodels.reduce((s, m) => s + m.classCount, 0);
  const concreteClassCount = metamodels.reduce((s, m) => s + m.concreteClassCount, 0);
  const attributesTotal = metamodels.reduce((s, m) => s + m.attributesTotal, 0);
  const referencesTotal = metamodels.reduce((s, m) => s + m.referencesTotal, 0);
  const containmentReferences = metamodels.reduce((s, m) => s + m.containmentReferences, 0);
  const packageCount = metamodels.reduce((s, m) => s + m.packageCount, 0);
  const correspondenceTypeCount = new Set(correspondenceTypes.flatMap(c => c.correspondenceTypeKeys)).size;
  const reactionCount = correspondenceTypes.reduce((s, c) => s + c.reactionCount, 0);
  const oclConstraintCount = countOclConstraints(input.oclContent);
  const viewTypeCount = input.viewTypes.length;
  const viewProjection = computeViewProjection(metamodels, input.viewTypes);
  const viewTypePairCount = unorderedPairCount(viewTypeCount);
  const avgLocPerReaction = reactionLocs.length === 0
    ? 0
    : reactionLocs.reduce((s, n) => s + n, 0) / reactionLocs.length;
  const nocValues = metamodels.map(m => m.nocMax);
  const reactionTotalLoc = correspondenceTypes.reduce((s, c) => s + c.linesOfCode, 0);
  const associationCount = metamodels.reduce((s, m) => s + m.associations.length, 0);
  const consistency = computeConsistencyInsights(metamodels, reactionClassKeys, input.oclContent);

  return {
    metamodels,
    classCount,
    attributesTotal,
    referencesTotal,
    containmentReferences,
    nonContainmentReferences: metamodels.reduce((s, m) => s + m.nonContainmentReferences, 0),
    enumCount: metamodels.reduce((s, m) => s + m.enumCount, 0),
    enumLiteralCount: metamodels.reduce((s, m) => s + m.enumLiteralCount, 0),
    packageCount,
    abstractClassCount: metamodels.reduce((s, m) => s + m.abstractClassCount, 0),
    concreteClassCount,
    viewTypeCount,
    viewpointCount: uniqueViewpoints.size,
    singleViewTypeCount: input.viewTypes.filter(vt => vt.scope === 'single').length,
    multiViewTypeCount: input.viewTypes.filter(vt => vt.scope === 'multi').length,
    correspondenceTypeCount,
    correspondenceTypes,
    reactionCount,
    oclConstraintCount,
    operationsTotal: metamodels.reduce((s, m) => s + m.operationsTotal, 0),
    nocMax: nocValues.length === 0 ? 0 : Math.max(0, ...nocValues),
    nocAvg: metamodels.length === 0
      ? 0
      : metamodels.reduce((s, m) => s + m.nocAvg, 0) / metamodels.length,
    containmentHeightMax: metamodels.reduce((s, m) => Math.max(s, m.containmentHeightMax), 0),
    crossPackageReferences: metamodels.reduce((s, m) => s + m.crossPackageReferences, 0),
    avgLocPerReaction,
    orphanMetamodelCount: metamodelLinks.filter(l => l.isOrphan).length,
    linkedMetamodelCount: metamodelLinks.filter(l => !l.isOrphan).length,
    coveredConcreteClassCount,
    correspondenceCoveragePercent: concreteClassCount === 0
      ? 0
      : Math.round((coveredConcreteClassCount / concreteClassCount) * 100),
    metamodelLinks,
    attributesPerClass: safeRatio(attributesTotal, classCount),
    referencesPerClass: safeRatio(referencesTotal, classCount),
    containmentRatio: safeRatio(containmentReferences, referencesTotal),
    classesCoveredByViews: viewProjection.uniqueClassCount,
    classesCoveredByViewsRatio: safeRatio(viewProjection.uniqueClassCount, classCount),
    viewClassesAggregated: viewProjection.aggregatedClassCount,
    reactionsPerCorrespondenceType: safeRatio(reactionCount, correspondenceTypeCount),
    reactionComplexityRatio: avgLocPerReaction,
    constraintDensity: safeRatio(oclConstraintCount, classCount),
    metamodelToViewRatio: safeRatio(classCount, viewProjection.aggregatedClassCount),
    viewTypePairCount,
    correspondenceToViewPairRatio: safeRatio(correspondenceTypeCount, viewTypePairCount),
    modularizationRatio: safeRatio(classCount, packageCount),
    associationCount,
    reactionTotalLoc,
    oneWayReactionPairCount: directions.oneWayReactionPairCount,
    bidirectionalReactionPairCount: directions.bidirectionalReactionPairCount,
    detectOnlyClassNames: consistency.detectOnlyClassNames,
    repairOnlyClassNames: consistency.repairOnlyClassNames,
    detectAndRepairClassNames: consistency.detectAndRepairClassNames,
    unprotectedClassNames: consistency.unprotectedClassNames,
    unprotectedAssociationNames: consistency.unprotectedAssociationNames,
    oclRulesWithoutReaction: consistency.oclRulesWithoutReaction,
    hotspotClasses: consistency.hotspotClasses,
  };
}
