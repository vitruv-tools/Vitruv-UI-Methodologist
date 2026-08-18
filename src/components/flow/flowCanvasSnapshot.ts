import { Edge, Node } from 'reactflow';
import { MetaModelRelationRequest } from '../../services/api';
import type { EditableFineGranularMetaModelRelation } from '../../types/FineGranularMetaModelRelation';
import { WorkspaceSnapshot } from '../../types/workspace';
import { getMetaModelSourceId } from './flowCanvasNodeLookup';
import { toWireReactionFileId } from '../../utils/workspaceSnapshotUtils';

const relationKey = (sourceId: number, targetId: number): string =>
  `${sourceId}->${targetId}`;

const finePairKey = (sourceId: string, targetId: string): string =>
  `${sourceId}->${targetId}`;

function resolveModelToSourceId(nodes: Node[], model: string): number | undefined {
  if (!model) return undefined;
  const node = nodes.find(n =>
    n.type === 'ecoreFile' && (
      n.data?.nsUri === model
      || n.data?.fileName === model
      || (typeof n.data?.fileName === 'string'
        && n.data.fileName.replace(/\.ecore$/i, '') === model)
    ),
  );
  if (!node) return undefined;
  return getMetaModelSourceId(nodes, node.id);
}

function mergeFineRelations(
  a: EditableFineGranularMetaModelRelation[] | undefined,
  b: EditableFineGranularMetaModelRelation[] | undefined,
): EditableFineGranularMetaModelRelation[] | undefined {
  if (!a?.length && !b?.length) return undefined;
  const byPair = new Map<string, EditableFineGranularMetaModelRelation>();
  for (const fg of [...(a ?? []), ...(b ?? [])]) {
    const key = finePairKey(fg.sourceId, fg.targetId);
    const existing = byPair.get(key);
    if (!existing) {
      byPair.set(key, { ...fg });
      continue;
    }
    const incomingHasConfig = Boolean(
      fg.lowCodeReactionRequestBase && Object.keys(fg.lowCodeReactionRequestBase).length > 0,
    );
    const existingHasConfig = Boolean(
      existing.lowCodeReactionRequestBase && Object.keys(existing.lowCodeReactionRequestBase).length > 0,
    );
    byPair.set(key, {
      ...existing,
      ...fg,
      id: fg.id ?? existing.id,
      reactionFileStorageId: fg.reactionFileStorageId ?? existing.reactionFileStorageId,
      lowCodeReactionRequestBase: incomingHasConfig
        ? { ...existing.lowCodeReactionRequestBase, ...fg.lowCodeReactionRequestBase }
        : existingHasConfig
          ? existing.lowCodeReactionRequestBase
          : fg.lowCodeReactionRequestBase ?? existing.lowCodeReactionRequestBase,
    });
  }
  return Array.from(byPair.values());
}

function upsertRelation(
  byKey: Map<string, MetaModelRelationRequest>,
  req: MetaModelRelationRequest,
): void {
  const key = relationKey(req.sourceId, req.targetId);
  const existing = byKey.get(key);
  if (!existing) {
    byKey.set(key, {
      sourceId: req.sourceId,
      targetId: req.targetId,
      reactionFileId: req.reactionFileId,
      ...(req.fineGranularMetaModelRelationSet?.length
        ? { fineGranularMetaModelRelationSet: [...req.fineGranularMetaModelRelationSet] }
        : {}),
    });
    return;
  }
  if (req.reactionFileId) existing.reactionFileId = req.reactionFileId;
  const merged = mergeFineRelations(
    existing.fineGranularMetaModelRelationSet,
    req.fineGranularMetaModelRelationSet,
  );
  if (merged?.length) existing.fineGranularMetaModelRelationSet = merged;
}

/**
 * Reduces the canvas to what the backend persists: the set of metamodels on it
 * and the reaction relations between them. Relations whose endpoints have no
 * resolvable metamodel id are dropped rather than sent as partial records.
 *
 * Fine-granular reaction edges (`type: 'fine-granular-reaction'`) are grouped
 * by backend source/target ids into the parent coarse relation's
 * `fineGranularMetaModelRelationSet`. Optional `storeSnapshot` overlays Low Code
 * form data and fine-only pairs that are not currently drawn on the canvas
 * (e.g. after collapsing Reactions mode).
 */
export function buildWorkspaceSnapshot(
  nodes: Node[],
  edges: Edge[],
  storeSnapshot?: WorkspaceSnapshot | null,
): WorkspaceSnapshot {
  const metaModelIds = Array.from(
    new Set(
      nodes
        .filter(node => node.type === 'ecoreFile')
        .map(node => getMetaModelSourceId(nodes, node.id))
        .filter((value): value is number => typeof value === 'number'),
    ),
  );

  const byKey = new Map<string, MetaModelRelationRequest>();

  for (const edge of edges) {
    if (edge.type !== 'reactions') continue;
    const sourceId = getMetaModelSourceId(nodes, edge.source);
    const targetId = getMetaModelSourceId(nodes, edge.target);
    if (typeof sourceId !== 'number' || typeof targetId !== 'number') continue;
    const reactionFileId = toWireReactionFileId(edge.data?.reactionFileId);
    upsertRelation(byKey, { sourceId, targetId, reactionFileId });
  }

  for (const edge of edges) {
    if (edge.type !== 'fine-granular-reaction') continue;
    const ecore = edge.data?.ecore;
    if (!ecore) continue;
    const sourceId = resolveModelToSourceId(nodes, ecore.fromModel as string);
    const targetId = resolveModelToSourceId(nodes, ecore.toModel as string);
    if (typeof sourceId !== 'number' || typeof targetId !== 'number') continue;
    const persistedFgId = toWireReactionFileId(edge.data?.fineRelationId);
    const generatedFileId = toWireReactionFileId(edge.data?.reactionFileId);
    upsertRelation(byKey, {
      sourceId,
      targetId,
      // Generated Low Code files live on the fine row, not the parent coarse relation.
      reactionFileId: null,
      fineGranularMetaModelRelationSet: [{
        id: persistedFgId,
        sourceId: ecore.eObjectSourceId,
        targetId: ecore.eObjectTargetId,
        ...(generatedFileId != null ? { reactionFileStorageId: generatedFileId } : {}),
        ...(edge.data?.lowCodeReactionRequestBase
          ? { lowCodeReactionRequestBase: edge.data.lowCodeReactionRequestBase }
          : {}),
      }],
    });
  }

  if (storeSnapshot?.metaModelRelationRequests) {
    for (const rel of storeSnapshot.metaModelRelationRequests) {
      const key = relationKey(rel.sourceId, rel.targetId);
      const existing = byKey.get(key);
      const fines = rel.fineGranularMetaModelRelationSet;
      if (existing) {
        upsertRelation(byKey, rel);
      } else if (fines?.length) {
        upsertRelation(byKey, {
          sourceId: rel.sourceId,
          targetId: rel.targetId,
          reactionFileId: toWireReactionFileId(rel.reactionFileId),
          fineGranularMetaModelRelationSet: fines,
        });
      }
    }
  }

  return { metaModelIds, metaModelRelationRequests: Array.from(byKey.values()) };
}
