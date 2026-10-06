import { Dispatch, SetStateAction, useEffect } from 'react';
import { Edge, Node, ReactFlowInstance } from 'reactflow';
import { toWireReactionFileId } from '../../utils/workspaceSnapshotUtils';

/**
 * Child components communicate upward through window events rather than props
 * because ReactFlow renders nodes and edges outside this component's tree.
 */

interface EdgeSelectionEventOptions {
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  setNodes: Dispatch<SetStateAction<Node[]>>;
  setSelectedFileId: (id: string | null) => void;
}

/** Toggles the named edge's selection and clears every other edge. */
export function selectOnlyEdge(edges: Edge[], edgeId: string, currentlySelected: boolean): Edge[] {
  return edges.map(edge => ({
    ...edge,
    selected: edge.id === edgeId ? !currentlySelected : false,
  }));
}

/** Clears the selection flag on every node. */
export function deselectAllNodes(nodes: Node[]): Node[] {
  return nodes.map(node => ({ ...node, selected: false }));
}

/**
 * Selecting an edge is exclusive: it clears every other edge, all nodes, and
 * the selected-file highlight.
 */
export function useEdgeSelectionEvents({
  setEdges,
  setNodes,
  setSelectedFileId,
}: EdgeSelectionEventOptions): void {
  useEffect(() => {
    const handleEdgeClick = (e: Event) => {
      const { edgeId, currentlySelected } = (e as CustomEvent<{
        edgeId: string;
        currentlySelected: boolean;
      }>).detail;

      setEdges(prev => selectOnlyEdge(prev, edgeId, currentlySelected));
      setNodes(deselectAllNodes);
      setSelectedFileId(null);
    };

    globalThis.addEventListener('edge-clicked', handleEdgeClick as EventListener);
    return () => {
      globalThis.removeEventListener('edge-clicked', handleEdgeClick as EventListener);
    };
  }, [setEdges, setNodes, setSelectedFileId]);
}

interface EdgeControlPointEventOptions {
  reactFlowInstance: ReactFlowInstance | null;
  updateEdgeControlPoint: (edgeId: string, controlPoint: { x: number; y: number } | null) => void;
}

/**
 * Dragging a UML edge's control handle. The drag event carries screen
 * coordinates and has to be projected into flow space; the drop event already
 * carries a flow-space point (or `null` to reset to the default curve).
 */
export function useEdgeControlPointEvents({
  reactFlowInstance,
  updateEdgeControlPoint,
}: EdgeControlPointEventOptions): void {
  useEffect(() => {
    const handleControlDrag = (e: Event) => {
      const { edgeId, x, y } = (e as CustomEvent<{ edgeId: string; x: number; y: number }>).detail;
      if (!reactFlowInstance) return;
      updateEdgeControlPoint(edgeId, reactFlowInstance.screenToFlowPosition({ x, y }));
    };

    const handleControlDrop = (e: Event) => {
      const { edgeId, point } = (e as CustomEvent<{
        edgeId: string;
        point: { x: number; y: number } | null;
      }>).detail;
      updateEdgeControlPoint(edgeId, point);
    };

    globalThis.addEventListener('uml-edge-control-drag', handleControlDrag as EventListener);
    globalThis.addEventListener('uml-edge-control-drop', handleControlDrop as EventListener);
    return () => {
      globalThis.removeEventListener('uml-edge-control-drag', handleControlDrag as EventListener);
      globalThis.removeEventListener('uml-edge-control-drop', handleControlDrop as EventListener);
    };
  }, [reactFlowInstance, updateEdgeControlPoint]);
}

interface WorkspaceLayoutEventOptions {
  autoLayoutEcoreBoxes: () => void;
  fitEcoreWorkspace: () => void;
}

/** Toolbar buttons outside this subtree trigger layout via window events. */
export function useWorkspaceLayoutEvents({
  autoLayoutEcoreBoxes,
  fitEcoreWorkspace,
}: WorkspaceLayoutEventOptions): void {
  useEffect(() => {
    const handleAutoLayout = () => autoLayoutEcoreBoxes();
    const handleFitEcore = () => fitEcoreWorkspace();

    globalThis.addEventListener('vitruv.autoLayoutWorkspace', handleAutoLayout as EventListener);
    globalThis.addEventListener('vitruv.fitEcoreWorkspace', handleFitEcore as EventListener);
    return () => {
      globalThis.removeEventListener('vitruv.autoLayoutWorkspace', handleAutoLayout as EventListener);
      globalThis.removeEventListener('vitruv.fitEcoreWorkspace', handleFitEcore as EventListener);
    };
  }, [autoLayoutEcoreBoxes, fitEcoreWorkspace]);
}

interface ReactionEdgeCreationEventOptions {
  readOnly: boolean;
  createReactionEdgeFromEvent: (detail: {
    sourceNodeId: string;
    targetNodeId: string;
    code: string;
    originalEdgeId: number;
  }) => void;
}

/** `vitruv.createReactionEdge` — raised when a reaction is authored elsewhere. */
export function useReactionEdgeCreationEvents({
  readOnly,
  createReactionEdgeFromEvent,
}: ReactionEdgeCreationEventOptions): void {
  useEffect(() => {
    const handleCreateReactionEdge = (e: Event) => {
      if (readOnly) return;
      const custom = e as CustomEvent<{
        sourceNodeId: string;
        targetNodeId: string;
        code: string;
        originalEdgeId: number;
      }>;
      createReactionEdgeFromEvent(custom.detail);
    };

    globalThis.addEventListener('vitruv.createReactionEdge', handleCreateReactionEdge as EventListener);
    return () => {
      globalThis.removeEventListener('vitruv.createReactionEdge', handleCreateReactionEdge as EventListener);
    };
  }, [readOnly, createReactionEdgeFromEvent]);
}

export interface MetaModelRelation {
  id: number;
  sourceId: number;
  targetId: number;
  reactionFileId: number | null;
}

/** Normalises the several field spellings the backend has used over time. */
export function normalizeMetaModelRelations(
  raw: Array<Record<string, unknown>> | undefined,
): MetaModelRelation[] {
  return (raw ?? [])
    .map(rel => ({
      id: typeof rel.id === 'number' ? rel.id : 0,
      sourceId: (rel.sourceId ?? rel.sourceMetaModelId) as number,
      targetId: (rel.targetId ?? rel.targetMetaModelId) as number,
      reactionFileId: toWireReactionFileId(rel.reactionFileId ?? rel.reactionFileStorageId),
    }))
    .filter(rel => typeof rel.sourceId === 'number' && typeof rel.targetId === 'number');
}

interface MetaModelRelationEventOptions {
  processRelation: (relation: MetaModelRelation, preserveExisting: boolean) => void;
}

/** `vitruv.loadMetaModelRelations` / `vitruv.loadRelations` — both carry the same payload. */
export function useMetaModelRelationEvents({
  processRelation,
}: MetaModelRelationEventOptions): void {
  useEffect(() => {
    const handleLoadMetaModelRelations = (e: Event) => {
      const custom = e as CustomEvent<{
        relations?: Array<Record<string, unknown>>;
        preserveExisting?: boolean;
      }>;

      const preserveExisting = custom.detail?.preserveExisting ?? false;
      normalizeMetaModelRelations(custom.detail?.relations)
        .forEach(relation => processRelation(relation, preserveExisting));
    };

    globalThis.addEventListener('vitruv.loadMetaModelRelations', handleLoadMetaModelRelations);
    globalThis.addEventListener('vitruv.loadRelations', handleLoadMetaModelRelations);
    return () => {
      globalThis.removeEventListener('vitruv.loadMetaModelRelations', handleLoadMetaModelRelations);
      globalThis.removeEventListener('vitruv.loadRelations', handleLoadMetaModelRelations);
    };
  }, [processRelation]);
}
