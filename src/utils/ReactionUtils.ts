/**
 * Coarse-grained reaction helpers.
 *
 * Utilities for managing coarse (meta-model-level) reaction relations
 * in the VsumDetails store, and for inferring reaction file ids for
 * fine-granular edges.
 */

import { useProjectStore, type ReactionFile } from '../store/Project';
import { ActiveVsumDetails, hasActiveVsumDetailsStore } from '../store/ActiveVsumDetails';

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
  if (typeof edge.data?.reactionFileId === 'number' && edge.data.reactionFileId > 0) {
    return edge.data.reactionFileId;
  }

  const ecore = edge.data?.ecore;
  if (!ecore) return undefined;
  const { fromModel, toModel } = ecore;

  if (hasActiveVsumDetailsStore()) {
    try {
      const active = new ActiveVsumDetails();
      const sourceBackendId = active.getBackendMetaModelId(fromModel);
      const targetBackendId = active.getBackendMetaModelId(toModel);

      if (sourceBackendId !== undefined && targetBackendId !== undefined) {
        const rel = active.getMetaModelRelation({
          sourceId: sourceBackendId,
          targetId: targetBackendId,
        });
        const fileId = rel?.reactionFileId ?? rel?.reactionFileStorageId;
        if (typeof fileId === 'number' && fileId > 0) return fileId;
      }
    } catch {
      // fall through to registry lookup
    }
  }

  const { reactionFiles } = useProjectStore.getState();
  for (const rf of reactionFiles) {
    if (rf.fromModel === fromModel && rf.toModel === toModel) {
      return rf.id;
    }
  }

  return undefined;
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
