import type { Edge, Node } from 'reactflow';
import type { ViewType } from '../hooks/useViewTypes';
import {
  countXmiModelElements,
  parseEcoreMetamodelMetrics,
  type EcoreMetamodelMetrics,
} from './ecoreMetrics';
import {
  countOclConstraints,
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
  reactions: ReactionBlockMetrics[];
}

export interface InstanceModelMetrics {
  name: string;
  elementCount: number;
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
        sourceName: nodeDisplayName(byId.get(edge.source), 'source'),
        targetName: nodeDisplayName(byId.get(edge.target), 'target'),
        code,
      };
    });
}

function toCorrespondenceType(
  spec: ReactionSpecInput,
  parsed: ReactionFileMetrics,
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
    reactions: parsed.reactions,
  };
}

export function computeMethodologistMetrics(input: MethodologistMetricsInput): MethodologistMetrics {
  const metamodels = input.metamodels.map(mm => {
    const parsed = parseEcoreMetamodelMetrics(mm.fileContent, fileBaseName(mm.fileName));
    return { ...parsed, name: fileBaseName(mm.fileName) || parsed.name };
  });

  const correspondenceTypes = input.reactions.map(spec =>
    toCorrespondenceType(spec, parseReactionFileMetrics(spec.code)),
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

  return {
    metamodels,
    classCount: metamodels.reduce((s, m) => s + m.classCount, 0),
    attributesTotal: metamodels.reduce((s, m) => s + m.attributesTotal, 0),
    referencesTotal: metamodels.reduce((s, m) => s + m.referencesTotal, 0),
    containmentReferences: metamodels.reduce((s, m) => s + m.containmentReferences, 0),
    nonContainmentReferences: metamodels.reduce((s, m) => s + m.nonContainmentReferences, 0),
    enumCount: metamodels.reduce((s, m) => s + m.enumCount, 0),
    enumLiteralCount: metamodels.reduce((s, m) => s + m.enumLiteralCount, 0),
    packageCount: metamodels.reduce((s, m) => s + m.packageCount, 0),
    abstractClassCount: metamodels.reduce((s, m) => s + m.abstractClassCount, 0),
    concreteClassCount: metamodels.reduce((s, m) => s + m.concreteClassCount, 0),
    viewTypeCount: input.viewTypes.length,
    viewpointCount: uniqueViewpoints.size,
    singleViewTypeCount: input.viewTypes.filter(vt => vt.scope === 'single').length,
    multiViewTypeCount: input.viewTypes.filter(vt => vt.scope === 'multi').length,
    correspondenceTypeCount: correspondenceTypes.reduce((s, c) => s + c.correspondenceTypeCount, 0),
    correspondenceTypes,
    reactionCount: correspondenceTypes.reduce((s, c) => s + c.reactionCount, 0),
    oclConstraintCount: countOclConstraints(input.oclContent),
    instanceModels,
    instanceElementTotal: instanceModels.reduce((s, m) => s + m.elementCount, 0),
    correspondenceInstanceCount,
  };
}
