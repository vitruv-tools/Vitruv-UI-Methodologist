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
  SelectionMode,
  Viewport,
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
import { NoNodesSelectionRect } from './canvas/NoNodesSelectionRect';
import { toggleClassInSelection } from '../canvas/umlClassSelection';
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
  applyNodeChangesToSnapshot,
  clampNodeChanges,
  clearUmlCustomControlPoints,
  collectNodeFollowChanges,
  getNodeDragFlags,
  isLockedBlockedNodeChange,
  isReadOnlyBlockedEdgeChange,
  isReadOnlyBlockedNodeChange,
  renameEcoreFileNode,
  shouldCloseDetailOnBoxDrag,
  syncBboxDraggingIds,
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
import { enterReactionMode, exitReactionMode } from './flowCanvasReactionMode';
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
  applyAStarReactionHandles,
  ecoreFileRect,
  flowToScreenPoints,
  inferHandleSide,
  isRoutableNode,
  nodeWorldRect,
  pointInRect,
  routeAllReactionEdges,
  routeReactionEdgesWhileDragging,
  routeOrthogonalAStar,
  routeToCursorAStar,
} from './flowCanvasAStarRouter';
import {
  findNodeByMetaModelId,
  findEcoreTargetAtPosition,
  getBackendMetaModelId,
  getMetaModelSourceId,
  isMetaModelRowOnCanvas,
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
  onFineGranularEdgeClick,
  hydrateFineGranularReactionEdges,
  mergeFineGranularEdges,
  syncFineGranularStoreFromCanvas,
  confirmDeleteFineGranularReaction,
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
} from '../../utils/expandMetaModel';
import {
  applyReactionLayout,
  loadReactionLayout,
  persistReactionLayoutFromNodes,
} from '../../utils/reactionLayoutStorage';
import {
  loadVsumLayoutPosition,
  persistVsumLayoutFromNodes,
  upsertVsumLayoutPosition,
  type VsumLayoutIdentity,
} from '../../utils/vsumLayoutStorage';
import { collectVsumRoutes, loadVsumRoutes, saveVsumRoutes } from '../../utils/vsumRouteStorage';
import { settleReactionRoutes } from './flowCanvasRouteSettle';

import EObjectNode from './lowcode/EObjectNode';
import BoundingBoxNode from './lowcode/BoundingBoxNode';

/**
 * Snap distance while dragging a reaction. Class and attribute handles are 24px apart, so the
 * default 28px radius made the line leap between neighbouring handles; this keeps it on the one
 * under the cursor (the handles' hit areas are widened in reaction.css to compensate).
 */
const REACTION_CONNECTION_RADIUS = 10;

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
  /** Current pan and zoom; undefined until the canvas is initialized. */
  getViewport: () => Viewport | undefined;
  /** Whether the canvas is locked with the lock button. */
  isLocked: () => boolean;
  addEcoreFile: (fileName: string, fileContent: string, meta?: any) => void;
  updateEcoreDisplayName: (metaModelId: number, displayName: string) => void;
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
  /** Pan and zoom to start with, e.g. the view a project tab had when the user left it. */
  initialViewport?: Viewport;
  /** Start locked, e.g. because the project tab was locked when the user left it. */
  initialLocked?: boolean;
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

function keywordsFromEcoreNodeData(data: { keywords?: unknown } | undefined): string[] {
  const raw = data?.keywords;
  if (Array.isArray(raw)) {
    return raw.filter((k): k is string => typeof k === 'string' && k.trim().length > 0);
  }
  if (typeof raw === 'string') {
    return raw.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
  }
  return [];
}

function persistEcoreFileRename(node: Node | undefined, newFileName: string): void {
  if (!node) return;
  const metaModelId = node.data?.metaModelId;
  if (metaModelId == null) return;
  const name = newFileName.replace(/\.ecore$/i, '').trim();
  if (!name) return;
  void apiService.updateMetaModel(String(metaModelId), {
    name,
    description: typeof node.data?.description === 'string' ? node.data.description : '',
    domain: typeof node.data?.domain === 'string' ? node.data.domain : '',
    keyword: keywordsFromEcoreNodeData(node.data),
    ecoreFileId: Number(node.data?.ecoreFileId) || 0,
  }).catch((err) => {
    console.error('Failed to rename meta model:', err);
  });
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
      initialViewport,
      initialLocked = false,
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
    const [isInteractive, setIsInteractive] = useState(!readOnly && !initialLocked);
    const editable = !readOnly && isInteractive;
    // Locked with the lock button: nothing may change, not even positions. Read-only viewers are
    // not "locked" - they may still move boxes locally.
    const locked = !readOnly && !isInteractive;

    const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
    const selectedFileIdsRef = useRef(selectedFileIds);
    selectedFileIdsRef.current = selectedFileIds;
    /** The selected model when exactly one is selected; deleting works on a single model. */
    const selectedFileId = selectedFileIds.length === 1 ? selectedFileIds[0] : null;
    const selectOnlyFile = useCallback((id: string | null) => {
      setSelectedFileIds(id ? [id] : []);
    }, []);
    const clearFileSelection = useCallback(() => {
      setSelectedFileIds(ids => (ids.length === 0 ? ids : []));
    }, []);
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
    // Left-drag on the empty canvas draws a selection box (like the UML editor) instead of
    // panning, while models can be edited on the modeling canvas.
    const boxSelectionEnabled = editable && !umlModalOpen && !addReactionMode && activeCanvasMode === 'modeling';
    /** Selection box in progress: models selected before it (kept with Shift) and models inside it. */
    const boxSelectionRef = useRef<{ base: string[]; inBox: Set<string> } | null>(null);

    const handleSelectionStart = useCallback((event: React.MouseEvent) => {
      if (!boxSelectionEnabled) return;
      const base = event.shiftKey ? selectedFileIdsRef.current : [];
      boxSelectionRef.current = { base, inBox: new Set() };
      setSelectedFileIds(base);
    }, [boxSelectionEnabled]);

    const handleSelectionEnd = useCallback(() => {
      boxSelectionRef.current = null;
    }, []);
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

    // The VSUM circle is a Views-mode layout. Reaction mode expands metamodels
    // into a different graph, so the circle must unmount while that view is open.
    const circleVisible = activeCanvasMode === 'views' && !addReactionMode;

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
      if (!editable) return;
      setPendingDelete({ nodeIds: [], edgeIds: [], fileId: nodeId });
    }, [editable]);

    useEffect(() => {
      if (readOnly) setIsInteractive(false);
    }, [readOnly]);

    // Cmd+scroll zooms around the pointer, like in the UML editor. React Flow only zooms while
    // it sees Cmd held, which it misses when a model card has the focus (the card stops key events).
    useEffect(() => {
      const element = reactFlowWrapper.current;
      if (!element) return undefined;
      const handleWheel = (event: WheelEvent) => {
        const instance = reactFlowInstanceRef.current;
        const target = event.target as Element | null;
        if (!event.metaKey || !instance || !target?.closest?.('.react-flow') || target.closest('.nowheel')) return;
        if (!umlModalOpen && !readOnly && !isInteractive) return; // locked: no zoom, like the other gestures
        event.preventDefault();
        event.stopPropagation();

        let unit = 1;
        if (event.deltaMode === 1) unit = 16;
        else if (event.deltaMode === 2) unit = element.clientHeight;
        const delta = Math.max(-12, Math.min(12, event.deltaY * unit));
        const [minZoom, maxZoom] = umlModalOpen ? [0.45, 2.5] : [0.05, 2];
        const { x, y, zoom } = instance.getViewport();
        const nextZoom = Math.max(minZoom, Math.min(maxZoom, zoom * Math.exp(-delta * 0.01)));
        const rect = element.getBoundingClientRect();
        const pointerX = event.clientX - rect.left;
        const pointerY = event.clientY - rect.top;
        const ratio = nextZoom / zoom;
        instance.setViewport({
          x: pointerX - ratio * (pointerX - x),
          y: pointerY - ratio * (pointerY - y),
          zoom: nextZoom,
        });
      };
      element.addEventListener('wheel', handleWheel, { capture: true, passive: false });
      return () => element.removeEventListener('wheel', handleWheel, { capture: true });
    }, [umlModalOpen, readOnly, isInteractive]);

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
      setEdges(currentEdges => {
        const routed = applyAStarReactionHandles(currentNodes, currentEdges);
        return routed.map(edge => (
          edge.type === 'uml' ? updateEdgeHandles(edge, currentNodes, routed) : edge
        ));
      });
    }, [reactFlowInstance, setEdges]);

    const bboxDraggingIdsRef = useRef<Set<string>>(new Set());
    const nodeDraggingRef = useRef(false);
    const [isNodeDragging, setIsNodeDragging] = useState(false);

    /**
     * Models' selection lives in selectedFileIds, so React Flow's own select changes for them
     * are taken out here. While a selection box is drawn they say which models are inside it.
     */
    const takeModelSelectChanges = useCallback((changes: any[]): any[] => {
      const modelIds = new Set(nodesRef.current.filter(n => n.type === 'ecoreFile').map(n => n.id));
      const selectChanges = changes.filter(c => c.type === 'select' && modelIds.has(c.id));
      if (selectChanges.length === 0) return changes;

      const box = boxSelectionRef.current;
      if (box) {
        for (const c of selectChanges) {
          if (c.selected) box.inBox.add(c.id);
          else box.inBox.delete(c.id);
        }
        setSelectedFileIds(Array.from(new Set([...box.base, ...box.inBox])));
      }
      return changes.filter(c => !selectChanges.includes(c));
    }, []);

    const onNodesChange = useCallback((allChanges: any) => {
      const changes = takeModelSelectChanges(allChanges);
      if (changes.length === 0) return;
      if (readOnly && changes.some(isReadOnlyBlockedNodeChange)) return;
      if (locked && changes.some(isLockedBlockedNodeChange)) return;

      const liveNodes = nodesRef.current;
      const clampedChanges = clampNodeChanges(changes, {
        circleVisible,
        umlModalOpen,
        circle,
        nodes: liveNodes,
      });

      const { isDragging, dragEnded } = getNodeDragFlags(clampedChanges);
      if (isDragging) {
        setHistoryPaused(true);
        if (!nodeDraggingRef.current) setIsNodeDragging(true);
        nodeDraggingRef.current = true;
      }
      if (dragEnded) {
        setHistoryPaused(false);
        nodeDraggingRef.current = false;
        setIsNodeDragging(false);
      }

      const draggingIds = bboxDraggingIdsRef.current;
      syncBboxDraggingIds(clampedChanges, draggingIds);
      const extraChanges = collectNodeFollowChanges({
        clampedChanges,
        liveNodes,
        edges,
        bboxDraggingIds: draggingIds,
      });

      originalOnNodesChange(
        extraChanges.length > 0 ? [...clampedChanges, ...extraChanges] : clampedChanges,
      );

      if (shouldCloseDetailOnBoxDrag(clampedChanges, detailModel, liveNodes)) {
        setDetailModel(null);
      }
      if (!dragEnded) return;

      draggingIds.clear();
      setTimeout(recalculateEdgeHandles, 100);
      const nextNodes = applyNodeChangesToSnapshot(
        liveNodes,
        [...clampedChanges, ...extraChanges],
      );
      const projectId = useProjectStore.getState().activeId;
      if (addReactionMode) {
        persistReactionLayoutFromNodes(projectId, nextNodes);
      } else {
        persistVsumLayoutFromNodes(projectId, nextNodes);
      }
      if (umlModalOpen) setEdges(clearUmlCustomControlPoints);
    }, [originalOnNodesChange, recalculateEdgeHandles, circle, circleVisible, umlModalOpen, detailModel, setEdges, setHistoryPaused, readOnly, locked, edges, addReactionMode, takeModelSelectChanges]);

    const guardedOnEdgesChange = useCallback((allChanges: any) => {
      const changes = boxSelectionRef.current
        ? allChanges.filter((c: any) => c.type !== 'select')
        : allChanges;
      if (changes.length === 0) return;
      if (!editable && changes.some(isReadOnlyBlockedEdgeChange)) return;
      onEdgesChange(changes);
    }, [onEdgesChange, editable]);

    const guardedOnConnect = useCallback((connection: any) => {
      if (!editable) return;

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
    }, [onConnect, editable, nodes, addEdge]);

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
      readOnly: !editable,
      nodes,
      edges,
      selectedFileId,
      umlModalOpen,
      canUndo,
      canRedo,
      undo,
      redo,
      setPendingDelete,
      onEscape: clearFileSelection,
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
      if (!editable) return;
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
      editable,
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
      if (!editable || !reactFlowInstance) return;

      // Convert the DOM screen position of the arrow tip to flow coordinates
      const flowTipPos = reactFlowInstance.screenToFlowPosition(tipScreenPos);

      setConnectionDragState({
        isActive: true,
        sourceNodeId: nodeId,
        sourceHandle: handle,
        currentPosition: flowTipPos,
        sourceTipPosition: flowTipPos,
      });
    }, [reactFlowInstance, editable]);

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

    useReactionEdgeCreationEvents({ readOnly: !editable, createReactionEdgeFromEvent });

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
      globalThis.setTimeout(() => recalculateEdgeHandles(), 0);
    }, [nodes, edges, getColorForPair, addEdge, recalculateEdgeHandles]);

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
      if (editable) setIsDragOver(true);
    }, [onDragOver, editable]);

    const handleDragLeave = useCallback(() => setIsDragOver(false), []);

    const handleDrop = useCallback((event: React.DragEvent) => {
      setIsDragOver(false);
      if (!editable) return;
      onDrop(event);
    }, [onDrop, editable]);

    const handleLabelChange = useCallback((id: string, newLabel: string) => {
      if (!editable) return;
      updateNodeLabel(id, newLabel);
    }, [updateNodeLabel, editable]);

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
      if (!editable) return;
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
    }, [editable, circle, setCircle, nodes, setNodes, fitViewToCircle]);

    const handleAddViewType = useCallback((
      label: string,
      scope: ViewTypeScope,
      linkedNodeIds: string[],
      angle: number,
      viewTypeEditable: boolean,
    ) => {
      if (!editable) return;
      addViewType({ label, scope, angle, linkedNodeIds, editable: viewTypeEditable });
    }, [addViewType, editable]);

    // ── Auto-layout ───────────────────────────────────────────────────────────

    const autoLayoutEcoreBoxes = useCallback(() => {
      const ecoreOnly = nodes.filter(n => n.type === 'ecoreFile');
      if (ecoreOnly.length === 0) return;

      const positionMap = computeAutoLayoutPositions(ecoreOnly, edges);
      const updatedNodes = applyAutoLayoutPositions(nodes, positionMap);
      setNodes(updatedNodes);
      persistVsumLayoutFromNodes(useProjectStore.getState().activeId, updatedNodes);

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

    const handleEcoreFileSelect = useCallback((fileName: string, options?: { additive?: boolean }) => {
      const ecoreNode = nodes.find(n => n.type === 'ecoreFile' && n.data.fileName === fileName);
      if (!ecoreNode) return;

      const action = resolveEcoreFileSelectAction({
        ecoreNode,
        fileName,
        addReactionMode,
        readOnly: !editable,
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
          if (options?.additive) {
            setSelectedFileIds(ids => toggleClassInSelection(ids, action.nodeId));
            return;
          }
          selectOnlyFile(action.nodeId);
          onEcoreFileSelect?.(action.fileName);
      }
    }, [nodes, onEcoreFileSelect, addReactionMode, reactionSourceId, getColorForPair, commitReactionEdge, onReactionModeEnd, activeCanvasMode, onConstraintNodeFilter, constraintFilterNodeId, editable, selectOnlyFile]);

    const handleEcoreFileRename = useCallback((id: string, newFileName: string) => {
      if (!editable) return;
      const node = nodesRef.current.find(n => n.id === id);
      setNodes(current => renameEcoreFileNode(current, id, newFileName));
      persistEcoreFileRename(node, newFileName);
      onEcoreFileRename?.(id, newFileName);
    }, [editable, setNodes, onEcoreFileRename]);

    // Clear reaction source when mode is toggled off, and drop circle selection
    // so the Views overlay does not stay selected across the reaction view.
    useEffect(() => {
      if (addReactionMode) setCircleSelected(false);
      else setReactionSourceId(null);
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
      const ctx = {
        nodes,
        setNodes,
        setEdges,
        vsumPositions: vsumPositionsRef.current,
        reactionOffsets: reactionOffsetsRef.current,
      };
      if (addReactionMode) {
        enterReactionMode(ctx);
        return;
      }
      exitReactionMode(ctx);
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
        selectOnlyFile(ecoreNode.id);
      }

      const data = ecoreNode?.data;
      onEcoreFileExpand?.(fileName, fileContent, {
        metaModelId: typeof data?.metaModelId === 'number' ? data.metaModelId : undefined,
        metaModelSourceId: typeof data?.metaModelSourceId === 'number' ? data.metaModelSourceId : undefined,
        ecoreFileId: typeof data?.ecoreFileId === 'number' ? data.ecoreFileId : undefined,
      });
    }, [nodes, onEcoreFileExpand, selectOnlyFile]);

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

    const updateEcoreDisplayName = useCallback((metaModelId: number, displayName: string) => {
      setNodes(current => current.map(n => {
        if (n.type !== 'ecoreFile') return n;
        const nodeMetaModelId = n.data?.metaModelId;
        const nodeSourceId = n.data?.metaModelSourceId;
        if (nodeMetaModelId !== metaModelId && nodeSourceId !== metaModelId) return n;
        return { ...n, data: { ...n.data, displayName } };
      }));
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
      if (!editable && !meta?.fromServerLoad) return;

      const ecoreNodes = nodesRef.current.filter(n => n.type === 'ecoreFile');
      const metaModelId = typeof meta?.metaModelId === 'number' ? meta.metaModelId : undefined;
      const metaModelSourceId = typeof meta?.metaModelSourceId === 'number'
        ? meta.metaModelSourceId
        : metaModelId;

      const alreadyOnCanvas = isMetaModelRowOnCanvas(ecoreNodes, metaModelId);
      if (alreadyOnCanvas) return;

      const nodeId = `ecore-${meta?.metaModelId ?? meta?.metaModelSourceId ?? Date.now()}`;
      const nsUri = extractNsUriFromEcore(fileContent);
      const layoutIdentity: VsumLayoutIdentity = {
        nodeId,
        metaModelId,
        metaModelSourceId,
        nsUri: nsUri ?? undefined,
        fileName,
      };
      const savedPosition = loadVsumLayoutPosition(
        useProjectStore.getState().activeId,
        layoutIdentity,
      );

      const newEcoreNode: Node = {
        id: nodeId,
        type: 'ecoreFile',
        position: findFreeEcorePosition(
          ecoreNodes,
          savedPosition ?? meta?.position ?? { x: 60, y: 60 },
        ),
        data: {
          fileName,
          displayName: meta?.displayName ?? fileName.replace(/\.ecore$/i, ''),
          version: typeof meta?.version === 'string' ? meta.version : undefined,
          fileContent,
          nsUri,
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
          onRename: handleEcoreFileRename,
          onShowDetails: handleShowDetails,
          isExpanded: false,
        },
        draggable: true,
      };

      addNode(newEcoreNode);
      upsertVsumLayoutPosition(
        useProjectStore.getState().activeId,
        layoutIdentity,
        newEcoreNode.position,
      );
      selectOnlyFile(newEcoreNode.id);
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
          applyReactionLayout(
            result,
            loadReactionLayout(useProjectStore.getState().activeId)[result.modelNsUri],
          );
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
    }, [addNode, handleEcoreFileExpand, handleEcoreFileSelect, onEcoreFileSelect, onEcoreFileDelete, handleEcoreFileRename, handleRequestDelete, handleShowDetails, editable, addReactionMode, setNodes, setEdges, selectOnlyFile]);

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
    useEdgeSelectionEvents({ setEdges, setNodes, setSelectedFileId: selectOnlyFile });

    const handleEdgeHandleChange = useCallback((
      edgeId: string,
      newSourceHandle: string,
      newTargetHandle: string,
    ) => {
      if (!editable) return;
      setEdges(prevEdges => prevEdges.map(edge =>
        edge.id === edgeId
          ? {
            ...edge,
            sourceHandle: newSourceHandle,
            targetHandle: newTargetHandle,
          }
          : edge,
      ));
    }, [setEdges, editable]);

    const handleEdgeRouteChange = useCallback((
      edgeId: string,
      points: Array<{ x: number; y: number }>,
    ) => {
      if (!editable) return;
      setEdges(prevEdges => prevEdges.map(edge => {
        if (edge.id !== edgeId) return edge;
        const saved = edge.data?.savedRoute;
        if (!saved) return edge;
        return { ...edge, data: { ...edge.data, savedRoute: { ...saved, points } } };
      }));
    }, [setEdges, editable]);

    // Links keep their path: it is only computed for links that have none yet
    // (new, or their box moved) and is otherwise restored from local storage.
    useEffect(() => {
      if (nodeDraggingRef.current || connectionDragState?.isActive || addReactionMode || umlModalOpen) return;
      if (!edges.some(e => e.type === 'reactions')) return;
      const projectId = useProjectStore.getState().activeId;
      const settled = settleReactionRoutes(nodes, edges, loadVsumRoutes(projectId));
      if (settled !== edges) setEdges(settled);
    }, [nodes, edges, setEdges, connectionDragState?.isActive, addReactionMode, umlModalOpen]);

    const savedRoutesSignatureRef = useRef('');
    useEffect(() => {
      if (!editable || nodeDraggingRef.current || addReactionMode || umlModalOpen) return;
      const routes = collectVsumRoutes(nodes, edges);
      if (Object.keys(routes).length === 0) return;
      const projectId = useProjectStore.getState().activeId;
      const signature = `${projectId}:${JSON.stringify(routes)}`;
      if (signature === savedRoutesSignatureRef.current) return;
      savedRoutesSignatureRef.current = signature;
      saveVsumRoutes(projectId, { ...loadVsumRoutes(projectId), ...routes });
    }, [nodes, edges, editable, addReactionMode, umlModalOpen]);

    const handleEdgeReorderRequest = useCallback((
      edgeId: string,
      controlPoint: { x: number; y: number },
    ) => {
      if (!editable) return;
      setEdges(prevEdges => computeParallelEdgeReorder(prevEdges, { edgeId, controlPoint, nodes }));
    }, [setEdges, nodes, editable]);

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
      getViewport: () => reactFlowInstanceRef.current?.getViewport(),
      isLocked: () => locked,
      addEcoreFile,
      updateEcoreDisplayName,
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
    }), [handleToolClick, loadDiagramData, nodes, edges, viewTypes, addEcoreFile, updateEcoreDisplayName, updateEcoreFileData, resetExpandedFile, undo, redo, canUndo, canRedo, getReactionEdges, getWorkspaceSnapshot, autoLayoutEcoreBoxes, fitUmlView, openSelectedReactionEditor, establishBaseline, locked]);

    // ── Render mapping ────────────────────────────────────────────────────────

    const mappedNodes = nodes.map(node => {
      if (node.type === 'editable') {
        return mapEditableFlowNode(node, !editable, handleLabelChange, removeNode, locked);
      }
      if (node.type === 'ecoreFile') {
        return mapEcoreFlowNode(node, {
          readOnly: !editable,
          locked,
          expandedFileId,
          selectedFileIds,
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
          onEcoreFileRename: handleEcoreFileRename,
          handleShowDetails,
          handleConnectionStart: editable ? handleConnectionStart : undefined,
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

    // While a box is dragged only cheap routes are computed; the full search runs when it lands.
    const settledRoutesRef = useRef<ReturnType<typeof routeAllReactionEdges>>(new Map());
    const reactionRoutes = useMemo(() => {
      if (isNodeDragging) {
        return routeReactionEdgesWhileDragging(nodes, uniqueEdges, settledRoutesRef.current);
      }
      const routes = routeAllReactionEdges(nodes, uniqueEdges);
      settledRoutesRef.current = routes;
      return routes;
    }, [nodes, uniqueEdges, isNodeDragging]);

    const resolveReactionRoute = useCallback(
      (edge: Edge) => reactionRoutes.get(edge.id),
      [reactionRoutes],
    );

    const edgeMapContext = useMemo(() => ({
      readOnly: !editable,
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
      handleEdgeRouteChange,
      getFineParallel: resolveFineParallel,
      getReactionRoute: resolveReactionRoute,
    }), [
      editable,
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
      handleEdgeRouteChange,
      resolveFineParallel,
      resolveReactionRoute,
    ]);

    const mappedEdges = useMemo(
      () => uniqueEdges.map(edge => mapFlowCanvasEdge(edge, edgeMapContext)),
      [uniqueEdges, edgeMapContext],
    );

    const ecoreNodes = nodes.filter(n => n.type === 'ecoreFile');
    const connectionLinePositions = computeConnectionLinePositions(connectionDragState, reactFlowInstance);
    const connectionPreviewPoints = useMemo(() => {
      if (!connectionLinePositions || !connectionDragState?.sourceNodeId || !reactFlowInstance) {
        return undefined;
      }
      const sourceNode = nodes.find(n => n.id === connectionDragState.sourceNodeId);
      if (!sourceNode || !isRoutableNode(sourceNode) || !connectionDragState.currentPosition) {
        return undefined;
      }
      const sourceHandle = inferHandleSide(connectionDragState.sourceHandle) ?? 'right';
      const cursor = connectionDragState.currentPosition;
      const sourceRect = nodeWorldRect(sourceNode) ?? ecoreFileRect(sourceNode);
      const hoverTarget = sourceNode.type === 'ecoreFile'
        ? findEcoreTargetAtPosition(nodes, cursor, sourceNode.id)
        : nodes.find((n) => {
          if (n.id === sourceNode.id || !isRoutableNode(n)) return false;
          const rect = nodeWorldRect(n);
          return Boolean(rect && pointInRect(cursor, rect, 0));
        }) ?? null;
      const obstacles = nodes
        .filter(n => isRoutableNode(n) && n.id !== sourceNode.id && n.id !== hoverTarget?.id)
        .map(n => nodeWorldRect(n))
        .filter((rect): rect is NonNullable<typeof rect> => Boolean(rect));
      const existing = Array.from(reactionRoutes.values()).map(route => route.points);
      const flowPoints = hoverTarget
        ? routeOrthogonalAStar({
          source: sourceRect,
          target: nodeWorldRect(hoverTarget) ?? ecoreFileRect(hoverTarget),
          obstacles,
          existing,
          lockSourceHandle: sourceHandle,
          cursor,
        }).points
        : routeToCursorAStar(sourceRect, sourceHandle, cursor, obstacles, existing);
      return flowToScreenPoints(flowPoints, reactFlowInstance.getViewport());
    }, [connectionLinePositions, connectionDragState, nodes, reactFlowInstance, reactionRoutes]);
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
          defaultViewport={initialViewport}
          nodes={mappedNodes}
          edges={mappedEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={guardedOnEdgesChange}
          onConnect={guardedOnConnect}
          connectionMode={ConnectionMode.Loose}
          connectionRadius={addReactionMode ? REACTION_CONNECTION_RADIUS : 28}
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
          // With the selection box, left-drag selects; the middle button and two-finger scroll pan.
          panOnDrag={boxSelectionEnabled ? [1] : interactionsAllowed}
          selectionOnDrag={boxSelectionEnabled}
          selectionMode={SelectionMode.Partial}
          onSelectionStart={handleSelectionStart}
          onSelectionEnd={handleSelectionEnd}
          panOnScroll={interactionsAllowed}
          zoomOnScroll={interactionsAllowed}
          zoomOnPinch={interactionsAllowed}
          zoomOnDoubleClick={interactionsAllowed}
          minZoom={umlViewActive ? 0.45 : 0.05}
          maxZoom={umlViewActive ? 2.5 : 2}
          translateExtent={[[-12000, -12000], [12000, 12000]]}
          selectNodesOnDrag={false}
          proOptions={{ hideAttribution: true }}
          onPaneClick={() => {
            setDetailModel(null);
            setSelectedFileIds([]);
            setCircleSelected(false);
            setNodes(nds => nds.map(n => ({ ...n, selected: false })));
            setEdges(eds => eds.map(e => ({ ...e, selected: false })));
            if (addReactionMode) {
              setReactionSourceId(null);
            }
          }}
        >
          <Background color="var(--v-workspace-dot)" gap={24} size={0.75} />
          {boxSelectionEnabled && <NoNodesSelectionRect />}
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
            onDeleteViewType={editable ? deleteViewType : () => {}}
            onUpdateViewTypeAngle={editable ? updateAngle : () => {}}
            onUnlinkNode={editable ? unlinkNode : () => {}}
          />
        )}

        {connectionLinePositions && (
          <ConnectionLine
            sourcePosition={connectionLinePositions.source}
            targetPosition={connectionLinePositions.target}
            points={connectionPreviewPoints}
          />
        )}

        <CanvasMinimap
          nodes={nodes}
          edges={mappedEdges}
          reactionRoutes={reactionRoutes}
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
            onDelete={editable ? handleDeleteEdge : undefined}
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
              () => setSelectedFileIds([]),
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
            showDelete={editable}
          >
            <LowCodeReactionEditor
              ref={lowCodeEditorRef}
              edge={selectedEdge}
              onDirtyChange={setLowCodeEditorDirty}
              onSaveComplete={() => {
                setLowCodeEditorDirty(false);
                if (!readOnly) onSaveChanges?.();
              }}
              onDeleteRequest={editable ? () => setConfirmDeleteOpen(true) : undefined}
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
            if (!confirmDeleteFineGranularReaction(selectedEdge, edges, removeEdge)) return;
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
