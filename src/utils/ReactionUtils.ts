/**
 * Coarse-grained reaction helpers.
 *
 * Utilities for managing coarse (meta-model-level) reaction relations
 * in the VsumDetails store, and for inferring reaction file ids for
 * fine-granular edges.
 */

import type { Node } from 'reactflow';
import { useProjectStore, type ReactionFile } from '../store/Project';
import { ActiveVsumDetails, hasActiveVsumDetailsStore } from '../store/ActiveVsumDetails';
import { extractNsUriFromEcore } from './EcoreIdentifiers';

/**
 * Register reaction files from loaded coarse relations into the
 * project store. Call this after loading VSUM details / canvas edges.
 */
export function registerReactionFilesFromRelations(
  relations: Array<{
    sourceId: number;
    targetId: number;
    reactionFileId?: number | null;
    reactionFileStorageId?: number | null;
  }>,
  idToModel: Map<number, string>,
): void {
  const files = new Set<ReactionFile>();

  for (const rel of relations) {
    const fileId = rel.reactionFileId ?? rel.reactionFileStorageId;
    if (typeof fileId !== 'number' || fileId <= 0) continue;

    const fromModel = idToModel.get(rel.sourceId);
    const toModel = idToModel.get(rel.targetId);
    if (!fromModel || !toModel) continue;

    files.add({ fromModel, toModel, id: fileId });
  }

  if (files.size > 0) {
    useProjectStore.getState().setReactionFiles(files);
  }
}

function positiveFileId(value: unknown): number | undefined {
  if (typeof value !== 'number' || value <= 0) return undefined;
  return value;
}

function fileIdFromCoarseRelation(fromModel: string, toModel: string): number | undefined {
  if (!hasActiveVsumDetailsStore()) return undefined;
  try {
    const active = new ActiveVsumDetails();
    const sourceBackendId = active.getBackendMetaModelId(fromModel);
    const targetBackendId = active.getBackendMetaModelId(toModel);
    if (sourceBackendId === undefined || targetBackendId === undefined) return undefined;
    const rel = active.getMetaModelRelation({
      sourceId: sourceBackendId,
      targetId: targetBackendId,
    });
    return positiveFileId(rel?.reactionFileId ?? rel?.reactionFileStorageId);
  } catch {
    return undefined;
  }
}

function fileIdFromReactionRegistry(fromModel: string, toModel: string): number | undefined {
  for (const rf of useProjectStore.getState().reactionFiles) {
    if (rf.fromModel === fromModel && rf.toModel === toModel) return rf.id;
  }
  return undefined;
}

function inferReactionFileIdFromModels(
  ecore?: { fromModel: string; toModel: string },
): number | undefined {
  if (!ecore) return undefined;
  return fileIdFromCoarseRelation(ecore.fromModel, ecore.toModel)
    ?? fileIdFromReactionRegistry(ecore.fromModel, ecore.toModel);
}

/**
 * Infer the reaction file id for a fine-granular reaction edge.
 *
 * Lookup order:
 *   1. `edge.data.reactionFileId` (explicit on the edge)
 *   2. Parent coarse relation in VsumDetails store
 *   3. `reactionFiles` registry in the project store (by model pair)
 *
 * Returns `undefined` if no file can be inferred.
 */
export function tryInferReactionFileIdForFineGranularReactionEdge(edge: {
  data?: {
    reactionFileId?: number;
    ecore?: { fromModel: string; toModel: string };
  };
}): number | undefined {
  return positiveFileId(edge.data?.reactionFileId)
    ?? inferReactionFileIdFromModels(edge.data?.ecore);
}

/**
 * Ensure a coarse relation exists in the store for the given model pair.
 * If it doesn't exist, creates one with a zero reaction file id.
 *
 * Returns the backend source/target ids, or `null` if they can't be resolved.
 */
export function ensureCoarseRelation(
  fromModel: string,
  toModel: string,
): { sourceId: number; targetId: number } | null {
  if (!hasActiveVsumDetailsStore()) return null;

  try {
    const active = new ActiveVsumDetails();
    const sourceBackendId = active.getBackendMetaModelId(fromModel);
    const targetBackendId = active.getBackendMetaModelId(toModel);
    if (sourceBackendId === undefined || targetBackendId === undefined) return null;

    const existing = active.getMetaModelRelation({
      sourceId: sourceBackendId,
      targetId: targetBackendId,
    });

    if (!existing) {
      active.addMetaModelRelation({
        id: 0,
        sourceId: sourceBackendId,
        targetId: targetBackendId,
        reactionFileId: null,
        reactionFileStorageId: null,
        fineGranularMetaModelRelationSet: [],
      });
      active.saveToStore();
    }

    return { sourceId: sourceBackendId, targetId: targetBackendId };
  } catch {
    return null;
  }
}

/**
 * Build a reverse map from backend meta-model sourceId → model nsURI.
 */
export function buildBackendIdToModelMap(
  identifiersToBackendId: Map<string, number>,
): Map<number, string> {
  const result = new Map<number, string>();
  for (const [key, value] of identifiersToBackendId) {
    if (!result.has(value)) {
      result.set(value, key);
    }
  }
  return result;
}

function nodeBackendSourceId(node: Node): number | undefined {
  const sourceId = node.data?.metaModelSourceId ?? node.data?.metaModelId;
  if (typeof sourceId !== 'number') return undefined;
  return sourceId;
}

function nodeNsUri(node: Node): string | undefined {
  if (typeof node.data?.nsUri === 'string' && node.data.nsUri) return node.data.nsUri;
  if (typeof node.data?.fileContent !== 'string') return undefined;
  return extractNsUriFromEcore(node.data.fileContent) ?? undefined;
}

function stripEcoreExtension(fileName: string): string | undefined {
  const suffix = '.ecore';
  if (fileName.length <= suffix.length) return undefined;
  const tail = fileName.slice(-suffix.length);
  if (tail.toLowerCase() !== suffix) return undefined;
  return fileName.slice(0, -suffix.length);
}

function nodeFileName(node: Node): string | undefined {
  if (typeof node.data?.fileName !== 'string') return undefined;
  return node.data.fileName;
}

function addNodeIdentifiers(
  map: Map<string, number>,
  node: Node,
  sourceId: number,
): void {
  const nsUri = nodeNsUri(node);
  if (nsUri) map.set(nsUri, sourceId);
  const fileName = nodeFileName(node);
  if (!fileName) return;
  map.set(fileName, sourceId);
  const withoutExt = stripEcoreExtension(fileName);
  if (withoutExt) map.set(withoutExt, sourceId);
}

function addEcoreFileIdentifiers(map: Map<string, number>, node: Node): void {
  if (node.type !== 'ecoreFile') return;
  const sourceId = nodeBackendSourceId(node);
  if (sourceId === undefined) return;
  addNodeIdentifiers(map, node, sourceId);
}

/**
 * Build nsURI / file-name → backend meta-model sourceId from canvas ecoreFile nodes.
 */
export function collectIdentifierMapFromCanvasNodes(nodes: Node[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const node of nodes) addEcoreFileIdentifiers(map, node);
  return map;
}

/**
 * Merge canvas-derived identifiers into the active VsumDetails store.
 * No-op when no VSUM store is initialized.
 */
export function syncIdentifierMapFromCanvasNodes(nodes: Node[]): void {
  if (!hasActiveVsumDetailsStore()) return;
  try {
    const incoming = collectIdentifierMapFromCanvasNodes(nodes);
    if (incoming.size === 0) return;

    const active = new ActiveVsumDetails();
    const merged = new Map(active.get().identifiersToBackendMetaModelId);
    for (const [key, value] of incoming) merged.set(key, value);
    active.setIdentifiersToBackendMetaModelId(merged);
    active.saveToStore();
  } catch {
    // store may not be ready
  }
}
