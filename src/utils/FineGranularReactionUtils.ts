/**
 * Fine-granular reaction edge utilities.
 *
 * Create/delete/load fine-granular reaction edges on the React Flow canvas,
 * manage ghost nodes, and toggle CSS variable–driven handle/edge visibility.
 */

import type { Edge, Node } from 'reactflow';
import type { FlowFineGranularMetaModelRelationData } from '../types/FlowFineGranularMetaModelRelationData';
import type { FlowEcoreEdge } from '../types/flow';
import type { EditableFineGranularMetaModelRelation } from '../types/FineGranularMetaModelRelation';
import { ActiveVsumDetails } from '../store/ActiveVsumDetails';
import { useSelectedEdgeStore } from '../store/SelectedEdge';
import { normalizeReactionFileId } from './workspaceSnapshotUtils';

// ── Type guards ─────────────────────────────────────────────────────────

export function isFlowFineGranularMetaModelRelationData(
  data: unknown,
): data is FlowFineGranularMetaModelRelationData {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  if (typeof d.ecore !== 'object' || d.ecore === null) return false;
  const ecore = d.ecore as Record<string, unknown>;
  return (
    typeof ecore.eObjectSourceId === 'string' &&
    typeof ecore.eObjectTargetId === 'string' &&
    typeof ecore.fromModel === 'string' &&
    typeof ecore.toModel === 'string'
  );
}

export function isFineGranularReactionEdge(edge: Edge): boolean {
  return edge.type === 'fine-granular-reaction';
}

// ── Edge creation ───────────────────────────────────────────────────────

let fineEdgeCounter = 0;

/**
 * Create a new fine-granular reaction edge and push it into the store.
 *
 * Returns the edge to add to React Flow state.
 */
export function createFineGranularReactionEdge(params: {
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandleId: string;
  targetHandleId: string;
  eObjectSourceId: string;
  eObjectTargetId: string;
  fromModel: string;
  toModel: string;
  reactionFileId?: number;
}): FlowEcoreEdge {
  const {
    sourceNodeId,
    targetNodeId,
    sourceHandleId,
    targetHandleId,
    eObjectSourceId,
    eObjectTargetId,
    fromModel,
    toModel,
    reactionFileId,
  } = params;

  const edgeId = `fine-reaction-${fineEdgeCounter++}-${Date.now()}`;
  const normalizedFileId = reactionFileId != null
    ? normalizeReactionFileId(reactionFileId)
    : undefined;

  const edge: FlowEcoreEdge = {
    id: edgeId,
    source: sourceNodeId,
    target: targetNodeId,
    sourceHandle: sourceHandleId,
    targetHandle: targetHandleId,
    type: 'fine-granular-reaction',
    animated: true,
    data: {
      relationshipType: 'fine-granular-reaction',
      ecore: {
        eObjectSourceId,
        eObjectTargetId,
        fromModel,
        toModel,
      },
      reactionFileId: normalizedFileId,
    },
  };

  try {
    const active = new ActiveVsumDetails();
    const sourceBackendId = active.getBackendMetaModelId(fromModel);
    const targetBackendId = active.getBackendMetaModelId(toModel);

    if (sourceBackendId !== undefined && targetBackendId !== undefined) {
      active.addFineGranularMetaModelRelation(sourceBackendId, targetBackendId, {
        id: null,
        sourceId: eObjectSourceId,
        targetId: eObjectTargetId,
        reactionFileStorageId: reactionFileId,
      });
      active.saveToStore();
    }
  } catch {
    // store may not be initialized yet — edge is still created visually
  }

  return edge;
}

/**
 * Create an edge for an existing (loaded) fine-granular relation.
 * Does NOT push to store since the relation already exists there.
 */
export function createExistingFineGranularReactionEdge(
  relation: EditableFineGranularMetaModelRelation,
  fromModel: string,
  toModel: string,
  sourceNodeId: string,
  targetNodeId: string,
): FlowEcoreEdge {
  const edgeId = `fine-reaction-existing-${fineEdgeCounter++}`;
  const normalizedFileId = relation.reactionFileStorageId != null
    ? normalizeReactionFileId(relation.reactionFileStorageId)
    : undefined;

  return {
    id: edgeId,
    source: sourceNodeId,
    target: targetNodeId,
    type: 'fine-granular-reaction',
    animated: true,
    data: {
      relationshipType: 'fine-granular-reaction',
      ecore: {
        eObjectSourceId: relation.sourceId,
        eObjectTargetId: relation.targetId,
        fromModel,
        toModel,
      },
      reactionFileId: normalizedFileId,
    },
  };
}

// ── Edge deletion ───────────────────────────────────────────────────────

/**
 * Delete a fine-granular reaction edge from the VsumDetails store.
 *
 * Returns `true` if the relation was found and removed.
 */
export function deleteFineGranularReactionEdgeFromVsumDetails(
  edge: FlowEcoreEdge,
): boolean {
  if (!edge.data?.ecore) return false;

  try {
    const active = new ActiveVsumDetails();
    const { eObjectSourceId, eObjectTargetId, fromModel, toModel } = edge.data.ecore;

    const sourceBackendId = active.getBackendMetaModelId(fromModel);
    const targetBackendId = active.getBackendMetaModelId(toModel);
    if (sourceBackendId === undefined || targetBackendId === undefined) return false;

    active.removeFineGranularMetaModelRelation(
      sourceBackendId,
      targetBackendId,
      eObjectSourceId,
      eObjectTargetId,
    );
    active.saveToStore();

    const selected = useSelectedEdgeStore.getState().selectedEdge;
    if (selected?.id === edge.id) {
      useSelectedEdgeStore.getState().clearSelectedEdge();
    }

    return true;
  } catch {
    return false;
  }
}

// ── Load fine edges from store ──────────────────────────────────────────

/**
 * Load all fine-granular reaction edges from the store for the active VSUM.
 *
 * `nodeResolver` maps an EObject FQ id to a React Flow node id.
 * Edges whose endpoints cannot be resolved are skipped.
 */
export function loadFineGranularEdgesFromStore(
  nodeResolver: (eObjectId: string, model: string) => string | null,
  identifierToModel: Map<string, string>,
): FlowEcoreEdge[] {
  try {
    const active = new ActiveVsumDetails();
    const state = active.get();
    const edges: FlowEcoreEdge[] = [];

    for (const relation of state.metaModelsRelation) {
      const fromModel = findModelIdentifier(
        state.identifiersToBackendMetaModelId,
        relation.sourceId,
      );
      const toModel = findModelIdentifier(
        state.identifiersToBackendMetaModelId,
        relation.targetId,
      );
      if (!fromModel || !toModel) continue;

      for (const fine of relation.fineGranularMetaModelRelationSet) {
        const sourceNodeId = nodeResolver(fine.sourceId, fromModel);
        const targetNodeId = nodeResolver(fine.targetId, toModel);
        if (!sourceNodeId || !targetNodeId) continue;

        edges.push(
          createExistingFineGranularReactionEdge(
            fine,
            fromModel,
            toModel,
            sourceNodeId,
            targetNodeId,
          ),
        );
      }
    }

    return edges;
  } catch {
    return [];
  }
}

function findModelIdentifier(
  idMap: Map<string, number>,
  backendId: number,
): string | null {
  for (const [key, value] of idMap) {
    if (value === backendId) return key;
  }
  return null;
}

// ── Ghost nodes ─────────────────────────────────────────────────────────

const GHOST_NODE_PREFIX = 'ghost-';

export function isGhostNode(node: Node): boolean {
  return node.id.startsWith(GHOST_NODE_PREFIX) || node.type === 'ghost';
}

/**
 * Build a ghost node id for the boundary between two models.
 */
export function ghostNodeId(fromModel: string, toModel: string): string {
  return `${GHOST_NODE_PREFIX}${fromModel}-${toModel}`;
}

/**
 * Determine which ghost nodes should exist based on fine-granular edges.
 *
 * Returns a Set of ghost node ids that should be present.
 */
export function detectRequiredGhostNodes(edges: Edge[]): Set<string> {
  const required = new Set<string>();
  for (const edge of edges) {
    if (!isFineGranularReactionEdge(edge) || !edge.data?.ecore) continue;
    const { fromModel, toModel } = edge.data.ecore;
    required.add(ghostNodeId(fromModel, toModel));
  }
  return required;
}

/**
 * Create a ghost node at a position between two bounding boxes.
 */
export function createGhostNode(
  id: string,
  x: number,
  y: number,
): Node {
  return {
    id,
    type: 'ghost',
    position: { x, y },
    data: { label: '' },
    style: { width: 1, height: 1, opacity: 0, pointerEvents: 'none' as const },
    selectable: false,
    draggable: false,
  };
}

// ── CSS variable toggle helpers ─────────────────────────────────────────

/**
 * Make reaction handles visible and interactive.
 */
export function enableReactionHandles(): void {
  const root = document.documentElement;
  root.style.setProperty('--reaction-handle-pointer-events-source', 'auto');
  root.style.setProperty('--reaction-handle-pointer-events-target', 'auto');
  root.style.setProperty('--reaction-handle-opacity-source', '1');
  root.style.setProperty('--reaction-handle-opacity-target', '1');
}

/**
 * Hide reaction handles (default state).
 */
export function disableReactionHandles(): void {
  const root = document.documentElement;
  root.style.setProperty('--reaction-handle-pointer-events-source', 'none');
  root.style.setProperty('--reaction-handle-pointer-events-target', 'none');
  root.style.setProperty('--reaction-handle-opacity-source', '0');
  root.style.setProperty('--reaction-handle-opacity-target', '0');
}

/**
 * Make fine-granular reaction edges visible.
 */
export function enableReactionEdges(): void {
  document.documentElement.style.setProperty('--reaction-edge-opacity', '1');
}

/**
 * Hide fine-granular reaction edges (default state).
 */
export function disableReactionEdges(): void {
  document.documentElement.style.setProperty('--reaction-edge-opacity', '0');
}

// ── Handle calculation ──────────────────────────────────────────────────

/**
 * Compute the handle id for a reaction source handle on an EObject node.
 */
export function reactionSourceHandleId(eObjectId: string): string {
  return `reaction-source-${eObjectId}`;
}

/**
 * Compute the handle id for a reaction target handle on an EObject node.
 */
export function reactionTargetHandleId(eObjectId: string): string {
  return `reaction-target-${eObjectId}`;
}

// ── Edge click / selection ──────────────────────────────────────────────

/**
 * Handle a click on a fine-granular reaction edge — select it in the store.
 */
export function onFineGranularEdgeClick(edge: FlowEcoreEdge): void {
  useSelectedEdgeStore.getState().setSelectedEdge(edge);
}

/**
 * Handle deletion of a fine-granular edge — remove from store and
 * return `true` if the caller should also remove it from React Flow state.
 */
export function onFineGranularEdgeDelete(edge: FlowEcoreEdge): boolean {
  return deleteFineGranularReactionEdgeFromVsumDetails(edge);
}
