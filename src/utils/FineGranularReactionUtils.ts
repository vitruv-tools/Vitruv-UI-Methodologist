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
import { ActiveVsumDetails, hasActiveVsumDetailsStore } from '../store/ActiveVsumDetails';
import { useSelectedEdgeStore } from '../store/SelectedEdge';
import { extractModelFromEObjectId } from './EcoreIdentifiers';
import { toWireReactionFileId } from './workspaceSnapshotUtils';
import {
  EOBJECT_ATTR_ROW_HEIGHT,
  EOBJECT_DEFAULT_WIDTH,
  EOBJECT_HEADER_HEIGHT,
  GHOST_NODE_SIZE,
  getBorderPoint,
} from './reactionEdgeGeometry';

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
  fromModelAlias?: string;
  toModelAlias?: string;
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
    fromModelAlias,
    toModelAlias,
    reactionFileId,
  } = params;

  const edgeId = `fine-reaction-${fineEdgeCounter++}-${Date.now()}`;
  const normalizedFileId = toWireReactionFileId(reactionFileId);

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
        fromModelAlias,
        toModelAlias,
      },
      reactionFileId: normalizedFileId ?? undefined,
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
        ...(normalizedFileId && normalizedFileId > 0
          ? { reactionFileStorageId: normalizedFileId }
          : {}),
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
  const normalizedFileId = toWireReactionFileId(relation.reactionFileStorageId);

  return {
    id: edgeId,
    source: sourceNodeId,
    target: targetNodeId,
    sourceHandle: reactionSourceHandleId(relation.sourceId),
    targetHandle: reactionTargetHandleId(relation.targetId),
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
      fineRelationId: toWireReactionFileId(relation.id) ?? undefined,
      reactionFileId: normalizedFileId ?? undefined,
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
 * Resolve an EObject (class, attribute, or EReference ghost) FQ id to the
 * React Flow node that owns it. Ghosts (association midpoints) are matched
 * first so a saved EReference id does not fall through to the parent class.
 */
export function resolveFineGranularEndpointNodeId(
  nodes: Node[],
  eObjectId: string,
  model: string,
): string | null {
  if (!eObjectId) return null;

  const matchesGhost = (requireModel: boolean): string | null => {
    for (const node of nodes) {
      if (!isGhostNode(node)) continue;
      const ecore = node.data?.ecore;
      if (!ecore) continue;
      if (requireModel && model && ecore.model && ecore.model !== model) continue;
      if (ecore.eObjectId === eObjectId) return node.id;
    }
    return null;
  };

  const matchesClass = (requireModel: boolean): string | null => {
    for (const node of nodes) {
      if (node.type !== 'eobject') continue;
      const ecore = node.data?.ecore;
      if (!ecore) continue;
      if (requireModel && model && ecore.model && ecore.model !== model) continue;
      if (ecore.eObjectId === eObjectId) return node.id;
      if (Array.isArray(ecore.eAttributeIds) && ecore.eAttributeIds.includes(eObjectId)) {
        return node.id;
      }
      if (Array.isArray(ecore.eReferenceIds) && ecore.eReferenceIds.includes(eObjectId)) {
        return node.id;
      }
      if (typeof ecore.eObjectId === 'string' && eObjectId.startsWith(`${ecore.eObjectId}.`)) {
        return node.id;
      }
    }
    return null;
  };

  return matchesGhost(true)
    ?? matchesGhost(false)
    ?? matchesClass(true)
    ?? matchesClass(false);
}

export function fineGranularEdgePairKey(edge: Edge): string {
  const ecore = edge.data?.ecore;
  if (!ecore) return edge.id;
  return `${ecore.eObjectSourceId}|${ecore.eObjectTargetId}|${ecore.fromModel}|${ecore.toModel}`;
}

/** Append incoming fine edges, skipping pairs already present. */
export function mergeFineGranularEdges(existing: Edge[], incoming: FlowEcoreEdge[]): Edge[] {
  if (incoming.length === 0) return existing;
  const keys = new Set(
    existing.filter(isFineGranularReactionEdge).map(fineGranularEdgePairKey),
  );
  const add = incoming.filter(e => !keys.has(fineGranularEdgePairKey(e)));
  return add.length > 0 ? [...existing, ...add] : existing;
}

/**
 * Load all fine-granular reaction edges from the store for the active VSUM.
 *
 * `nodeResolver` maps an EObject FQ id to a React Flow node id.
 * Edges whose endpoints cannot be resolved are skipped.
 */
export function loadFineGranularEdgesFromStore(
  nodeResolver: (eObjectId: string, model: string) => string | null,
  identifierToModel?: Map<string, string>,
): FlowEcoreEdge[] {
  try {
    const active = new ActiveVsumDetails();
    const state = active.get();
    const edges: FlowEcoreEdge[] = [];

    for (const relation of state.metaModelsRelation) {
      for (const fine of relation.fineGranularMetaModelRelationSet) {
        const fromModel =
          findPreferredModelIdentifier(state.identifiersToBackendMetaModelId, relation.sourceId)
          ?? identifierToModel?.get(String(relation.sourceId))
          ?? extractModelFromEObjectId(fine.sourceId)
          ?? null;
        const toModel =
          findPreferredModelIdentifier(state.identifiersToBackendMetaModelId, relation.targetId)
          ?? identifierToModel?.get(String(relation.targetId))
          ?? extractModelFromEObjectId(fine.targetId)
          ?? null;
        if (!fromModel || !toModel) continue;

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

/**
 * Recreate canvas fine-granular edges from the VsumDetails store, attaching
 * them to currently expanded EObject nodes.
 */
export function hydrateFineGranularReactionEdges(
  eObjectNodes: Node[],
  ecoreFileNodes?: Node[],
): FlowEcoreEdge[] {
  const identifierToModel = new Map<string, string>();
  for (const node of ecoreFileNodes ?? []) {
    if (node.type !== 'ecoreFile') continue;
    const backendId = node.data?.metaModelSourceId ?? node.data?.metaModelId;
    const nsUri = typeof node.data?.nsUri === 'string' ? node.data.nsUri : undefined;
    if (typeof backendId === 'number' && nsUri) {
      identifierToModel.set(String(backendId), nsUri);
    }
  }
  return loadFineGranularEdgesFromStore(
    (eObjectId, model) => resolveFineGranularEndpointNodeId(eObjectNodes, eObjectId, model),
    identifierToModel,
  );
}

/** Prefer an nsURI key when several identifiers map to the same backend id. */
function findPreferredModelIdentifier(
  idMap: Map<string, number>,
  backendId: number,
): string | null {
  const keys: string[] = [];
  for (const [key, value] of idMap) {
    if (value === backendId) keys.push(key);
  }
  if (keys.length === 0) return null;
  return keys.find(k => k.includes('://') || k.includes('#')) ?? keys[0];
}

// ── Ghost nodes (EReference midpoints) ──────────────────────────────────

const GHOST_NODE_PREFIX = 'ghost-';
export { GHOST_NODE_SIZE };

export function isGhostNode(node: Node): boolean {
  return node.type === 'ghost' || node.id.startsWith(GHOST_NODE_PREFIX);
}

export function ghostNodeId(eReferenceId: string): string {
  return `${GHOST_NODE_PREFIX}${eReferenceId}`;
}

export function isIntraModelUmlEdge(edge: Edge): boolean {
  return edge.type === 'uml' && edge.data?.expandedIntraModel === true;
}

function eobjectBox(node: Node): { x: number; y: number; width: number; height: number } {
  const attrCount = Array.isArray(node.data?.attributes) ? node.data.attributes.length : 0;
  const width = typeof node.width === 'number' && node.width > 0
    ? node.width
    : EOBJECT_DEFAULT_WIDTH;
  const height = typeof node.height === 'number' && node.height > 0
    ? node.height
    : EOBJECT_HEADER_HEIGHT + attrCount * EOBJECT_ATTR_ROW_HEIGHT + 4;
  return { x: node.position.x, y: node.position.y, width, height };
}

/**
 * Midpoint of the same class-box chord UMLRelationship draws, so the ghost
 * sits on the visible association line rather than the header-handle line.
 */
export function midpointForEobjectPair(
  source: Node,
  target: Node,
  _sourceHandle?: string | null,
  _targetHandle?: string | null,
): { x: number; y: number } {
  const a = eobjectBox(source);
  const b = eobjectBox(target);
  const acx = a.x + a.width / 2;
  const acy = a.y + a.height / 2;
  const bcx = b.x + b.width / 2;
  const bcy = b.y + b.height / 2;
  const p1 = getBorderPoint(acx, acy, a.width, a.height, bcx, bcy);
  const p2 = getBorderPoint(bcx, bcy, b.width, b.height, acx, acy);
  return {
    x: (p1.x + p2.x) / 2 - GHOST_NODE_SIZE / 2,
    y: (p1.y + p2.y) / 2 - GHOST_NODE_SIZE / 2,
  };
}

export function createGhostNode(
  id: string,
  x: number,
  y: number,
  data?: {
    label?: string;
    group?: string;
    ecore?: {
      model: string;
      eObjectId: string;
      eAttributeIds?: string[];
      eReferenceIds?: string[];
      eOperationIds?: string[];
      eAnnotationIds?: string[];
      eSuperTypeIds?: string[];
    };
  },
): Node {
  return {
    id,
    type: 'ghost',
    position: { x, y },
    data: {
      label: data?.label ?? '',
      group: data?.group,
      ecore: data?.ecore ?? {
        model: '',
        eObjectId: id,
        eAttributeIds: [],
        eReferenceIds: [],
        eOperationIds: [],
        eAnnotationIds: [],
        eSuperTypeIds: [],
      },
    },
    style: { width: GHOST_NODE_SIZE, height: GHOST_NODE_SIZE, zIndex: 6 },
    selectable: false,
    draggable: false,
    connectable: true,
  };
}

/**
 * Keep association-midpoint ghosts on the chord between their two classes.
 * Returns extra position updates; does not add or remove ghosts.
 */
export function ghostPositionChanges(
  nodes: Node[],
  edges: Edge[],
): Array<{ type: 'position'; id: string; position: { x: number; y: number }; dragging: boolean }> {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const changes: Array<{
    type: 'position';
    id: string;
    position: { x: number; y: number };
    dragging: boolean;
  }> = [];

  for (const edge of edges) {
    if (!isIntraModelUmlEdge(edge)) continue;
    const refId = edge.data?.ecore?.eReferenceId;
    if (typeof refId !== 'string' || !refId) continue;
    const ghost = byId.get(ghostNodeId(refId));
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    if (!ghost || !source || !target) continue;
    const next = midpointForEobjectPair(source, target, edge.sourceHandle, edge.targetHandle);
    if (
      Math.abs(ghost.position.x - next.x) > 0.5
      || Math.abs(ghost.position.y - next.y) > 0.5
    ) {
      changes.push({ type: 'position', id: ghost.id, position: next, dragging: false });
    }
  }

  return changes;
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

/**
 * True when Reactions mode is expanded: EObject/bounding-box nodes or fine
 * edges are on the canvas. Collapsed VSUM cards only have `ecoreFile` nodes.
 */
export function isFineReactionGraphVisible(nodes: Node[], edges: Edge[]): boolean {
  return nodes.some(n => n.type === 'eobject' || n.type === 'boundingBox')
    || edges.some(isFineGranularReactionEdge);
}

function canvasFineToStoreRow(edge: Edge): EditableFineGranularMetaModelRelation | null {
  const ecore = edge.data?.ecore;
  if (!ecore?.eObjectSourceId || !ecore?.eObjectTargetId) return null;
  const persistedId = toWireReactionFileId(edge.data?.fineRelationId);
  const generatedFileId = toWireReactionFileId(edge.data?.reactionFileId);
  return {
    id: persistedId ?? null,
    sourceId: ecore.eObjectSourceId,
    targetId: ecore.eObjectTargetId,
    ...(generatedFileId != null && generatedFileId > 0
      ? { reactionFileStorageId: generatedFileId }
      : {}),
    ...(edge.data?.lowCodeReactionRequestBase
      ? { lowCodeReactionRequestBase: edge.data.lowCodeReactionRequestBase }
      : {}),
  };
}

function isPlaceholderCoarseRelation(relation: {
  id: number;
  reactionFileId: number | null;
  reactionFileStorageId: number | null;
  fineGranularMetaModelRelationSet: unknown[];
}): boolean {
  return relation.id === 0
    && relation.reactionFileId == null
    && relation.reactionFileStorageId == null
    && relation.fineGranularMetaModelRelationSet.length === 0;
}

/**
 * Keep the VsumDetails fine-granular set aligned with the canvas while the
 * fine graph is visible. Undo only restores React Flow nodes/edges, so without
 * this the store still holds the undone reaction and save / collapse re-injects it.
 *
 * No-op when Reactions mode is collapsed (fines live only in the store).
 */
export function syncFineGranularStoreFromCanvas(nodes: Node[], edges: Edge[]): void {
  if (!isFineReactionGraphVisible(nodes, edges)) return;
  if (!hasActiveVsumDetailsStore()) return;

  try {
    const active = new ActiveVsumDetails();
    const liveKeys = new Set<string>();
    const liveFines: Array<{
      coarseSourceId: number;
      coarseTargetId: number;
      row: EditableFineGranularMetaModelRelation;
    }> = [];

    for (const edge of edges) {
      if (!isFineGranularReactionEdge(edge) || !edge.data?.ecore) continue;
      const { fromModel, toModel } = edge.data.ecore;
      const coarseSourceId = active.getBackendMetaModelId(fromModel);
      const coarseTargetId = active.getBackendMetaModelId(toModel);
      if (coarseSourceId === undefined || coarseTargetId === undefined) continue;
      const row = canvasFineToStoreRow(edge);
      if (!row) continue;
      liveKeys.add(`${coarseSourceId}|${coarseTargetId}|${row.sourceId}|${row.targetId}`);
      liveFines.push({ coarseSourceId, coarseTargetId, row });
    }

    let changed = false;
    const relations = [...active.get().metaModelsRelation];
    for (const rel of relations) {
      for (const fg of [...rel.fineGranularMetaModelRelationSet]) {
        const key = `${rel.sourceId}|${rel.targetId}|${fg.sourceId}|${fg.targetId}`;
        if (liveKeys.has(key)) continue;
        active.removeFineGranularMetaModelRelation(
          rel.sourceId,
          rel.targetId,
          fg.sourceId,
          fg.targetId,
        );
        changed = true;
      }

      const remaining = active.getMetaModelRelation({
        sourceId: rel.sourceId,
        targetId: rel.targetId,
      });
      if (remaining && isPlaceholderCoarseRelation(remaining)) {
        active.removeMetaModelRelation(rel.sourceId, rel.targetId);
        changed = true;
      }
    }

    for (const { coarseSourceId, coarseTargetId, row } of liveFines) {
      const existing = active.getFineGranularMetaModelRelation(
        coarseSourceId,
        coarseTargetId,
        row.sourceId,
        row.targetId,
      );
      if (existing) continue;
      active.addFineGranularMetaModelRelation(coarseSourceId, coarseTargetId, row);
      changed = true;
    }

    if (changed) active.saveToStore();
  } catch {
    // store may not be initialized — canvas is still the source of truth for save
  }
}
