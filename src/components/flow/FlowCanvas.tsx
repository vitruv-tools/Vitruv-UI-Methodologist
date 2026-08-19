import React, {
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import ReactFlow, {
  Background,
  ConnectionMode,
  ReactFlowInstance,
  Node,
  Edge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useFlowState } from '../../hooks/useFlowState';
import { useDragAndDrop } from '../../hooks/useDragAndDrop';
import { EditableNode } from './EditableNode';
import { UMLRelationship } from './UMLRelationship';
import { ReactionRelationship } from './ReactionRelationship';
import { EcoreFileBox } from './EcoreFileBox';
import { metaModelDisplayColor } from '../../utils/metaModelColors';
import { ConnectionLine } from './ConnectionLine';
import { ReactionEditorModal } from './ReactionEditorModal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { apiService } from '../../services/api';
import { WorkspaceSnapshot } from '../../types/workspace';
import { extractNsUriFromEcore } from '../../utils';
import {
  useCircleContainment,
  clampAllNodesToCircle,
  computeInitialCircle,
  Circle,
} from '../../hooks/useCircleContainment';
import { useViewTypes, ViewTypeScope, type ViewType } from '../../hooks/useViewTypes';
import { pickFocusUmlFlowNodes } from '../../utils/umlClassLayout';
import { fetchReactionCode, persistReactionCode, resolveReactionFileId } from '../../utils/reactionFile';

import { CircleOverlay } from './canvas/CircleOverlay';
import { CanvasControls } from './canvas/CanvasControls';
import { CanvasDropOverlay } from './canvas/CanvasDropOverlay';
import { CanvasMinimap } from './canvas/CanvasMinimap';
import { CanvasModeToggle } from './canvas/CanvasModeToggle';
import { ModelDetailOverlay } from './canvas/ModelDetailOverlay';

import { useFlowCanvasKeyboardShortcuts } from './useFlowCanvasKeyboard';
import { useEdgeColorMap } from './useEdgeColorMap';
import {
  MetaModelRelation,
  useEdgeControlPointEvents,
  useEdgeSelectionEvents,
  useMetaModelRelationEvents,
  useReactionEdgeCreationEvents,
  useWorkspaceLayoutEvents,
} from './useFlowCanvasEvents';
import {
  clampNodeChanges,
  getNodeDragFlags,
  isReadOnlyBlockedEdgeChange,
  isReadOnlyBlockedNodeChange,
  shouldCloseDetailOnBoxDrag,
} from './flowCanvasNodeChangeUtils';
import { findFreeEcorePosition } from './flowCanvasLayoutUtils';
import { buildReactionEdgeFromNodes, resolveEcoreFileSelectAction } from './flowCanvasEcoreSelect';
import {
  applyPendingCanvasDelete,
  computeConnectionLinePositions,
  getEdgeDistributionData,
  getPendingDeleteConfirmMessage,
  getReactionModeCursor,
  getUmlMergeInfo,
  mapEcoreFlowNode,
  mapEditableFlowNode,
  mapFlowCanvasEdge,
} from './flowCanvasRenderUtils';
import { applyAutoLayoutPositions, computeAutoLayoutPositions } from './flowCanvasAutoLayout';
import { buildEdgeDistributionMap } from './flowCanvasEdgeDistribution';
import { buildReactionEdge } from './flowCanvasEdgeFactory';
import { computeParallelEdgeReorder } from './flowCanvasEdgeReorder';
import {
  indexFineReactionParallels,
} from '../../utils/reactionEdgeGeometry';
import {
  dedupeEdgeIds,
  removeOrphanEdges,
  uniquifyLoadedEdgeIds,
  uniquifyLoadedNodeIds,
  withUniqueEdgeIds,
} from './flowCanvasEdgeHygiene';
import { optimizeEdgeHandles, updateEdgeHandles } from './flowCanvasHandleUtils';
import {
  findNodeByMetaModelId,
  findEcoreTargetAtPosition,
  getBackendMetaModelId,
  getMetaModelSourceId,
} from './flowCanvasNodeLookup';
import { buildInitialReactionCode } from './flowCanvasReactionCode';
import { buildWorkspaceSnapshot } from './flowCanvasSnapshot';
import { getToolLabel } from './flowCanvasToolLabels';
import { computeUmlMergeData } from './flowCanvasUmlMerge';
import {
  CanvasMode,
  CodeEditorState,
  ConnectionDragState,
  HandlePosition,
  PendingDeleteState,
} from './flowCanvasTypes';
import GhostNode from './lowcode/GhostNode';
import {
  isReactionHandleConnection,
  validateFineGranularConnection,
} from './lowcode/LowCodeReactionEdgeValidator';
import LowCodeReactionEditor, {
  type LowCodeReactionEditorHandle,
} from './lowcode/LowCodeReactionEditor';
import DragablePanel from './DragablePanel';
import { useProjectStore } from '../../store/Project';
import { useSelectedEdgeStore } from '../../store/SelectedEdge';
import { ActiveVsumDetails, hasActiveVsumDetailsStore } from '../../store/ActiveVsumDetails';
import type { FlowEcoreEdge } from '../../types/flow';
import {
  createFineGranularReactionEdge,
  isFineGranularReactionEdge,
  deleteFineGranularReactionEdgeFromVsumDetails,
  enableReactionHandles,
  enableReactionEdges,
  disableReactionHandles,
  disableReactionEdges,
  onFineGranularEdgeClick,
  hydrateFineGranularReactionEdges,
  mergeFineGranularEdges,
  syncFineGranularStoreFromCanvas,
  ghostPositionChanges,
  isIntraModelUmlEdge,
  isGhostNode,
} from '../../utils/FineGranularReactionUtils';
import {
  getProperEObjectIdFromHandle,
  extractModelFromEObjectId,
  deriveDisplayModelAlias,
  deriveModelAlias,
} from '../../utils/EcoreIdentifiers';
import {
  tryInferReactionFileIdForFineGranularReactionEdge,
  syncIdentifierMapFromCanvasNodes,
} from '../../utils/ReactionUtils';
import {
  expandMetaModelToNodes,
  nextBoundingBoxOrigin,
  computeBoundingBoxRect,
} from '../../utils/expandMetaModel';

import EObjectNode from './lowcode/EObjectNode';
import BoundingBoxNode from './lowcode/BoundingBoxNode';

export type { CanvasMode } from './flowCanvasTypes';

const nodeTypes = {
  editable: EditableNode,
  ecoreFile: EcoreFileBox,
  ghost: GhostNode,
  eobject: EObjectNode,
  boundingBox: BoundingBoxNode,
};
const edgeTypes = {
  uml: UMLRelationship,
  reactions: ReactionRelationship,
  'fine-granular-reaction': ReactionRelationship,
};

/** Smallest radius the Views circle can be dragged down to. */
const MIN_CIRCLE_RADIUS = 260;
/** Padding, in screen pixels, kept around the circle when fitting the view. */
const CIRCLE_FIT_PADDING = 60;

export interface FlowCanvasHandle {
  handleToolClick: (toolType: string, toolName: string, diagramType?: string) => void;
  loadDiagramData: (nodes: any[], edges: any[]) => void;
  getNodes: () => Node[];
  getEdges: () => Edge[];
  addEcoreFile: (fileName: string, fileContent: string, meta?: any) => void;
  updateEcoreFileData: (fileName: string, fileContent: string, ecoreFileId?: number) => void;
  resetExpandedFile: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  getReactionEdges: () => Edge[];
  getViewTypes: () => ViewType[];
  getWorkspaceSnapshot: () => WorkspaceSnapshot;
  autoLayoutEcoreBoxes: () => void;
  fitUmlView: () => void;
  openSelectedReactionEditor: () => boolean;
  establishBaseline: () => void;
}

interface FlowCanvasProps {
  onDiagramChange?: (nodes: Node[], edges: Edge[]) => void;
  onEcoreFileSelect?: (fileName: string) => void;
  onEcoreFileExpand?: (fileName: string, fileContent: string, meta?: {
    metaModelId?: number;
    metaModelSourceId?: number;
    ecoreFileId?: number;
  }) => void;
  onEcoreFileDelete?: (id: string) => void;
  onEcoreFileRename?: (id: string, newFileName: string) => void;
  userId?: string;
  vsumId?: string;
  umlModalOpen?: boolean;
  addReactionMode?: boolean;
  onReactionModeEnd?: () => void;
  onToggleReactionMode?: () => void;
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
  /** Rendered directly under the Modeling / View Types toggle (e.g. project tabs). */
  projectTabsBelowModeToggle?: React.ReactNode;
  /** Called when the user switches between Modeling / Constraints / Views / Metrics tabs. */
  onCanvasModeChange?: (mode: CanvasMode) => void;
  canvasMode?: CanvasMode;
  /** Node ID to highlight as the active constraint context (teal glow). */
  constraintHighlightNodeId?: string | null;
  /** Node ID currently selected as a constraint filter (stronger teal border). */
  constraintFilterNodeId?: string | null;
  /** Called when a node is clicked in constraints mode to toggle the filter. */
  onConstraintNodeFilter?: (nodeId: string | null) => void;
  /**
   * Persist the workspace (PUT /sync-changes). Used by the Low Code panel Save
   * after the form has been written to the store, so a reaction edit does not
   * require a second click on the toolbar floppy.
   */
  onSaveChanges?: () => void;
  /** When true, canvas is view-only (no edits, drag, connect, or delete). */
  readOnly?: boolean;
}

/**
 * High-level coordinator for the workspace canvas.
 *
 * Layout maths, edge construction, and the presentational chrome live in the
 * sibling `flowCanvas*` modules and `canvas/` components; what remains here is
 * canvas state, the wiring between ReactFlow and that state, and the imperative
 * handle the surrounding page drives the canvas through.
 */
export const FlowCanvas = forwardRef<FlowCanvasHandle, FlowCanvasProps>(
  function FlowCanvasComponent(
    {
      onDiagramChange,
      onEcoreFileSelect,
      onEcoreFileExpand,
      onEcoreFileDelete,
      onEcoreFileRename,
      userId,
      vsumId,
      umlModalOpen,
      addReactionMode,
      onReactionModeEnd,
      onToggleReactionMode,
      onHistoryChange,
      projectTabsBelowModeToggle,
      onCanvasModeChange,
      canvasMode: canvasModeProp = 'modeling',
      constraintHighlightNodeId,
      constraintFilterNodeId,
      onConstraintNodeFilter,
      onSaveChanges,
      readOnly = false,
    },
    ref,
  ) {
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
    // Ref mirror of reactFlowInstance – always current, safe to read from any closure or setTimeout
    const reactFlowInstanceRef = useRef<ReactFlowInstance | null>(null);

    const [isDragOver, setIsDragOver] = useState(false);
    const [isInteractive, setIsInteractive] = useState(!readOnly);
    const editable = !readOnly && isInteractive;

    const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
    const [expandedFileId, setExpandedFileId] = useState<string | null>(null);
    const [connectionDragState, setConnectionDragState] = useState<ConnectionDragState | null>(null);
    const [codeEditorState, setCodeEditorState] = useState<CodeEditorState | null>(null);
    const [routingStyle] = useState<'curved' | 'orthogonal'>('orthogonal');
    const [hoveredMergeGroup, setHoveredMergeGroup] = useState<string | null>(null);
    const [pendingDelete, setPendingDelete] = useState<PendingDeleteState | null>(null);
    const [detailModel, setDetailModel] = useState<{ model: any; ecoreContent: string } | null>(null);
    const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
    const [circleSelected, setCircleSelected] = useState(false);
    const [activeCanvasMode, setActiveCanvasMode] = useState<CanvasMode>(canvasModeProp);
    // Add-reaction mode: first clicked node becomes source, second creates the edge
    const [reactionSourceId, setReactionSourceId] = useState<string | null>(null);

    // Low Code reaction editor panel
    const [lowCodeEditorOpen, setLowCodeEditorOpen] = useState(false);
    const [lowCodeEditorDirty, setLowCodeEditorDirty] = useState(false);
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
    const [pendingFineConnection, setPendingFineConnection] = useState<{
      fineEdge: FlowEcoreEdge;
      existingFileId: number;
    } | null>(null);
    const lowCodeEditorRef = useRef<LowCodeReactionEditorHandle>(null);
    const selectedEdge = useSelectedEdgeStore((s) => s.selectedEdge);

    const circleVisible = activeCanvasMode === 'views';

    const {
      nodes,
      edges,
      onNodesChange: originalOnNodesChange,
      onEdgesChange,
      onConnect,
      addNode,
      addEdge,
      updateNodeLabel,
      removeNode,
      removeEdge,
      setNodes,
      setEdges,
      undo: undoFlow,
      redo: redoFlow,
      canUndo,
      canRedo,
      updateEdgeCode,
      setHistoryPaused,
      establishBaseline,
    } = useFlowState();

    const undo = useCallback(() => {
      const restored = undoFlow();
      if (restored) syncFineGranularStoreFromCanvas(restored.nodes, restored.edges);
    }, [undoFlow]);

    const redo = useCallback(() => {
      const restored = redoFlow();
      if (restored) syncFineGranularStoreFromCanvas(restored.nodes, restored.edges);
    }, [redoFlow]);

    const nodesRef = useRef(nodes);
    nodesRef.current = nodes;

    const [circle, setCircle] = useCircleContainment(nodes);
    const { viewTypes, addViewType, deleteViewType, updateAngle, unlinkNode } = useViewTypes(vsumId);
    const { getColorForPair } = useEdgeColorMap(userId, vsumId);

    // Ref flag: set just before setCircle() in autoLayoutEcoreBoxes so the effect
    // below can call fitViewToCircle once React has committed the new circle.
    const pendingFitToCircle = useRef(false);

    const handleShowDetails = useCallback((modelObj: any, fileContent: string) => {
      setDetailModel({ model: modelObj, ecoreContent: fileContent });
    }, []);

    const handleCloseDetails = useCallback(() => setDetailModel(null), []);

    // Unified delete handler — used by both keyboard Delete and context menu
    const handleRequestDelete = useCallback((nodeId: string) => {
      if (readOnly) return;
      setPendingDelete({ nodeIds: [], edgeIds: [], fileId: nodeId });
    }, [readOnly]);

    useEffect(() => {
      if (readOnly) setIsInteractive(false);
    }, [readOnly]);

    useEffect(() => {
      setActiveCanvasMode(canvasModeProp);
      if (canvasModeProp !== 'views') setCircleSelected(false);
    }, [canvasModeProp]);

    useEffect(() => {
      if (readOnly && activeCanvasMode === 'constraints') {
        setActiveCanvasMode('modeling');
        onCanvasModeChange?.('modeling');
      }
    }, [readOnly, activeCanvasMode, onCanvasModeChange]);

    // Pull stray nodes back inside the circle when Views mode is entered.
    useEffect(() => {
      if (!circleVisible) return;
      const displaced = clampAllNodesToCircle(nodes, circle);
      if (displaced.size > 0) {
        setNodes(prev => prev.map(n => {
          const newPos = displaced.get(n.id);
          return newPos ? { ...n, position: newPos } : n;
        }));
      }
      // Intentionally only re-runs when circle visibility toggles.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [circleVisible]);

    // ── Edge handles ──────────────────────────────────────────────────────────

    const recalculateEdgeHandles = useCallback(() => {
      if (!reactFlowInstance) return;
      const currentNodes = reactFlowInstance.getNodes();
      setEdges(currentEdges => currentEdges.map(edge => updateEdgeHandles(edge, currentNodes)));
    }, [reactFlowInstance, setEdges]);

    const bboxDraggingIdsRef = useRef<Set<string>>(new Set());

    const onNodesChange = useCallback((changes: any) => {
      if (readOnly && changes.some(isReadOnlyBlockedNodeChange)) return;

      const liveNodes = nodesRef.current;
      const clampedChanges = clampNodeChanges(changes, {
        circleVisible,
        umlModalOpen,
        circle,
        nodes: liveNodes,
      });

      const { isDragging, dragEnded } = getNodeDragFlags(clampedChanges);
      if (isDragging) setHistoryPaused(true);
      if (dragEnded) setHistoryPaused(false);

      for (const c of clampedChanges) {
        if (c.type !== 'position' || !c.id?.startsWith('bbox-')) continue;
        if (c.dragging === true) bboxDraggingIdsRef.current.add(c.id);
        if (c.dragging === false) bboxDraggingIdsRef.current.delete(c.id);
      }

      const extraChanges: any[] = [];
      const bboxUserDrag = bboxDraggingIdsRef.current.size > 0;

      if (bboxUserDrag) {
        for (const c of clampedChanges) {
          if (c.type !== 'position' || !c.position || c.dragging !== true) continue;
          if (!c.id?.startsWith('bbox-')) continue;
          const currentNode = liveNodes.find((n: any) => n.id === c.id);
          if (!currentNode) continue;
          const dx = c.position.x - currentNode.position.x;
          const dy = c.position.y - currentNode.position.y;
          if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) continue;
          for (const n of liveNodes) {
            if (
              (!isGhostNode(n) && n.type !== 'eobject')
              || n.data?.group !== c.id
            ) continue;
            extraChanges.push({
              type: 'position',
              id: n.id,
              position: { x: n.position.x + dx, y: n.position.y + dy },
              dragging: true,
            });
          }
        }
      } else {
        const predicted = new Map(liveNodes.map((n) => [n.id, n] as const));
        for (const c of clampedChanges) {
          if (c.type !== 'position' || !c.position) continue;
          const existing = predicted.get(c.id);
          if (existing) predicted.set(c.id, { ...existing, position: c.position });
        }

        const groups = new Set<string>();
        for (const c of clampedChanges) {
          if (c.type !== 'position' || !c.position) continue;
          const node = liveNodes.find((n) => n.id === c.id);
          if (node?.type === 'eobject' && node.data?.group) groups.add(node.data.group);
        }

        for (const groupId of groups) {
          const children = [...predicted.values()].filter(
            (n) => n.type === 'eobject' && n.data?.group === groupId,
          );
          const rect = computeBoundingBoxRect(children);
          if (!rect) continue;
          extraChanges.push({
            type: 'position',
            id: groupId,
            position: { x: rect.x, y: rect.y },
            dragging: false,
          });
          extraChanges.push({
            type: 'dimensions',
            id: groupId,
            dimensions: { width: rect.width, height: rect.height },
            updateStyle: true,
          });
        }
      }

      if (!bboxUserDrag) {
        const predicted = new Map(liveNodes.map((n) => [n.id, n] as const));
        for (const c of [...clampedChanges, ...extraChanges]) {
          const existing = predicted.get(c.id);
          if (!existing) continue;
          if (c.type === 'position' && c.position) {
            predicted.set(c.id, { ...existing, position: c.position });
          }
          if (c.type === 'dimensions' && c.dimensions) {
            predicted.set(c.id, {
              ...existing,
              width: c.dimensions.width,
              height: c.dimensions.height,
            });
          }
        }
        extraChanges.push(...ghostPositionChanges([...predicted.values()], edges));
      }

      originalOnNodesChange(
        extraChanges.length > 0 ? [...clampedChanges, ...extraChanges] : clampedChanges,
      );

      if (shouldCloseDetailOnBoxDrag(clampedChanges, detailModel, liveNodes)) {
        setDetailModel(null);
      }

      if (dragEnded) {
        bboxDraggingIdsRef.current.clear();
        setTimeout(recalculateEdgeHandles, 100);
        if (umlModalOpen) {
          setEdges(eds =>
            eds.map(e =>
              e.type === 'uml'
                ? { ...e, data: { ...e.data, customControlPoint: undefined } }
                : e,
            ),
          );
        }
      }
    }, [originalOnNodesChange, recalculateEdgeHandles, circle, circleVisible, umlModalOpen, detailModel, setEdges, setHistoryPaused, readOnly, edges]);

    const guardedOnEdgesChange = useCallback((changes: any) => {
      if (readOnly && changes.some(isReadOnlyBlockedEdgeChange)) return;
      onEdgesChange(changes);
    }, [onEdgesChange, readOnly]);

    const guardedOnConnect = useCallback((connection: any) => {
      if (readOnly) return;

      if (isReactionHandleConnection(connection)) {
        if (!validateFineGranularConnection(connection, nodes)) return;

        const sourceEObjectId = getProperEObjectIdFromHandle(connection.sourceHandle ?? '');
        const targetEObjectId = getProperEObjectIdFromHandle(connection.targetHandle ?? '');
        if (!sourceEObjectId || !targetEObjectId) return;

        const sourceNode = nodes.find(n => n.id === connection.source);
        const targetNode = nodes.find(n => n.id === connection.target);
        const fromModel =
          extractModelFromEObjectId(sourceEObjectId)
          || sourceNode?.data?.ecore?.model
          || '';
        const toModel =
          extractModelFromEObjectId(targetEObjectId)
          || targetNode?.data?.ecore?.model
          || '';
        if (!fromModel || !toModel) return;

        syncIdentifierMapFromCanvasNodes(nodes);

        const fromModelAlias =
          sourceNode?.data?.modelAlias
          || deriveDisplayModelAlias(sourceNode?.data?.label)
          || deriveModelAlias(fromModel);
        const toModelAlias =
          targetNode?.data?.modelAlias
          || deriveDisplayModelAlias(targetNode?.data?.label)
          || deriveModelAlias(toModel);

        const fineEdge = createFineGranularReactionEdge({
          sourceNodeId: connection.source!,
          targetNodeId: connection.target!,
          sourceHandleId: connection.sourceHandle ?? '',
          targetHandleId: connection.targetHandle ?? '',
          eObjectSourceId: sourceEObjectId,
          eObjectTargetId: targetEObjectId,
          fromModel,
          toModel,
          fromModelAlias,
          toModelAlias,
        });

        // Check if parent coarse relation already has a reaction file
        const inferredFileId = tryInferReactionFileIdForFineGranularReactionEdge(fineEdge);
        if (inferredFileId && inferredFileId > 0) {
          setPendingFineConnection({ fineEdge, existingFileId: inferredFileId });
          return;
        }

        addEdge(fineEdge);
        return;
      }

      onConnect(connection);
    }, [onConnect, readOnly, nodes, addEdge]);

    const edgeDistributionMap = useMemo(
      () => buildEdgeDistributionMap(nodes, edges),
      [nodes, edges],
    );

    const { onDrop, onDragOver } = useDragAndDrop({
      reactFlowInstance,
      reactFlowWrapper,
      addNode,
      addEdge,
    });

    useFlowCanvasKeyboardShortcuts({
      readOnly,
      nodes,
      edges,
      selectedFileId,
      umlModalOpen,
      canUndo,
      canRedo,
      undo,
      redo,
      setPendingDelete,
    });

    // ── Reaction edge creation ────────────────────────────────────────────────

    const uploadReactionFile = useCallback(async (
      sourceNodeId: string,
      targetNodeId: string,
    ): Promise<number | null> => {
      // Pad the content so two edges created in the same second are not
      // deduplicated into one stored file by the backend.
      const uniquePadding = ' '.repeat((Date.now() % 50) + 1);
      const initialContent = buildInitialReactionCode(nodes, sourceNodeId, targetNodeId) + uniquePadding;
      const fileName = `reaction-${Date.now()}.reactions`;
      const file = new File([initialContent], fileName, { type: 'text/plain;charset=utf-8' });

      try {
        const uploadResult = await apiService.uploadFile(file, 'REACTION');
        return resolveReactionFileId(uploadResult?.data);
      } catch (err) {
        console.error('Failed to create reaction file for new edge:', err);
        return null;
      }
    }, [nodes]);

    const commitReactionEdge = useCallback((newEdge: Edge) => {
      setEdges(prev => {
        const exists = prev.some(
          e => e.type === 'reactions' && e.source === newEdge.source && e.target === newEdge.target,
        );
        if (exists) return prev;
        return [...prev, newEdge];
      });
      globalThis.setTimeout(() => recalculateEdgeHandles(), 0);
    }, [setEdges, recalculateEdgeHandles]);

    const findEcoreTargetFromPointer = useCallback((
      clientX: number,
      clientY: number,
      sourceNodeId: string,
    ): Node | null => {
      const nodeEl = document.elementFromPoint(clientX, clientY)?.closest('.react-flow__node');
      if (nodeEl) {
        const id = (nodeEl as HTMLElement).dataset['id'];
        if (id && id !== sourceNodeId) {
          const hit = nodes.find(n => n.id === id && n.type === 'ecoreFile');
          if (hit) return hit;
        }
      }
      if (!reactFlowInstance) return null;
      const flowPosition = reactFlowInstance.screenToFlowPosition({ x: clientX, y: clientY });
      return findEcoreTargetAtPosition(nodes, flowPosition, sourceNodeId);
    }, [nodes, reactFlowInstance]);

    const handleConnectionEnd = useCallback(async (e: MouseEvent) => {
      if (readOnly) return;
      const dragState = connectionDragState;
      setConnectionDragState(null);

      if (!reactFlowInstance || !dragState?.isActive || !dragState.sourceNodeId) return;

      const sourceNodeId = dragState.sourceNodeId;
      const targetNode = findEcoreTargetFromPointer(e.clientX, e.clientY, sourceNodeId);
      if (!targetNode) return;

      const alreadyConnected = edges.some(
        edge => edge.source === sourceNodeId && edge.target === targetNode.id,
      );
      if (alreadyConnected) return;

      const sourceNode = nodes.find(n => n.id === sourceNodeId);
      if (!sourceNode) return;

      const color = getColorForPair(sourceNodeId, targetNode.id);
      const reactionFileId = await uploadReactionFile(sourceNodeId, targetNode.id);

      commitReactionEdge(buildReactionEdge({
        id: `edge-${sourceNodeId}-${targetNode.id}-${Date.now()}`,
        sourceNode,
        targetNode,
        color,
        data: { reactionFileId },
      }));
    }, [
      reactFlowInstance,
      nodes,
      edges,
      connectionDragState,
      getColorForPair,
      findEcoreTargetFromPointer,
      uploadReactionFile,
      commitReactionEdge,
      readOnly,
    ]);

    const handleConnectionMove = useCallback((e: MouseEvent) => {
      if (!reactFlowInstance) return;

      const flowPosition = reactFlowInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY });

      setConnectionDragState(prev => {
        if (!prev?.isActive) return prev;
        return { ...prev, currentPosition: flowPosition };
      });
    }, [reactFlowInstance]);

    useEffect(() => {
      if (!connectionDragState?.isActive) return;

      const handleMove = (e: any) => handleConnectionMove(e);
      const handleEnd = (e: any) => handleConnectionEnd(e);
      const captureOptions = { capture: true };

      document.addEventListener('pointermove', handleMove, captureOptions);
      document.addEventListener('pointerup', handleEnd, captureOptions);
      document.body.style.cursor = 'crosshair';

      return () => {
        document.removeEventListener('pointermove', handleMove, captureOptions);
        document.removeEventListener('pointerup', handleEnd, captureOptions);
        globalThis.removeEventListener('pointermove', handleMove, captureOptions);
        globalThis.removeEventListener('pointerup', handleEnd, captureOptions);
        document.body.style.cursor = '';
      };
    }, [connectionDragState?.isActive, handleConnectionMove, handleConnectionEnd]);

    const handleConnectionStart = useCallback((
      nodeId: string,
      handle: HandlePosition,
      tipScreenPos: { x: number; y: number },
    ) => {
      if (readOnly || !reactFlowInstance) return;

      // Convert the DOM screen position of the arrow tip to flow coordinates
      const flowTipPos = reactFlowInstance.screenToFlowPosition(tipScreenPos);

      setConnectionDragState({
        isActive: true,
        sourceNodeId: nodeId,
        sourceHandle: handle,
        currentPosition: flowTipPos,
        sourceTipPosition: flowTipPos,
      });
    }, [reactFlowInstance, readOnly]);

    const createReactionEdgeFromEvent = useCallback((detail: {
      sourceNodeId: string;
      targetNodeId: string;
      code: string;
      originalEdgeId: number;
    }) => {
      const { sourceNodeId, targetNodeId, code, originalEdgeId } = detail;

      const sourceNode = nodes.find(n => n.id === sourceNodeId);
      const targetNode = nodes.find(n => n.id === targetNodeId);
      if (!sourceNode || !targetNode) {
        console.warn('Could not find nodes for edge creation:', detail);
        return;
      }

      addEdge(buildReactionEdge({
        id: `edge-${sourceNodeId}-${targetNodeId}-${Date.now()}`,
        sourceNode,
        targetNode,
        color: getColorForPair(sourceNodeId, targetNodeId),
        data: { code, originalEdgeId },
      }));
    }, [nodes, addEdge, getColorForPair]);

    useReactionEdgeCreationEvents({ readOnly, createReactionEdgeFromEvent });

    const processRelation = useCallback((
      relation: MetaModelRelation,
      preserveExisting: boolean,
    ) => {
      const sourceNode = findNodeByMetaModelId(nodes, relation.sourceId);
      const targetNode = findNodeByMetaModelId(nodes, relation.targetId);

      if (!sourceNode || !targetNode) {
        console.warn('Could not find nodes for relation:', relation);
        return;
      }

      const existsByBackendId = edges.some(edge => edge.data?.backendRelationId === relation.id);
      if (existsByBackendId) return;

      const alreadyConnected = edges.some(
        edge => edge.type === 'reactions'
          && ((edge.source === sourceNode.id && edge.target === targetNode.id)
            || (edge.source === targetNode.id && edge.target === sourceNode.id)),
      );
      if (preserveExisting && alreadyConnected) return;

      addEdge(buildReactionEdge({
        id: `edge-backend-${relation.id}-${Date.now()}`,
        sourceNode,
        targetNode,
        color: getColorForPair(sourceNode.id, targetNode.id),
        data: {
          code: '',
          backendRelationId: relation.id,
          reactionFileId: relation.reactionFileId ?? null,
        },
      }));
    }, [nodes, edges, getColorForPair, addEdge]);

    useMetaModelRelationEvents({ processRelation });

    // ── Reaction code editor ──────────────────────────────────────────────────

    const handleEdgeDoubleClick = useCallback(async (edgeId: string) => {
      const edge = edges.find(e => e.id === edgeId);
      if (!edge) return;

      // Fine-granular reaction edges open the Low Code editor
      if (isFineGranularReactionEdge(edge)) {
        // Infer reaction file id from parent coarse relation if missing (commit 004 / c599c0a6)
        const fineEdge = edge as FlowEcoreEdge;
        if (!fineEdge.data?.reactionFileId) {
          const inferredId = tryInferReactionFileIdForFineGranularReactionEdge(fineEdge);
          if (inferredId !== undefined && fineEdge.data) {
            fineEdge.data.reactionFileId = inferredId;
          }
        }
        onFineGranularEdgeClick(fineEdge);
        setLowCodeEditorOpen(true);
        return;
      }

      // Coarse reaction edges open the Monaco editor
      const getFileName = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        return node?.type === 'ecoreFile' ? node.data.fileName : undefined;
      };

      const reactionFileId = edge.data?.reactionFileId;
      const initialCode = await fetchReactionCode(
        edge.data?.code || '',
        reactionFileId,
        () => buildInitialReactionCode(nodes, edge.source, edge.target),
      );

      setCodeEditorState({
        isOpen: true,
        edgeId,
        initialCode,
        sourceFileName: getFileName(edge.source),
        targetFileName: getFileName(edge.target),
        reactionFileId,
      });
    }, [edges, nodes]);

    const openSelectedReactionEditor = useCallback((): boolean => {
      const selected = edges.filter(e => e.selected && e.type === 'reactions');
      if (selected.length === 0) return false;
      void handleEdgeDoubleClick(selected[0].id);
      return true;
    }, [edges, handleEdgeDoubleClick]);

    const handleCloseCodeEditor = useCallback(() => setCodeEditorState(null), []);

    const handleSaveCode = useCallback(async (code: string) => {
      if (!codeEditorState?.edgeId) return;
      const edgeId = codeEditorState.edgeId;

      try {
        const reactionFileId = await persistReactionCode(code, codeEditorState.reactionFileId);

        updateEdgeCode(edgeId, code);
        setCodeEditorState(prev => (prev ? { ...prev, reactionFileId } : prev));

        setEdges(prev =>
          prev.map(edge =>
            edge.id === edgeId
              ? {
                ...edge,
                data: {
                  ...edge.data,
                  reactionFileId: reactionFileId ?? edge.data?.reactionFileId ?? null,
                  sourceMetaModelId:
                    getBackendMetaModelId(nodes, edge.source) ?? edge.data?.sourceMetaModelId,
                  targetMetaModelId:
                    getBackendMetaModelId(nodes, edge.target) ?? edge.data?.targetMetaModelId,
                  sourceMetaModelSourceId:
                    getMetaModelSourceId(nodes, edge.source) ?? edge.data?.sourceMetaModelSourceId,
                  targetMetaModelSourceId:
                    getMetaModelSourceId(nodes, edge.target) ?? edge.data?.targetMetaModelSourceId,
                },
              }
              : edge,
          ),
        );
      } catch (err) {
        console.error('Failed to save reaction file', err);
        throw err;
      }
    }, [codeEditorState, updateEdgeCode, setEdges, nodes]);

    const handleDeleteEdge = useCallback(() => {
      if (codeEditorState?.edgeId) {
        removeEdge(codeEditorState.edgeId);
        setCodeEditorState(null);
      }
    }, [codeEditorState, removeEdge]);

    // ── Imperative surface ────────────────────────────────────────────────────

    const handleToolClick = useCallback((toolType: string, toolName: string, diagramType?: string) => {
      if (!reactFlowInstance || !reactFlowWrapper.current) return;

      const canvasBounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = reactFlowInstance.project({
        x: canvasBounds.width / 2,
        y: canvasBounds.height / 2,
      });

      addNode({
        type: 'editable',
        position,
        data: {
          label: getToolLabel(toolType, toolName),
          toolType,
          toolName,
          diagramType,
        },
      });
    }, [reactFlowInstance, addNode]);

    const loadDiagramData = useCallback((newNodes: any[], newEdges: any[]) => {
      const nodesWithIds = uniquifyLoadedNodeIds(newNodes);
      const edgesWithUniqueIds = uniquifyLoadedEdgeIds(newEdges);

      setHistoryPaused(true);
      setNodes([]);
      setEdges([]);
      if (nodesWithIds.length > 0) setNodes(nodesWithIds);
      if (edgesWithUniqueIds.length > 0) setEdges(edgesWithUniqueIds);

      // Hydrate fine-granular reaction edges from store (if EObject nodes are present)
      try {
        const eobjectNodes = nodesWithIds.filter(
          (n: { type?: string }) => n.type === 'eobject' || n.type === 'ghost',
        );
        const ecoreFiles = nodesWithIds.filter((n: { type?: string }) => n.type === 'ecoreFile');
        const fineEdges = hydrateFineGranularReactionEdges(eobjectNodes, ecoreFiles);
        if (fineEdges.length > 0) {
          setEdges((eds) => mergeFineGranularEdges(eds, fineEdges));
        }
      } catch {
        // Store may not be initialized yet — skip hydration
      }

      // Reset undo baseline to the loaded diagram (not the pre-load empty state).
      requestAnimationFrame(() => {
        establishBaseline({ nodes: nodesWithIds, edges: edgesWithUniqueIds });
        setHistoryPaused(false);
      });
    }, [setNodes, setEdges, setHistoryPaused, establishBaseline]);

    const getReactionEdges = useCallback(
      () => edges.filter(e => e.type === 'reactions'),
      [edges],
    );

    const getWorkspaceSnapshot = useCallback(
      (): WorkspaceSnapshot => {
        syncIdentifierMapFromCanvasNodes(nodes);
        syncFineGranularStoreFromCanvas(nodes, edges);
        let storeSnapshot: WorkspaceSnapshot | null = null;
        if (hasActiveVsumDetailsStore()) {
          try {
            storeSnapshot = new ActiveVsumDetails().getAsWorkspaceSnapshot();
          } catch {
            storeSnapshot = null;
          }
        }
        return buildWorkspaceSnapshot(nodes, edges, storeSnapshot);
      },
      [nodes, edges],
    );

    // ── Drag & drop ───────────────────────────────────────────────────────────

    const handleDragOver = useCallback((event: React.DragEvent) => {
      onDragOver(event);
      setIsDragOver(true);
    }, [onDragOver]);

    const handleDragLeave = useCallback(() => setIsDragOver(false), []);

    const handleDrop = useCallback((event: React.DragEvent) => {
      setIsDragOver(false);
      if (readOnly) return;
      onDrop(event);
    }, [onDrop, readOnly]);

    const handleLabelChange = useCallback((id: string, newLabel: string) => {
      if (readOnly) return;
      updateNodeLabel(id, newLabel);
    }, [updateNodeLabel, readOnly]);

    // ── Viewport ──────────────────────────────────────────────────────────────

    // Reads reactFlowInstanceRef so it stays correct when called from a timeout.
    const fitUmlView = useCallback(() => {
      const inst = reactFlowInstanceRef.current;
      if (!inst) return;
      const umlNodes = inst.getNodes().filter(n => n.type === 'editable');
      if (umlNodes.length === 0) return;
      const focusNodes = pickFocusUmlFlowNodes(umlNodes);
      inst.fitView({
        padding: 0.18,
        minZoom: 0.45,
        maxZoom: 1.1,
        duration: 200,
        nodes: focusNodes.length > 0 ? focusNodes : umlNodes,
      });
    }, []);

    const fitEcoreWorkspace = useCallback(() => {
      const inst = reactFlowInstanceRef.current;
      if (!inst) return;
      const ecoreOnly = inst.getNodes().filter(n => n.type === 'ecoreFile');
      if (ecoreOnly.length === 0) return;
      inst.fitView({
        padding: 0.25,
        minZoom: 0.2,
        maxZoom: 1.2,
        duration: 250,
        nodes: ecoreOnly,
      });
    }, []);

    const fitViewToCircle = useCallback((c: Circle) => {
      const inst = reactFlowInstanceRef.current;
      if (!inst || !reactFlowWrapper.current) return;
      const { width, height } = reactFlowWrapper.current.getBoundingClientRect();
      if (!width || !height) return;

      const zoom = Math.min(
        (width - CIRCLE_FIT_PADDING * 2) / (c.r * 2),
        (height - CIRCLE_FIT_PADDING * 2) / (c.r * 2),
      );
      const clampedZoom = Math.min(Math.max(zoom, 0.05), 2);

      inst.setViewport({
        x: width / 2 - c.cx * clampedZoom,
        y: height / 2 - c.cy * clampedZoom,
        zoom: clampedZoom,
      }, { duration: 300 });
    }, []); // no deps – reads refs directly, always fresh

    // After autoLayoutEcoreBoxes sets a new circle, fit the view once React has committed it.
    useEffect(() => {
      if (!pendingFitToCircle.current) return;
      pendingFitToCircle.current = false;
      fitViewToCircle(circle);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [circle]);

    const handleCircleResizePreview = useCallback((newR: number) => {
      if (!reactFlowInstance || !reactFlowWrapper.current) return;
      const { width, height } = reactFlowWrapper.current.getBoundingClientRect();

      const zoom = Math.min(
        (width - CIRCLE_FIT_PADDING * 2) / (newR * 2),
        (height - CIRCLE_FIT_PADDING * 2) / (newR * 2),
      );
      const clampedZoom = Math.min(Math.max(zoom, 0.05), 2);

      reactFlowInstance.setViewport({
        x: width / 2 - circle.cx * clampedZoom,
        y: height / 2 - circle.cy * clampedZoom,
        zoom: clampedZoom,
      });
    }, [reactFlowInstance, circle.cx, circle.cy]);

    const handleCircleResize = useCallback((newR: number) => {
      if (readOnly) return;
      const newCircle: Circle = { ...circle, r: Math.max(MIN_CIRCLE_RADIUS, newR) };
      setCircle(newCircle);

      const displaced = clampAllNodesToCircle(nodes, newCircle);
      if (displaced.size > 0) {
        setNodes(prev => prev.map(n => {
          const newPos = displaced.get(n.id);
          return newPos ? { ...n, position: newPos } : n;
        }));
      }
      fitViewToCircle(newCircle);
    }, [readOnly, circle, setCircle, nodes, setNodes, fitViewToCircle]);

    const handleAddViewType = useCallback((
      label: string,
      scope: ViewTypeScope,
      linkedNodeIds: string[],
      angle: number,
      viewTypeEditable: boolean,
    ) => {
      if (readOnly) return;
      addViewType({ label, scope, angle, linkedNodeIds, editable: viewTypeEditable });
    }, [addViewType, readOnly]);

    // ── Auto-layout ───────────────────────────────────────────────────────────

    const autoLayoutEcoreBoxes = useCallback(() => {
      const ecoreOnly = nodes.filter(n => n.type === 'ecoreFile');
      if (ecoreOnly.length === 0) return;

      const positionMap = computeAutoLayoutPositions(ecoreOnly, edges);
      const updatedNodes = applyAutoLayoutPositions(nodes, positionMap);
      setNodes(updatedNodes);

      // Re-point the edges and recentre once the moved nodes have committed.
      // pendingFitToCircle signals the effect above to fit after the circle lands.
      setTimeout(() => {
        setEdges(optimizeEdgeHandles(updatedNodes, edges));

        const newCircle = computeInitialCircle(updatedNodes.filter(n => n.type === 'ecoreFile'));
        pendingFitToCircle.current = true;
        setCircle(newCircle);
      }, 50);
    }, [nodes, edges, setNodes, setEdges, setCircle]);

    useWorkspaceLayoutEvents({ autoLayoutEcoreBoxes, fitEcoreWorkspace });

    // ── Ecore file lifecycle ──────────────────────────────────────────────────

    const handleEcoreFileSelect = useCallback((fileName: string) => {
      const ecoreNode = nodes.find(n => n.type === 'ecoreFile' && n.data.fileName === fileName);
      if (!ecoreNode) return;

      const action = resolveEcoreFileSelectAction({
        ecoreNode,
        fileName,
        addReactionMode,
        readOnly,
        reactionSourceId,
        activeCanvasMode,
        constraintFilterNodeId,
      });

      switch (action.kind) {
        case 'handled':
          return;
        case 'set-reaction-source':
          setReactionSourceId(ecoreNode.id);
          return;
        case 'clear-reaction-source':
          setReactionSourceId(null);
          return;
        case 'create-reaction-edge': {
          const sourceNode = nodes.find(n => n.id === action.sourceId);
          if (sourceNode) {
            const color = getColorForPair(sourceNode.id, action.targetNode.id);
            commitReactionEdge(buildReactionEdgeFromNodes(sourceNode, action.targetNode, color));
          }
          setReactionSourceId(null);
          onReactionModeEnd?.();
          return;
        }
        case 'toggle-constraint-filter':
          onConstraintNodeFilter?.(
            constraintFilterNodeId === action.nodeId ? null : action.nodeId,
          );
          return;
        case 'select':
          setSelectedFileId(action.nodeId);
          onEcoreFileSelect?.(action.fileName);
      }
    }, [nodes, onEcoreFileSelect, addReactionMode, reactionSourceId, getColorForPair, commitReactionEdge, onReactionModeEnd, activeCanvasMode, onConstraintNodeFilter, constraintFilterNodeId, readOnly]);

    // Clear reaction source when mode is toggled off
    useEffect(() => {
      if (!addReactionMode) setReactionSourceId(null);
    }, [addReactionMode]);

    const ecoreIdentifierKey = useMemo(
      () =>
        nodes
          .filter(n => n.type === 'ecoreFile')
          .map(n => `${n.data?.nsUri ?? ''}:${n.data?.metaModelSourceId ?? n.data?.metaModelId ?? ''}`)
          .join('|'),
      [nodes],
    );

    useEffect(() => {
      syncIdentifierMapFromCanvasNodes(nodesRef.current);
    }, [ecoreIdentifierKey]);

    // Sync addReactionMode with project store mode + CSS toggle + node expansion
    const vsumPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
    // offset = reactionPosition - vsumPosition (per bbox id)
    const reactionOffsetsRef = useRef<Map<string, { dx: number; dy: number }>>(new Map());
    useEffect(() => {
      if (addReactionMode) {
        useProjectStore.getState().setMode('reactions');
        enableReactionHandles();
        enableReactionEdges();

        // Expand all ecoreFile nodes into EObject nodes with bounding boxes
        const ecoreNodes = nodes.filter((n) => n.type === 'ecoreFile');
        const alreadyExpanded = nodes.some((n) => n.type === 'boundingBox');
        if (ecoreNodes.length > 0 && !alreadyExpanded) {
          // Remember VSUM positions
          for (const ecoreNode of ecoreNodes) {
            vsumPositionsRef.current.set(ecoreNode.id, { ...ecoreNode.position });
          }

          const newNodes: any[] = [];

          // First pass: expand each model at its ecoreFile position
          const expandResults: Array<{ ecoreId: string; result: any }> = [];
          for (const ecoreNode of ecoreNodes) {
            const fileContent = ecoreNode.data?.fileContent;
            const fileName = ecoreNode.data?.fileName;
            if (!fileContent || !fileName) continue;

            const origin = { x: ecoreNode.position.x, y: ecoreNode.position.y };
            const result = expandMetaModelToNodes(
              fileContent,
              fileName,
              origin,
              ecoreNode.data?.domain,
              metaModelDisplayColor(ecoreNode.data?.domain, fileName),
            );
            if (!result) continue;
            expandResults.push({ ecoreId: ecoreNode.id, result });
          }

          // Second pass: resolve overlaps — only shift minimally
          for (let i = 1; i < expandResults.length; i++) {
            const cur = expandResults[i].result.boundingBox;
            const curW = (cur.style?.width as number) ?? 400;
            const curH = (cur.style?.height as number) ?? 300;

            for (let j = 0; j < i; j++) {
              const prev = expandResults[j].result.boundingBox;
              const prevW = (prev.style?.width as number) ?? 400;
              const prevH = (prev.style?.height as number) ?? 300;

              const overlapX = cur.position.x < prev.position.x + prevW + 20
                && cur.position.x + curW > prev.position.x - 20;
              const overlapY = cur.position.y < prev.position.y + prevH + 20
                && cur.position.y + curH > prev.position.y - 20;

              if (overlapX && overlapY) {
                const shiftX = (prev.position.x + prevW + 30) - cur.position.x;
                cur.position = { x: cur.position.x + shiftX, y: cur.position.y };
                for (const eNode of expandResults[i].result.eObjectNodes) {
                  eNode.position = { x: eNode.position.x + shiftX, y: eNode.position.y };
                }
                for (const ghost of expandResults[i].result.ghostNodes ?? []) {
                  ghost.position = { x: ghost.position.x + shiftX, y: ghost.position.y };
                }
              }
            }
          }

          // Store offsets: offset = bboxPosition - vsumPosition
          reactionOffsetsRef.current.clear();
          for (const { ecoreId, result } of expandResults) {
            const vsumPos = vsumPositionsRef.current.get(ecoreId);
            if (vsumPos) {
              reactionOffsetsRef.current.set(result.boundingBox.id, {
                dx: result.boundingBox.position.x - vsumPos.x,
                dy: result.boundingBox.position.y - vsumPos.y,
              });
            }
          }

          const intraModelEdges: any[] = [];
          for (const { result } of expandResults) {
            newNodes.push(result.boundingBox);
            newNodes.push(...result.eObjectNodes);
            newNodes.push(...(result.ghostNodes ?? []));
            intraModelEdges.push(...(result.umlEdges ?? []));
          }

          if (newNodes.length > 0) {
            setNodes((nds) => [
              ...nds.map((n) => n.type === 'ecoreFile' ? { ...n, hidden: true } : n),
              ...newNodes,
            ]);
            syncIdentifierMapFromCanvasNodes(nodes);
            const endpointNodes = newNodes.filter(
              (n) => n.type === 'eobject' || n.type === 'ghost',
            );
            const ecoreFiles = nodes.filter((n) => n.type === 'ecoreFile');
            const fineEdges = hydrateFineGranularReactionEdges(endpointNodes, ecoreFiles);
            setEdges((eds) => {
              const withIntra = intraModelEdges.length > 0 ? [...eds, ...intraModelEdges] : eds;
              return fineEdges.length > 0 ? mergeFineGranularEdges(withIntra, fineEdges) : withIntra;
            });
          }
        }
      } else {
        const current = useProjectStore.getState().mode;
        if (current === 'reactions') {
          useProjectStore.getState().setMode('workspace');
        }
        disableReactionHandles();
        disableReactionEdges();

        // Collapse: convert reaction positions back to VSUM positions using offset
        setEdges((eds) => eds.filter(
          (e) => e.type !== 'fine-granular-reaction' && !isIntraModelUmlEdge(e),
        ));
        setNodes((nds) => {
          // Get current bbox positions to derive updated VSUM positions
          const bboxPositions = new Map<string, { x: number; y: number }>();
          for (const n of nds) {
            if (n.type === 'boundingBox') {
              bboxPositions.set(n.id, n.position);
            }
          }

          return nds
            .filter((n) => n.type !== 'eobject' && n.type !== 'boundingBox' && n.type !== 'ghost')
            .map((n) => {
              if (n.type !== 'ecoreFile') return n;
              const nsUri = n.data?.nsUri;
              const bboxId = nsUri ? `bbox-${nsUri}` : null;
              const bboxPos = bboxId ? bboxPositions.get(bboxId) : null;
              const offset = bboxId ? reactionOffsetsRef.current.get(bboxId) : null;

              let newPos = n.position;
              if (bboxPos && offset) {
                // vsumPosition = reactionPosition - offset
                newPos = { x: bboxPos.x - offset.dx, y: bboxPos.y - offset.dy };
              }

              // Also update the saved vsum position for next toggle
              vsumPositionsRef.current.set(n.id, newPos);

              return { ...n, hidden: false, position: newPos };
            });
        });
      }
    }, [addReactionMode]); // eslint-disable-line react-hooks/exhaustive-deps

    // Close Low Code editor when selected edge is cleared
    useEffect(() => {
      if (!selectedEdge) setLowCodeEditorOpen(false);
    }, [selectedEdge]);

    // Notify parent whenever undo/redo availability changes
    useEffect(() => {
      onHistoryChange?.(canUndo, canRedo);
    }, [canUndo, canRedo, onHistoryChange]);

    const handleEcoreFileExpand = useCallback((fileName: string, fileContent: string) => {
      const ecoreNode = nodes.find(n => n.type === 'ecoreFile' && n.data.fileName === fileName);

      if (ecoreNode) {
        setExpandedFileId(ecoreNode.id);
        setSelectedFileId(ecoreNode.id);
      }

      const data = ecoreNode?.data;
      onEcoreFileExpand?.(fileName, fileContent, {
        metaModelId: typeof data?.metaModelId === 'number' ? data.metaModelId : undefined,
        metaModelSourceId: typeof data?.metaModelSourceId === 'number' ? data.metaModelSourceId : undefined,
        ecoreFileId: typeof data?.ecoreFileId === 'number' ? data.ecoreFileId : undefined,
      });
    }, [nodes, onEcoreFileExpand]);

    const updateEcoreFileData = useCallback((
      fileName: string,
      fileContent: string,
      ecoreFileId?: number,
    ) => {
      setNodes(current =>
        current.map(n =>
          n.type === 'ecoreFile' && n.data.fileName === fileName
            ? {
              ...n,
              data: {
                ...n.data,
                fileContent,
                ...(ecoreFileId == null ? {} : { ecoreFileId }),
              },
            }
            : n,
        ),
      );
    }, [setNodes]);

    const resetExpandedFile = useCallback(() => {
      setExpandedFileId(null);
      setNodes(current =>
        current.map(n =>
          n.type === 'ecoreFile'
            ? { ...n, data: { ...n.data, isExpanded: false } }
            : n,
        ),
      );
    }, [setNodes]);

    const addEcoreFile = useCallback((fileName: string, fileContent: string, meta?: any) => {
      if (readOnly && !meta?.fromServerLoad) return;

      const ecoreNodes = nodesRef.current.filter(n => n.type === 'ecoreFile');
      const metaModelId = typeof meta?.metaModelId === 'number' ? meta.metaModelId : undefined;
      const metaModelSourceId = typeof meta?.metaModelSourceId === 'number'
        ? meta.metaModelSourceId
        : metaModelId;

      const alreadyOnCanvas = metaModelId != null && ecoreNodes.some(
        n => n.data?.metaModelId === metaModelId || n.data?.metaModelSourceId === metaModelSourceId,
      );
      if (alreadyOnCanvas) return;

      const newEcoreNode: Node = {
        id: `ecore-${meta?.metaModelId ?? meta?.metaModelSourceId ?? Date.now()}`,
        type: 'ecoreFile',
        position: findFreeEcorePosition(ecoreNodes, meta?.position ?? { x: 60, y: 60 }),
        data: {
          fileName,
          fileContent,
          nsUri: extractNsUriFromEcore(fileContent),
          description: meta?.description,
          keywords: meta?.keywords,
          domain: meta?.domain,
          createdAt: meta?.createdAt || new Date().toISOString(),
          metaModelId,
          metaModelSourceId,
          ecoreFileId: typeof meta?.ecoreFileId === 'number' ? meta.ecoreFileId : undefined,
          genModelFileId: typeof meta?.genModelFileId === 'number' ? meta.genModelFileId : undefined,
          onExpand: handleEcoreFileExpand,
          onSelect: handleEcoreFileSelect,
          onDelete: onEcoreFileDelete,
          onRequestDelete: handleRequestDelete,
          onRename: onEcoreFileRename,
          onShowDetails: handleShowDetails,
          isExpanded: false,
        },
        draggable: true,
      };

      addNode(newEcoreNode);
      setSelectedFileId(newEcoreNode.id);
      onEcoreFileSelect?.(fileName);

      // If in reaction mode, immediately expand into eobject + boundingBox nodes
      if (addReactionMode && fileContent) {
        const origin = nextBoundingBoxOrigin(nodesRef.current);
        const result = expandMetaModelToNodes(
          fileContent,
          fileName,
          origin,
          meta?.domain,
          metaModelDisplayColor(meta?.domain, fileName),
        );
        if (result) {
          setNodes((nds) => {
            const hidden = nds.map((n) =>
              n.id === newEcoreNode.id ? { ...n, hidden: true } : n,
            );
            return [
              ...hidden,
              result.boundingBox,
              ...result.eObjectNodes,
              ...(result.ghostNodes ?? []),
            ];
          });
          syncIdentifierMapFromCanvasNodes([...nodesRef.current, newEcoreNode]);
          const fineEdges = hydrateFineGranularReactionEdges(
            [...result.eObjectNodes, ...(result.ghostNodes ?? [])],
            [...nodesRef.current, newEcoreNode],
          );
          setEdges((eds) => {
            const withIntra = result.umlEdges?.length
              ? [...eds, ...result.umlEdges]
              : eds;
            return fineEdges.length > 0 ? mergeFineGranularEdges(withIntra, fineEdges) : withIntra;
          });
        }
      }
    }, [addNode, handleEcoreFileExpand, handleEcoreFileSelect, onEcoreFileSelect, onEcoreFileDelete, onEcoreFileRename, handleRequestDelete, handleShowDetails, readOnly, addReactionMode, setNodes, setEdges]);

    // ── Edge hygiene ──────────────────────────────────────────────────────────

    useEffect(() => {
      onDiagramChange?.(nodes, edges);
    }, [nodes, edges, onDiagramChange]);

    useEffect(() => {
      if (!nodes.length || !edges.length) return;
      const filteredEdges = removeOrphanEdges(nodes, edges);
      if (filteredEdges.length !== edges.length) setEdges(filteredEdges);
    }, [nodes, edges, setEdges]);

    useEffect(() => {
      if (!edges.length) return;
      const fixedEdges = dedupeEdgeIds(edges);
      if (fixedEdges) setEdges(fixedEdges);
    }, [edges, setEdges]);

    // ── Edge interaction ──────────────────────────────────────────────────────

    const updateEdgeControlPoint = useCallback((
      edgeId: string,
      controlPoint: { x: number; y: number } | null,
    ) => {
      setEdges(prevEdges => prevEdges.map(edge =>
        edge.id === edgeId
          ? { ...edge, data: { ...edge.data, customControlPoint: controlPoint } }
          : edge,
      ));
    }, [setEdges]);

    useEdgeControlPointEvents({ reactFlowInstance, updateEdgeControlPoint });
    useEdgeSelectionEvents({ setEdges, setNodes, setSelectedFileId });

    const handleEdgeHandleChange = useCallback((
      edgeId: string,
      newSourceHandle: string,
      newTargetHandle: string,
    ) => {
      if (readOnly) return;
      setEdges(prevEdges => prevEdges.map(edge =>
        edge.id === edgeId
          ? {
            ...edge,
            sourceHandle: newSourceHandle,
            targetHandle: newTargetHandle,
            data: { ...edge.data, customControlPoint: undefined },
          }
          : edge,
      ));
    }, [setEdges, readOnly]);

    const handleEdgeReorderRequest = useCallback((
      edgeId: string,
      controlPoint: { x: number; y: number },
    ) => {
      if (readOnly) return;
      setEdges(prevEdges => computeParallelEdgeReorder(prevEdges, { edgeId, controlPoint, nodes }));
    }, [setEdges, nodes, readOnly]);

    const handleMergeGroupHover = useCallback((groupId: string | null) => {
      setHoveredMergeGroup(groupId);
    }, []);

    const handleEdgeDragStart = useCallback((_edgeId: string) => {}, []);

    const handleEdgeDrag = useCallback((_edgeId: string, _point: { x: number; y: number }) => {}, []);

    const handleEdgeDragEnd = useCallback((edgeId: string, point: { x: number; y: number }) => {
      updateEdgeControlPoint(edgeId, point);
    }, [updateEdgeControlPoint]);

    // ── Imperative handle ─────────────────────────────────────────────────────

    useImperativeHandle(ref, () => ({
      handleToolClick,
      loadDiagramData,
      getNodes: () => nodes,
      getEdges: () => edges,
      addEcoreFile,
      updateEcoreFileData,
      resetExpandedFile,
      undo,
      redo,
      canUndo,
      canRedo,
      getReactionEdges,
      getViewTypes: () => viewTypes,
      getWorkspaceSnapshot,
      autoLayoutEcoreBoxes,
      fitUmlView,
      openSelectedReactionEditor,
      establishBaseline,
    }), [handleToolClick, loadDiagramData, nodes, edges, viewTypes, addEcoreFile, updateEcoreFileData, resetExpandedFile, undo, redo, canUndo, canRedo, getReactionEdges, getWorkspaceSnapshot, autoLayoutEcoreBoxes, fitUmlView, openSelectedReactionEditor, establishBaseline]);

    // ── Render mapping ────────────────────────────────────────────────────────

    const mappedNodes = nodes.map(node => {
      if (node.type === 'editable') {
        return mapEditableFlowNode(node, readOnly, handleLabelChange, removeNode);
      }
      if (node.type === 'ecoreFile') {
        return mapEcoreFlowNode(node, {
          readOnly,
          expandedFileId,
          selectedFileId,
          connectionDragState,
          addReactionMode,
          reactionSourceId,
          constraintHighlightNodeId,
          constraintFilterNodeId,
          edgeDistribution: edgeDistributionMap.get(node.id),
          handleEcoreFileExpand,
          handleEcoreFileSelect,
          onEcoreFileDelete,
          handleRequestDelete,
          onEcoreFileRename,
          handleShowDetails,
          handleConnectionStart: readOnly ? undefined : handleConnectionStart,
        });
      }
      return node;
    });

    const uniqueEdges = useMemo(() => withUniqueEdgeIds(edges), [edges]);

    const umlMergeData = useMemo(
      () => computeUmlMergeData(uniqueEdges, nodes),
      [uniqueEdges, nodes],
    );

    const resolveEdgeDistribution = useCallback(
      (edge: Edge) => getEdgeDistributionData(edge, edgeDistributionMap),
      [edgeDistributionMap],
    );

    const resolveUmlMergeInfo = useCallback(
      (edge: Edge) => getUmlMergeInfo(edge, umlMergeData),
      [umlMergeData],
    );

    const fineParallelMap = useMemo(
      () => indexFineReactionParallels(uniqueEdges),
      [uniqueEdges],
    );

    const resolveFineParallel = useCallback(
      (edge: Edge) => fineParallelMap.get(edge.id),
      [fineParallelMap],
    );

    const edgeMapContext = useMemo(() => ({
      readOnly,
      routingStyle,
      hoveredMergeGroup,
      getDistribution: resolveEdgeDistribution,
      getUmlMerge: resolveUmlMergeInfo,
      handleMergeGroupHover,
      handleEdgeDoubleClick,
      handleEdgeDragStart,
      handleEdgeDrag,
      handleEdgeDragEnd,
      handleEdgeHandleChange,
      handleEdgeReorderRequest,
      getFineParallel: resolveFineParallel,
    }), [
      readOnly,
      routingStyle,
      hoveredMergeGroup,
      resolveEdgeDistribution,
      resolveUmlMergeInfo,
      handleMergeGroupHover,
      handleEdgeDoubleClick,
      handleEdgeDragStart,
      handleEdgeDrag,
      handleEdgeDragEnd,
      handleEdgeHandleChange,
      handleEdgeReorderRequest,
      resolveFineParallel,
    ]);

    const mappedEdges = useMemo(
      () => uniqueEdges.map(edge => mapFlowCanvasEdge(edge, edgeMapContext)),
      [uniqueEdges, edgeMapContext],
    );

    const ecoreNodes = nodes.filter(n => n.type === 'ecoreFile');
    const connectionLinePositions = computeConnectionLinePositions(connectionDragState, reactFlowInstance);
    const umlViewActive = !!umlModalOpen;
    const interactionsAllowed = umlViewActive || readOnly || isInteractive;
    // Viewers can reposition nodes to read a large model; they still cannot
    // create, delete, connect, rename, or save anything.
    const nodesMovable = umlViewActive || readOnly || (editable && !connectionDragState?.isActive);

    const handleSelectCanvasMode = useCallback((mode: CanvasMode) => {
      setActiveCanvasMode(mode);
      onCanvasModeChange?.(mode);
      if (mode !== 'views') setCircleSelected(false);
    }, [onCanvasModeChange]);

    return (
      <div
        ref={reactFlowWrapper}
        style={{
          flexGrow: 1,
          height: '100%',
          position: 'relative',
          border: isDragOver ? '3px dashed #3498db' : 'none',
          transition: 'border 0.2s ease',
          cursor: getReactionModeCursor(addReactionMode, reactionSourceId),
        }}
      >
        <ReactFlow
          nodes={mappedNodes}
          edges={mappedEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={guardedOnEdgesChange}
          onConnect={guardedOnConnect}
          connectionMode={ConnectionMode.Loose}
          connectionRadius={28}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onInit={instance => {
            setReactFlowInstance(instance);
            reactFlowInstanceRef.current = instance;
            setViewport(instance.getViewport());
          }}
          onMove={(_event, vp) => setViewport(vp)}
          nodesDraggable={nodesMovable}
          nodesConnectable={!umlViewActive && editable}
          elementsSelectable={interactionsAllowed}
          edgesUpdatable={false}
          edgesFocusable={interactionsAllowed}
          panOnDrag={interactionsAllowed}
          panOnScroll={interactionsAllowed}
          zoomOnScroll={interactionsAllowed}
          zoomOnPinch={interactionsAllowed}
          minZoom={umlViewActive ? 0.45 : 0.05}
          maxZoom={umlViewActive ? 2.5 : 2}
          translateExtent={[[-12000, -12000], [12000, 12000]]}
          selectNodesOnDrag={false}
          onPaneClick={() => {
            setDetailModel(null);
            setSelectedFileId(null);
            setCircleSelected(false);
            setNodes(nds => nds.map(n => ({ ...n, selected: false })));
            setEdges(eds => eds.map(e => ({ ...e, selected: false })));
            if (addReactionMode) {
              setReactionSourceId(null);
            }
          }}
        >
          <Background color="var(--v-workspace-dot)" gap={24} size={0.75} />
        </ReactFlow>

        {circleVisible && !umlModalOpen && (
          <CircleOverlay
            circle={circle}
            viewport={viewport}
            selected={circleSelected}
            containerRef={reactFlowWrapper}
            onSelect={() => {
              setCircleSelected(true);
              fitViewToCircle(circle);
            }}
            onResize={handleCircleResize}
            onResizePreview={handleCircleResizePreview}
            onResizeEnd={() => { }}
            viewTypes={viewTypes}
            ecoreNodes={ecoreNodes}
            onAddViewType={handleAddViewType}
            onDeleteViewType={readOnly ? () => {} : deleteViewType}
            onUpdateViewTypeAngle={readOnly ? () => {} : updateAngle}
            onUnlinkNode={readOnly ? () => {} : unlinkNode}
          />
        )}

        {connectionLinePositions && (
          <ConnectionLine
            sourcePosition={connectionLinePositions.source}
            targetPosition={connectionLinePositions.target}
          />
        )}

        <CanvasMinimap
          nodes={nodes}
          edges={edges}
          circle={circleVisible ? circle : undefined}
          viewport={viewport}
          containerW={reactFlowWrapper.current?.clientWidth ?? 800}
          containerH={reactFlowWrapper.current?.clientHeight ?? 600}
          width={200}
          height={204}
        />

        <CanvasModeToggle
          activeCanvasMode={activeCanvasMode}
          onSelectMode={handleSelectCanvasMode}
          readOnly={readOnly}
          projectTabsBelowModeToggle={projectTabsBelowModeToggle}
        />

        <CanvasControls
          onZoomIn={() => reactFlowInstance?.zoomIn?.()}
          onZoomOut={() => reactFlowInstance?.zoomOut?.()}
          onFitView={() => fitViewToCircle(circle)}
          onToggleInteractive={() => setIsInteractive(prev => !prev)}
          isInteractive={isInteractive}
          readOnly={readOnly}
        />

        {isDragOver && <CanvasDropOverlay />}

        {codeEditorState && (
          <ReactionEditorModal
            state={codeEditorState}
            onClose={handleCloseCodeEditor}
            onSave={readOnly ? async () => {} : handleSaveCode}
            onDelete={readOnly ? undefined : handleDeleteEdge}
            vsumId={vsumId}
            readOnly={readOnly}
          />
        )}

        <ConfirmDialog
          isOpen={pendingDelete !== null}
          title="Remove from canvas"
          message={getPendingDeleteConfirmMessage(pendingDelete)}
          confirmText="Remove"
          cancelText="Cancel"
          variant="danger"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            if (!pendingDelete) return;
            applyPendingCanvasDelete(
              pendingDelete,
              removeEdge,
              removeNode,
              onEcoreFileDelete,
              () => setSelectedFileId(null),
            );
            setPendingDelete(null);
          }}
        />

        {detailModel && (
          <ModelDetailOverlay
            model={detailModel.model}
            ecoreContent={detailModel.ecoreContent}
            onClose={handleCloseDetails}
          />
        )}

        {/* Low Code reaction editor panel */}
        {lowCodeEditorOpen && selectedEdge && (
          <DragablePanel
            title="Low Code Reaction"
            onClose={() => {
              setLowCodeEditorOpen(false);
              setLowCodeEditorDirty(false);
              useSelectedEdgeStore.getState().clearSelectedEdge();
            }}
            onSave={() => lowCodeEditorRef.current?.save()}
            onDelete={() => setConfirmDeleteOpen(true)}
            saveHighlighted={lowCodeEditorDirty}
            showDelete
          >
            <LowCodeReactionEditor
              ref={lowCodeEditorRef}
              edge={selectedEdge}
              onDirtyChange={setLowCodeEditorDirty}
              onSaveComplete={() => {
                setLowCodeEditorDirty(false);
                if (!readOnly) onSaveChanges?.();
              }}
              onDeleteRequest={() => setConfirmDeleteOpen(true)}
            />
          </DragablePanel>
        )}

        {/* Confirm delete fine-granular reaction */}
        <ConfirmDialog
          isOpen={confirmDeleteOpen}
          title="Delete Reaction"
          message="Are you sure you want to delete this fine-granular reaction? This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          variant="danger"
          onCancel={() => setConfirmDeleteOpen(false)}
          onConfirm={() => {
            setConfirmDeleteOpen(false);
            if (!selectedEdge) return;
            const removed = deleteFineGranularReactionEdgeFromVsumDetails(selectedEdge);
            if (removed) {
              removeEdge(selectedEdge.id);
              // Orphan cleanup: if last fine relation under a coarse relation
              // with no reaction file storage id, remove the parent coarse relation too
              try {
                const active = new ActiveVsumDetails();
                const ecore = selectedEdge.data?.ecore;
                if (ecore) {
                  const srcId = active.getBackendMetaModelId(ecore.fromModel);
                  const tgtId = active.getBackendMetaModelId(ecore.toModel);
                  if (srcId !== undefined && tgtId !== undefined) {
                    const coarse = active.getMetaModelRelation({ sourceId: srcId, targetId: tgtId });
                    if (
                      coarse &&
                      coarse.fineGranularMetaModelRelationSet.length === 0 &&
                      !coarse.reactionFileStorageId
                    ) {
                      active.removeMetaModelRelation(srcId, tgtId);
                      active.saveToStore();
                      const coarseEdge = edges.find(
                        (e) => e.type === 'reactions' && e.data?.sourceId === srcId && e.data?.targetId === tgtId,
                      );
                      if (coarseEdge) removeEdge(coarseEdge.id);
                    }
                  }
                }
              } catch { /* store not ready — skip orphan cleanup */ }
            }
            setLowCodeEditorOpen(false);
            setLowCodeEditorDirty(false);
            useSelectedEdgeStore.getState().clearSelectedEdge();
          }}
        />

        {/* Confirm adding fine reaction when coarse relation already has a reaction file */}
        <ConfirmDialog
          isOpen={pendingFineConnection !== null}
          title="Existing Reaction File"
          message={`This model pair already has a reaction file (ID: ${pendingFineConnection?.existingFileId ?? ''}). Adding a Low Code reaction will create an additional fine-granular configuration alongside the existing file. Continue?`}
          confirmText="Continue"
          cancelText="Cancel"
          variant="success"
          onCancel={() => setPendingFineConnection(null)}
          onConfirm={() => {
            if (pendingFineConnection) {
              addEdge(pendingFineConnection.fineEdge);
            }
            setPendingFineConnection(null);
          }}
        />
      </div>
    );
  });
