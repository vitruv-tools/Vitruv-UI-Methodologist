import { Edge, Node } from 'reactflow';
import { MetaModelRelationRequest } from '../../services/api';
import type { EditableFineGranularMetaModelRelation } from '../../types/FineGranularMetaModelRelation';
import { WorkspaceSnapshot } from '../../types/workspace';
import { getMetaModelSourceId } from './flowCanvasNodeLookup';
import { isFineReactionGraphVisible } from '../../utils/FineGranularReactionUtils';
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

function hasLowCodeConfig(
  base: EditableFineGranularMetaModelRelation['lowCodeReactionRequestBase'],
): boolean {
  return Boolean(base && Object.keys(base).length > 0);
}

function mergedLowCodeConfig(
  existing: EditableFineGranularMetaModelRelation,
  incoming: EditableFineGranularMetaModelRelation,
): EditableFineGranularMetaModelRelation['lowCodeReactionRequestBase'] {
  if (hasLowCodeConfig(incoming.lowCodeReactionRequestBase)) {
    return { ...existing.lowCodeReactionRequestBase, ...incoming.lowCodeReactionRequestBase };
  }
  if (hasLowCodeConfig(existing.lowCodeReactionRequestBase)) {
    return existing.lowCodeReactionRequestBase;
  }
  return incoming.lowCodeReactionRequestBase ?? existing.lowCodeReactionRequestBase;
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
    byPair.set(key, {
      ...existing,
      ...fg,
      id: fg.id ?? existing.id,
      reactionFileStorageId: fg.reactionFileStorageId ?? existing.reactionFileStorageId,
      lowCodeReactionRequestBase: mergedLowCodeConfig(existing, fg),
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
 * Overlay store ids / Low Code config onto canvas fines that still exist.
 * Does not introduce store-only pairs (those belong only to collapsed VSUM).
 */
function overlayStoreFinesOntoCanvas(
  canvasFines: EditableFineGranularMetaModelRelation[] | undefined,
  storeFines: EditableFineGranularMetaModelRelation[] | undefined,
): EditableFineGranularMetaModelRelation[] | undefined {
  if (!canvasFines?.length) return undefined;
  const merged = mergeFineRelations(canvasFines, storeFines);
  if (!merged?.length) return undefined;
  const canvasKeys = new Set(
    canvasFines.map(fg => finePairKey(fg.sourceId, fg.targetId)),
  );
  const restricted = merged.filter(fg => canvasKeys.has(finePairKey(fg.sourceId, fg.targetId)));
  return restricted.length ? restricted : undefined;
}

function collectMetaModelIds(nodes: Node[]): number[] {
  return Array.from(
    new Set(
      nodes
        .filter(node => node.type === 'ecoreFile')
        .map(node => getMetaModelSourceId(nodes, node.id))
        .filter((value): value is number => typeof value === 'number'),
    ),
  );
}

function collectReactionRelations(
  nodes: Node[],
  edges: Edge[],
  byKey: Map<string, MetaModelRelationRequest>,
): void {
  for (const edge of edges) {
    if (edge.type !== 'reactions') continue;
    const sourceId = getMetaModelSourceId(nodes, edge.source);
    const targetId = getMetaModelSourceId(nodes, edge.target);
    if (typeof sourceId !== 'number' || typeof targetId !== 'number') continue;
    upsertRelation(byKey, {
      sourceId,
      targetId,
      reactionFileId: toWireReactionFileId(edge.data?.reactionFileId),
    });
  }
}

function fineRelationFromEdge(edge: Edge): EditableFineGranularMetaModelRelation {
  const ecore = edge.data?.ecore;
  const generatedFileId = toWireReactionFileId(edge.data?.reactionFileId);
  const fine: EditableFineGranularMetaModelRelation = {
    id: toWireReactionFileId(edge.data?.fineRelationId),
    sourceId: ecore.eObjectSourceId,
    targetId: ecore.eObjectTargetId,
  };
  if (generatedFileId != null) fine.reactionFileStorageId = generatedFileId;
  if (edge.data?.lowCodeReactionRequestBase) {
    fine.lowCodeReactionRequestBase = edge.data.lowCodeReactionRequestBase;
  }
  return fine;
}

function fineGranularRelationRequest(
  nodes: Node[],
  edge: Edge,
): MetaModelRelationRequest | null {
  if (edge.type !== 'fine-granular-reaction') return null;
  const ecore = edge.data?.ecore;
  if (!ecore) return null;
  const sourceId = resolveModelToSourceId(nodes, ecore.fromModel as string);
  const targetId = resolveModelToSourceId(nodes, ecore.toModel as string);
  if (typeof sourceId !== 'number' || typeof targetId !== 'number') return null;
  return {
    sourceId,
    targetId,
    // Generated Low Code files live on the fine row, not the parent coarse relation.
    reactionFileId: null,
    fineGranularMetaModelRelationSet: [fineRelationFromEdge(edge)],
  };
}

function collectFineGranularRelations(
  nodes: Node[],
  edges: Edge[],
  byKey: Map<string, MetaModelRelationRequest>,
): void {
  for (const edge of edges) {
    const request = fineGranularRelationRequest(nodes, edge);
    if (request) upsertRelation(byKey, request);
  }
}

function applyStoreRelationToExisting(
  existing: MetaModelRelationRequest,
  rel: MetaModelRelationRequest,
  fineGraphVisible: boolean,
  byKey: Map<string, MetaModelRelationRequest>,
): void {
  if (!fineGraphVisible) {
    upsertRelation(byKey, rel);
    return;
  }
  const overlaid = overlayStoreFinesOntoCanvas(
    existing.fineGranularMetaModelRelationSet,
    rel.fineGranularMetaModelRelationSet,
  );
  if (overlaid?.length) existing.fineGranularMetaModelRelationSet = overlaid;
  if (rel.reactionFileId) existing.reactionFileId = rel.reactionFileId;
}

function mergeStoreRelation(
  byKey: Map<string, MetaModelRelationRequest>,
  rel: MetaModelRelationRequest,
  fineGraphVisible: boolean,
): void {
  const existing = byKey.get(relationKey(rel.sourceId, rel.targetId));
  if (existing) {
    applyStoreRelationToExisting(existing, rel, fineGraphVisible, byKey);
    return;
  }
  if (!rel.fineGranularMetaModelRelationSet?.length || fineGraphVisible) return;
  upsertRelation(byKey, {
    sourceId: rel.sourceId,
    targetId: rel.targetId,
    reactionFileId: toWireReactionFileId(rel.reactionFileId),
    fineGranularMetaModelRelationSet: rel.fineGranularMetaModelRelationSet,
  });
}

function overlayStoreRelations(
  nodes: Node[],
  edges: Edge[],
  storeSnapshot: WorkspaceSnapshot | null | undefined,
  byKey: Map<string, MetaModelRelationRequest>,
): void {
  const storeRels = storeSnapshot?.metaModelRelationRequests;
  if (!storeRels) return;
  const fineGraphVisible = isFineReactionGraphVisible(nodes, edges);
  for (const rel of storeRels) {
    mergeStoreRelation(byKey, rel, fineGraphVisible);
  }
}

/**
 * Reduces the canvas to what the backend persists: the set of metamodels on it
 * and the reaction relations between them. Relations whose endpoints have no
 * resolvable metamodel id are dropped rather than sent as partial records.
 *
 * Fine-granular reaction edges (`type: 'fine-granular-reaction'`) are grouped
 * by backend source/target ids into the parent coarse relation's
 * `fineGranularMetaModelRelationSet`. Optional `storeSnapshot` overlays Low Code
 * form data. Store-only fines are included only when Reactions mode is collapsed
 * (no EObject / bounding-box / fine edges on the canvas).
 */
export function buildWorkspaceSnapshot(
  nodes: Node[],
  edges: Edge[],
  storeSnapshot?: WorkspaceSnapshot | null,
): WorkspaceSnapshot {
  const byKey = new Map<string, MetaModelRelationRequest>();
  collectReactionRelations(nodes, edges, byKey);
  collectFineGranularRelations(nodes, edges, byKey);
  overlayStoreRelations(nodes, edges, storeSnapshot, byKey);
  return {
    metaModelIds: collectMetaModelIds(nodes),
    metaModelRelationRequests: Array.from(byKey.values()),
  };
}
