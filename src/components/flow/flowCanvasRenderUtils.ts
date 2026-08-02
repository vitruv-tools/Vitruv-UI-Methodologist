import React from 'react';
import { Edge, Node, ReactFlowInstance } from 'reactflow';
import { ConnectionDragState, HandlePosition, PendingDeleteState } from './flowCanvasTypes';

/**
 * Cursor communicating add-reaction mode: `cell` while waiting for the source
 * box, `crosshair` once a source is picked and a target is expected.
 */
export function getReactionModeCursor(
  addReactionMode: boolean | undefined,
  reactionSourceId: string | null,
): React.CSSProperties['cursor'] {
  if (!addReactionMode) return undefined;
  if (reactionSourceId) return 'crosshair';
  return 'cell';
}

/** Wording for the delete confirmation, matched to what is actually selected. */
export function getPendingDeleteConfirmMessage(pendingDelete: PendingDeleteState | null): string {
  if (!pendingDelete) {
    return 'Do you really want to remove this element from the canvas?';
  }

  const hasFile = Boolean(pendingDelete.fileId);
  const hasEdges = pendingDelete.edgeIds.length > 0;
  const hasOtherNodes = pendingDelete.nodeIds.length > 0;

  if (hasFile && (hasEdges || hasOtherNodes)) {
    return 'Remove the selected connection(s) and the meta model from the canvas?';
  }
  if (hasEdges) {
    return 'Remove the selected connection from the canvas?';
  }
  return 'Do you really want to remove this element from the canvas?';
}

export interface EdgeDistributionSlot {
  edgeId: string;
  index: number;
  total: number;
}

export interface UmlMergeInfo {
  mergePoint?: { x: number; y: number; mergeGroupId: string };
  hasMerge: boolean;
  isFirstInMergeGroup: boolean;
  mergeGroupSourceNodes: string[];
}

export interface MapFlowEdgeContext {
  readOnly: boolean;
  routingStyle: 'curved' | 'orthogonal';
  hoveredMergeGroup: string | null;
  getDistribution: (edge: Edge) => {
    sourceData?: EdgeDistributionSlot;
    targetData?: EdgeDistributionSlot;
  };
  getUmlMerge: (edge: Edge) => UmlMergeInfo;
  handleMergeGroupHover: (groupId: string | null) => void;
  handleEdgeDoubleClick: (edgeId: string) => void;
  handleEdgeDragStart: (edgeId: string) => void;
  handleEdgeDrag: (edgeId: string, point: { x: number; y: number }) => void;
  handleEdgeDragEnd: (edgeId: string, point: { x: number; y: number }) => void;
  handleEdgeHandleChange: (edgeId: string, newSourceHandle: string, newTargetHandle: string) => void;
  handleEdgeReorderRequest: (edgeId: string, controlPoint: { x: number; y: number }) => void;
}

function reactionEdgeInteractionHandlers(
  edgeId: string,
  editable: boolean,
  ctx: MapFlowEdgeContext,
) {
  if (!editable) {
    return {
      onEdgeDragStart: undefined,
      onEdgeDrag: undefined,
      onEdgeDragEnd: undefined,
      onHandleChange: undefined,
      onReorderRequest: undefined,
    };
  }

  return {
    onEdgeDragStart: ctx.handleEdgeDragStart,
    onEdgeDrag: ctx.handleEdgeDrag,
    onEdgeDragEnd: ctx.handleEdgeDragEnd,
    onHandleChange: ctx.handleEdgeHandleChange,
    onReorderRequest: ctx.handleEdgeReorderRequest,
  };
}

export function mapFlowCanvasEdge(edge: Edge, ctx: MapFlowEdgeContext): Edge {
  const { sourceData, targetData } = ctx.getDistribution(edge);
  const {
    mergePoint,
    hasMerge,
    isFirstInMergeGroup,
    mergeGroupSourceNodes,
  } = ctx.getUmlMerge(edge);
  const isReaction = edge.type === 'reactions';
  const isUml = edge.type === 'uml';
  const reactionEditable = isReaction && !ctx.readOnly;

  return {
    ...edge,
    data: {
      ...edge.data,
      mergePoint,
      hasMerge,
      isFirstInMergeGroup,
      mergeGroupSourceNodes,
      hoveredMergeGroup: ctx.hoveredMergeGroup,
      onMergeGroupHover: isUml ? ctx.handleMergeGroupHover : undefined,
      onDoubleClick: isReaction ? () => ctx.handleEdgeDoubleClick(edge.id) : undefined,
      readOnly: isReaction ? ctx.readOnly : undefined,
      routingStyle: ctx.routingStyle,
      separation: 36,
      sourceParallelIndex: sourceData?.index,
      sourceParallelCount: sourceData?.total,
      targetParallelIndex: targetData?.index,
      targetParallelCount: targetData?.total,
      customControlPoint: edge.data?.customControlPoint,
      ...reactionEdgeInteractionHandlers(edge.id, reactionEditable, ctx),
    },
    style: {
      ...edge.style,
      pointerEvents: (isUml ? 'none' : 'all') as React.CSSProperties['pointerEvents'],
    },
  };
}

export function getEdgeDistributionData(
  edge: Edge,
  edgeDistributionMap: Map<string, Map<HandlePosition, EdgeDistributionSlot[]>>,
): { sourceData?: EdgeDistributionSlot; targetData?: EdgeDistributionSlot } {
  const sourceDistribution = edgeDistributionMap.get(edge.source);
  const targetDistribution = edgeDistributionMap.get(edge.target);
  return {
    sourceData: sourceDistribution?.get(edge.sourceHandle as HandlePosition)?.find(d => d.edgeId === edge.id),
    targetData: targetDistribution?.get(edge.targetHandle as HandlePosition)?.find(d => d.edgeId === edge.id),
  };
}

export function getUmlMergeInfo(
  edge: Edge,
  umlMergeData: {
    mergePointsMap: Map<string, { x: number; y: number; mergeGroupId: string }>;
    firstInGroupMap: Map<string, string>;
    mergeGroupSourceNodesMap: Map<string, string[]>;
  },
): UmlMergeInfo {
  if (edge.type !== 'uml') {
    return {
      mergePoint: undefined,
      hasMerge: false,
      isFirstInMergeGroup: false,
      mergeGroupSourceNodes: [],
    };
  }

  const mergePoint = umlMergeData.mergePointsMap.get(edge.id);
  const hasMerge = Boolean(mergePoint);
  if (!mergePoint?.mergeGroupId) {
    return { mergePoint, hasMerge, isFirstInMergeGroup: false, mergeGroupSourceNodes: [] };
  }

  const firstEdgeId = umlMergeData.firstInGroupMap.get(mergePoint.mergeGroupId);
  return {
    mergePoint,
    hasMerge,
    isFirstInMergeGroup: firstEdgeId === edge.id,
    mergeGroupSourceNodes: umlMergeData.mergeGroupSourceNodesMap.get(mergePoint.mergeGroupId) ?? [],
  };
}

export function computeConnectionLinePositions(
  connectionDragState: ConnectionDragState | null,
  reactFlowInstance: ReactFlowInstance | null,
): { source: { x: number; y: number }; target: { x: number; y: number } } | null {
  if (
    !connectionDragState?.isActive
    || !connectionDragState.sourceTipPosition
    || !connectionDragState.currentPosition
    || !reactFlowInstance
  ) {
    return null;
  }

  const viewport = reactFlowInstance.getViewport();
  const tip = connectionDragState.sourceTipPosition;

  return {
    source: {
      x: tip.x * viewport.zoom + viewport.x,
      y: tip.y * viewport.zoom + viewport.y,
    },
    target: {
      x: connectionDragState.currentPosition.x * viewport.zoom + viewport.x,
      y: connectionDragState.currentPosition.y * viewport.zoom + viewport.y,
    },
  };
}

export function applyPendingCanvasDelete(
  pendingDelete: PendingDeleteState,
  removeEdge: (id: string) => void,
  removeNode: (id: string) => void,
  onEcoreFileDelete: ((id: string) => void) | undefined,
  clearSelection: () => void,
): void {
  pendingDelete.edgeIds.forEach(removeEdge);
  pendingDelete.nodeIds.forEach(removeNode);
  if (pendingDelete.fileId) {
    removeNode(pendingDelete.fileId);
    clearSelection();
    onEcoreFileDelete?.(pendingDelete.fileId);
  }
}

export function mapEditableFlowNode(
  node: Node,
  readOnly: boolean,
  handleLabelChange: (id: string, label: string) => void,
  removeNode: (id: string) => void,
): Node {
  return {
    ...node,
    draggable: !readOnly,
    data: {
      ...node.data,
      onLabelChange: readOnly ? undefined : handleLabelChange,
      onDelete: readOnly ? undefined : removeNode,
    },
  };
}

export function mapEcoreFlowNode(
  node: Node,
  options: {
    readOnly: boolean;
    expandedFileId: string | null;
    selectedFileId: string | null;
    connectionDragState: ConnectionDragState | null;
    addReactionMode?: boolean;
    reactionSourceId: string | null;
    constraintHighlightNodeId?: string | null;
    constraintFilterNodeId?: string | null;
    edgeDistribution: unknown;
    handleEcoreFileExpand: (fileName: string, fileContent: string) => void;
    handleEcoreFileSelect: (fileName: string) => void;
    onEcoreFileDelete?: (id: string) => void;
    handleRequestDelete: (id: string) => void;
    onEcoreFileRename?: (id: string, newFileName: string) => void;
    handleShowDetails: (model: unknown, fileContent: string) => void;
    handleConnectionStart?: (
      nodeId: string,
      handle: 'top' | 'bottom' | 'left' | 'right',
      tipScreenPos: { x: number; y: number },
    ) => void;
  },
): Node {
  const {
    readOnly,
    expandedFileId,
    selectedFileId,
    connectionDragState,
    addReactionMode,
    reactionSourceId,
    constraintHighlightNodeId,
    constraintFilterNodeId,
    edgeDistribution,
    handleEcoreFileExpand,
    handleEcoreFileSelect,
    onEcoreFileDelete,
    handleRequestDelete,
    onEcoreFileRename,
    handleShowDetails,
    handleConnectionStart,
  } = options;

  return {
    ...node,
    data: {
      ...node.data,
      readOnly,
      onExpand: handleEcoreFileExpand,
      onSelect: handleEcoreFileSelect,
      onDelete: readOnly ? undefined : onEcoreFileDelete,
      onRequestDelete: readOnly ? undefined : handleRequestDelete,
      onRename: readOnly ? undefined : onEcoreFileRename,
      onShowDetails: handleShowDetails,
      isExpanded: expandedFileId === node.id,
      onConnectionStart: readOnly ? undefined : handleConnectionStart,
      isConnectionActive: connectionDragState?.isActive || false,
      edgeDistribution,
      isReactionSource: reactionSourceId === node.id,
      isConstraintContext: constraintHighlightNodeId === node.id,
      isConstraintFilter: constraintFilterNodeId === node.id,
    },
    selected: selectedFileId === node.id,
    draggable: !readOnly && !connectionDragState?.isActive && !addReactionMode,
  };
}
