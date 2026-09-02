import type { Edge, Node } from 'reactflow';
import type { ViewType } from '../hooks/useViewTypes';
import {
  countXmiModelElements,
  parseEcoreMetamodelMetrics,
  type EcoreMetamodelMetrics,
} from './ecoreMetrics';
import {
  countOclConstraints,
  extractMentionedClassNames,
  extractOclMentionedNames,
  parseOclConstraints,
  parseReactionFileMetrics,
  type ReactionBlockMetrics,
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

export interface InstanceModelInput {
  name: string;
  content: string;
}

export interface CorrespondenceInstanceInput {
  name: string;
  content: string;
}

export interface MethodologistMetricsInput {
  metamodels: MetamodelFileInput[];
  reactions: ReactionSpecInput[];
  viewTypes: ViewType[];
  oclContent: string;
  instanceModels?: InstanceModelInput[];
  correspondenceInstances?: CorrespondenceInstanceInput[];
}

export interface CorrespondenceTypeMetrics {
  id: string;
  sourceName: string;
  targetName: string;
  reactionCount: number;
  routineCount: number;
  correspondenceTypeCount: number;
  linesOfCode: number;
  direction: 'one-way' | 'both-ways';
  reactions: ReactionBlockMetrics[];
}

export interface InstanceModelMetrics {
  name: string;
  elementCount: number;
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
  instanceModels: InstanceModelMetrics[];
  instanceElementTotal: number;
  correspondenceInstanceCount: number;
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
  viewElementDensity: number;
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
        unique.add(`${mm.id}::${cls.qualifiedName}`);
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
  return edges
    .filter(e => e.type === 'reactions')
    .map(edge => {
      const stored = typeof edge.data?.code === 'string' ? edge.data.code : '';
      const code = codeByEdgeId[edge.id] || stored;
      return {
        id: edge.id,
        sourceId: edge.source,
        targetId: edge.target,
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
  const declaredTypes = Math.max(parsed.correspondenceTypeCount, 1);
  return {
    id: spec.id,
    sourceName: spec.sourceName,
    targetName: spec.targetName,
    reactionCount: parsed.reactionCount,
    routineCount: parsed.routineCount,
    correspondenceTypeCount: declaredTypes,
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

function computeConsistencyInsights(
  metamodels: Array<EcoreMetamodelMetrics & { id: string }>,
  reactions: ReactionSpecInput[],
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
  const oclRules = parseOclConstraints(oclContent);
  const oclContextSet = toLowerSet(oclRules.map(rule => rule.contextClass));
  const oclMentionSet = toLowerSet(extractOclMentionedNames(oclContent));
  const reactionMentionSets = reactions.map(spec => ({
    spec,
    names: toLowerSet(extractMentionedClassNames(spec.code)),
  }));
  const reactionClassSet = new Set<string>();
  for (const entry of reactionMentionSets) {
    entry.names.forEach(name => reactionClassSet.add(name));
  }

  const knownClasses = metamodels.flatMap(mm => mm.classes.map(cls => ({
    className: cls.name,
    key: cls.name.toLowerCase(),
    metamodel: mm.name,
    isAbstract: cls.isAbstract,
  })));

  const detectOnlyClassNames: string[] = [];
  const repairOnlyClassNames: string[] = [];
  const detectAndRepairClassNames: string[] = [];
  const unprotectedClassNames: string[] = [];

  for (const cls of knownClasses) {
    if (cls.isAbstract) continue;
    const inOcl = oclContextSet.has(cls.key);
    const inReaction = reactionClassSet.has(cls.key);
    if (inOcl && inReaction) detectAndRepairClassNames.push(cls.className);
    else if (inOcl) detectOnlyClassNames.push(cls.className);
    else if (inReaction) repairOnlyClassNames.push(cls.className);
    else unprotectedClassNames.push(cls.className);
  }

  const unprotectedClassSet = new Set(unprotectedClassNames.map(name => name.toLowerCase()));
  const unprotectedAssociationNames = metamodels.flatMap(mm => mm.associations)
    .filter(assoc => {
      const ownerKey = assoc.ownerClass.toLowerCase();
      const namedInOcl = oclMentionSet.has(assoc.name.toLowerCase());
      return !namedInOcl && unprotectedClassSet.has(ownerKey);
    })
    .map(assoc => `${assoc.ownerClass}.${assoc.name}`);

  const oclRulesWithoutReaction = oclRules.filter(rule => {
    const key = localNameOf(rule.contextClass).toLowerCase();
    return key.length > 0 && !reactionClassSet.has(key);
  });

  const hotspotClasses = knownClasses
    .map(cls => {
      const oclRuleCount = oclRules.filter(rule => localNameOf(rule.contextClass).toLowerCase() === cls.key).length;
      const reactionFileCount = reactionMentionSets.filter(entry => entry.names.has(cls.key)).length;
      return {
        className: cls.className,
        metamodel: cls.metamodel,
        oclRuleCount,
        reactionFileCount,
        score: oclRuleCount + reactionFileCount,
      };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.className.localeCompare(b.className))
    .slice(0, 10);

  return {
    detectOnlyClassNames,
    repairOnlyClassNames,
    detectAndRepairClassNames,
    unprotectedClassNames,
    unprotectedAssociationNames,
    oclRulesWithoutReaction,
    hotspotClasses,
  };
}

function mentionedNameSet(code: string): Set<string> {
  return new Set(extractMentionedClassNames(code).map(name => name.toLowerCase()));
}

function computeMetamodelLinks(
  metamodels: Array<EcoreMetamodelMetrics & { id: string }>,
  reactions: ReactionSpecInput[],
): MetamodelLinkMetrics[] {
  const fanIn = new Map<string, number>();
  const fanOut = new Map<string, number>();
  const mentioned = new Map<string, Set<string>>();

  for (const mm of metamodels) {
    fanIn.set(mm.id, 0);
    fanOut.set(mm.id, 0);
    mentioned.set(mm.id, new Set());
  }

  for (const spec of reactions) {
    fanOut.set(spec.sourceId, (fanOut.get(spec.sourceId) ?? 0) + 1);
    fanIn.set(spec.targetId, (fanIn.get(spec.targetId) ?? 0) + 1);
    const names = mentionedNameSet(spec.code);
    for (const id of [spec.sourceId, spec.targetId]) {
      const set = mentioned.get(id);
      if (!set) continue;
      names.forEach(name => set.add(name));
    }
  }

  return metamodels.map(mm => {
    const names = mentioned.get(mm.id) ?? new Set<string>();
    const concrete = mm.classes.filter(cls => !cls.isAbstract);
    const uncovered = concrete
      .filter(cls => !names.has(cls.name.toLowerCase()))
      .map(cls => cls.name);
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

  const instanceModels = (input.instanceModels ?? []).map(model => ({
    name: model.name,
    elementCount: countXmiModelElements(model.content),
  }));

  const correspondenceInstanceCount = (input.correspondenceInstances ?? [])
    .reduce((sum, model) => sum + countXmiModelElements(model.content), 0);

  const uniqueViewpoints = new Set(
    input.viewTypes.map(vt => vt.label.trim()).filter(Boolean),
  );

  const metamodelLinks = computeMetamodelLinks(metamodels, input.reactions);
  const reactionLocs = correspondenceTypes.flatMap(ct => ct.reactions.map(r => r.linesOfCode));
  const coveredConcreteClassCount = metamodelLinks.reduce((s, l) => s + l.coveredConcreteClassCount, 0);
  const classCount = metamodels.reduce((s, m) => s + m.classCount, 0);
  const concreteClassCount = metamodels.reduce((s, m) => s + m.concreteClassCount, 0);
  const attributesTotal = metamodels.reduce((s, m) => s + m.attributesTotal, 0);
  const referencesTotal = metamodels.reduce((s, m) => s + m.referencesTotal, 0);
  const containmentReferences = metamodels.reduce((s, m) => s + m.containmentReferences, 0);
  const packageCount = metamodels.reduce((s, m) => s + m.packageCount, 0);
  const correspondenceTypeCount = correspondenceTypes.reduce((s, c) => s + c.correspondenceTypeCount, 0);
  const reactionCount = correspondenceTypes.reduce((s, c) => s + c.reactionCount, 0);
  const oclConstraintCount = countOclConstraints(input.oclContent);
  const viewTypeCount = input.viewTypes.length;
  const viewProjection = computeViewProjection(metamodels, input.viewTypes);
  const viewTypePairCount = unorderedPairCount(viewTypeCount);
  const instanceElementTotal = instanceModels.reduce((s, m) => s + m.elementCount, 0);
  const avgLocPerReaction = reactionLocs.length === 0
    ? 0
    : reactionLocs.reduce((s, n) => s + n, 0) / reactionLocs.length;
  const nocValues = metamodels.map(m => m.nocMax);
  const reactionTotalLoc = correspondenceTypes.reduce((s, c) => s + c.linesOfCode, 0);
  const associationCount = metamodels.reduce((s, m) => s + m.associations.length, 0);
  const consistency = computeConsistencyInsights(metamodels, input.reactions, input.oclContent);

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
    instanceModels,
    instanceElementTotal,
    correspondenceInstanceCount,
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
    viewElementDensity: safeRatio(instanceElementTotal, viewTypeCount),
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
