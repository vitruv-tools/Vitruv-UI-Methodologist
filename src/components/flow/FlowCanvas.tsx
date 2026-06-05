import React, {
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import ReactDOM from 'react-dom';
import ReactFlow, {
  Background,
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
import { EcoreFileBox, cardColor, darken } from './EcoreFileBox';
import { ConnectionLine } from './ConnectionLine';
import { CodeEditorModal } from './CodeEditorModal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { ModelDetailModal } from '../ui/ModelLibraryTable';
import { apiService, MetaModelRelationRequest } from '../../services/api';
import { WorkspaceSnapshot } from '../../types/workspace';
import { extractNsUriFromEcore } from '../../utils';
import { useCircleContainment, clampToCircle, clampAllNodesToCircle, computeInitialCircle, Circle } from '../../hooks/useCircleContainment';
import { CircleOverlay } from './canvas/CircleOverlay';
import { useViewTypes, ViewTypeScope } from '../../hooks/useViewTypes';
import { pickFocusUmlFlowNodes } from '../../utils/umlClassLayout';



const COLOR_LIST = [
  '#ab1c91ff', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
  '#d636a3ff', '#ff9f40', '#4daf4a', '#ff6b6b', '#b388eb',
  '#9c6644', '#f39ed1', '#a9a9a9', '#c9d22f', '#33c7c7',
  '#2a86d6', '#ffb86b', '#63c37a', '#ff4f7a', '#b08fe8'
];

const NODE_DIMENSIONS = { width: 280, height: 180 };
/** Matches EcoreFileBox card size (118×126). */
const ECORE_FILE_BOX_SIZE = { width: 118, height: 126 };

function buildWorkspaceSnapshotFrom(
  nodes: Node[],
  edges: Edge[],
  getMetaModelSourceId: (nodeId?: string | null) => number | undefined,
): WorkspaceSnapshot {
  const metaModelIds = Array.from(
    new Set(
      nodes
        .filter(node => node.type === 'ecoreFile')
        .map(node => getMetaModelSourceId(node.id))
        .filter((value): value is number => typeof value === 'number'),
    ),
  );

  const metaModelRelationRequests: MetaModelRelationRequest[] = edges
    .filter(edge => edge.type === 'reactions')
    .map(edge => {
      const sourceId = getMetaModelSourceId(edge.source);
      const targetId = getMetaModelSourceId(edge.target);
      const reactionFileId =
        typeof edge.data?.reactionFileId === 'number' ? edge.data.reactionFileId : 0;

      if (typeof sourceId !== 'number' || typeof targetId !== 'number') {
        return null;
      }

      return { sourceId, targetId, reactionFileId };
    })
    .filter((req): req is MetaModelRelationRequest => req !== null);

  return { metaModelIds, metaModelRelationRequests };
}

// ── EcoreFileBox collision helpers ────────────────────────────────────────────
const ECORE_W = 118;
const ECORE_H = 126;
const ECORE_GAP = 20; // minimum clearance between boxes

function ecoreRectsOverlap(ax: number, ay: number, bx: number, by: number): boolean {
  return (
    ax < bx + ECORE_W + ECORE_GAP &&
    ax + ECORE_W + ECORE_GAP > bx &&
    ay < by + ECORE_H + ECORE_GAP &&
    ay + ECORE_H + ECORE_GAP > by
  );
}

function findFreeEcorePosition(
  existingNodes: { position: { x: number; y: number } }[],
  preferred?: { x: number; y: number },
): { x: number; y: number } {
  const step = ECORE_W + ECORE_GAP;
  const startX = preferred?.x ?? 60;
  const startY = preferred?.y ?? 60;

  const isFree = (x: number, y: number) =>
    !existingNodes.some(n => ecoreRectsOverlap(x, y, n.position.x, n.position.y));

  if (isFree(startX, startY)) return { x: startX, y: startY };

  // Spiral outward from the preferred position until a free cell is found
  for (let ring = 1; ring < 30; ring++) {
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        if (Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
        const x = startX + dx * step;
        const y = startY + dy * step;
        if (x < 0 || y < 0) continue;
        if (isFree(x, y)) return { x, y };
      }
    }
  }
  return { x: startX, y: startY + existingNodes.length * (ECORE_H + ECORE_GAP) };
}

// Layout constants for auto-layout algorithm (defined outside component for stable references)
const LAYOUT_CONFIG = {
  BOX_WIDTH: 280,
  BOX_HEIGHT: 180,
  MIN_HORIZONTAL_SPACING: 150,
  MIN_VERTICAL_SPACING: 120,
  START_X: 100,
  START_Y: 100,
  ITERATIONS: 150,
  REPULSION_STRENGTH: 50000,
  ATTRACTION_STRENGTH: 0.3,
  DAMPING: 0.85,
};

const nodeTypes = {
  editable: EditableNode,
  ecoreFile: EcoreFileBox
};
const edgeTypes = {
  uml: UMLRelationship,
  reactions: ReactionRelationship
};


const getLocalStorageKey = (userId?: string, vsumId?: string) => {
  if (userId && vsumId) {
    return `flow_edge_color_map_v1_user_${userId}_vsum_${vsumId}`;
  }
  return 'flow_edge_color_map_v1';
};

interface FlowCanvasProps {
  onDeploy?: (nodes: Node[], edges: Edge[]) => void;
  onToolClick?: (toolType: string, toolName: string, diagramType?: string) => void;
  onDiagramChange?: (nodes: Node[], edges: Edge[]) => void;
  onEcoreFileSelect?: (fileName: string) => void;
  onEcoreFileExpand?: (fileName: string, fileContent: string) => void;
  onEcoreFileDelete?: (id: string) => void;
  onEcoreFileRename?: (id: string, newFileName: string) => void;
  userId?: string;
  vsumId?: string;
  umlModalOpen?: boolean;
  addReactionMode?: boolean;
  onReactionModeEnd?: () => void;
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
  /** Rendered directly under the Modeling / View Types toggle (e.g. project tabs). */
  projectTabsBelowModeToggle?: React.ReactNode;
}

interface ConnectionDragState {
  isActive: boolean;
  sourceNodeId: string | null;
  sourceHandle: 'top' | 'bottom' | 'left' | 'right' | null;
  currentPosition: { x: number; y: number } | null;
  sourceTipPosition: { x: number; y: number } | null;
}

interface CodeEditorState {
  isOpen: boolean;
  edgeId: string | null;
  initialCode: string;
  sourceFileName?: string;
  targetFileName?: string;
  reactionFileId?: number | null;
}

type HandlePosition = 'top' | 'bottom' | 'left' | 'right';

const pairKey = (a: string, b: string) => (a < b ? `${a}::${b}` : `${b}::${a}`);

// ── CustomMinimap ─────────────────────────────────────────────────────────────

const MINI_NODE_W = 118;
const MINI_NODE_H = 126;

/** Returns the point where the ray from (w/2,h/2) toward (sx,sy) hits the minimap border,
 *  or null if (sx,sy) is already inside. Used for off-screen edge indicators. */
function edgeIndicatorPos(
  sx: number, sy: number, w: number, h: number,
): { x: number; y: number } | null {
  const M = 9;
  if (sx >= M && sx <= w - M && sy >= M && sy <= h - M) return null;
  const cx = w / 2, cy = h / 2;
  const dx = sx - cx, dy = sy - cy;
  if (dx === 0 && dy === 0) return null;
  let t = Infinity;
  if (dx > 0) t = Math.min(t, (w - M - cx) / dx);
  if (dx < 0) t = Math.min(t, (M - cx) / dx);
  if (dy > 0) t = Math.min(t, (h - M - cy) / dy);
  if (dy < 0) t = Math.min(t, (M - cy) / dy);
  if (!isFinite(t) || t <= 0) return null;
  return {
    x: Math.max(M, Math.min(w - M, cx + dx * t)),
    y: Math.max(M, Math.min(h - M, cy + dy * t)),
  };
}

interface CustomMinimapProps {
  nodes: Node[];
  edges: Edge[];
  circle?: Circle;
  viewport: { x: number; y: number; zoom: number };
  containerW: number;
  containerH: number;
  width: number;
  height: number;
}

const CustomMinimap: React.FC<CustomMinimapProps> = ({
  nodes, edges, circle, viewport, containerW, containerH, width, height,
}) => {
  const ecoreNodes = nodes.filter(n => n.type === 'ecoreFile');

  // Viewport center in flow coordinates
  const flowCX = (-viewport.x + containerW / 2) / viewport.zoom;
  const flowCY = (-viewport.y + containerH / 2) / viewport.zoom;
  const visW = containerW / viewport.zoom;
  const visH = containerH / viewport.zoom;

  // Scale: current viewport fills ~80 % of the minimap — clamped so extreme zooms stay sane.
  // The minimap always tracks the viewport center, so it shows exactly what the user sees,
  // scaled down proportionally to minimap size.
  const mmScale = Math.max(0.03, Math.min(2, Math.min(
    (width  * 0.80) / Math.max(visW, 50),
    (height * 0.80) / Math.max(visH, 50),
  )));

  // Flow → SVG coordinate helpers (centered on current viewport center)
  const toX = (fx: number) => (fx - flowCX) * mmScale + width  / 2;
  const toY = (fy: number) => (fy - flowCY) * mmScale + height / 2;

  const nodeMap = new Map(ecoreNodes.map(n => [n.id, n]));

  // Viewport rectangle in SVG space
  const vpX = toX(flowCX - visW / 2);
  const vpY = toY(flowCY - visH / 2);
  const vpW = visW * mmScale;
  const vpH = visH * mmScale;

  // Off-screen indicators: colored dots at minimap border pointing toward off-screen items
  const indicators: { x: number; y: number; color: string }[] = [];
  ecoreNodes.forEach(node => {
    const sx = toX(node.position.x + MINI_NODE_W / 2);
    const sy = toY(node.position.y + MINI_NODE_H / 2);
    const ind = edgeIndicatorPos(sx, sy, width, height);
    if (ind) indicators.push({ ...ind, color: cardColor(node.data?.domain) });
  });
  if (circle && circle.r > 0) {
    const sx = toX(circle.cx), sy = toY(circle.cy);
    const ind = edgeIndicatorPos(sx, sy, width, height);
    if (ind) indicators.push({ ...ind, color: 'rgba(4,148,132,0.85)' });
  }

  return (
    <div style={{
      position: 'absolute', right: 60, bottom: 16,
      width, height, zIndex: 30,
      background: '#f0f4f8', borderRadius: 8,
      border: '1px solid #e2e8f0',
      boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
      overflow: 'hidden',
    }}>
      <svg width={width} height={height} style={{ display: 'block' }}>
        {/* Circle (only when circleVisible and it overlaps with visible minimap area) */}
        {circle && circle.r > 0 && (() => {
          const cx = toX(circle.cx), cy = toY(circle.cy), r = circle.r * mmScale;
          if (cx + r < 0 || cx - r > width || cy + r < 0 || cy - r > height) return null;
          return (
            <circle cx={cx} cy={cy} r={r}
              fill="rgba(4,148,132,0.05)" stroke="rgba(4,148,132,0.45)"
              strokeWidth={1.5} strokeDasharray="4 3"
            />
          );
        })()}

        {/* Edges */}
        {edges.map(edge => {
          const src = nodeMap.get(edge.source);
          const tgt = nodeMap.get(edge.target);
          if (!src || !tgt) return null;
          return (
            <line key={edge.id}
              x1={toX(src.position.x + MINI_NODE_W / 2)} y1={toY(src.position.y + MINI_NODE_H / 2)}
              x2={toX(tgt.position.x + MINI_NODE_W / 2)} y2={toY(tgt.position.y + MINI_NODE_H / 2)}
              stroke="#94a3b8" strokeWidth={1.2}
            />
          );
        })}

        {/* Nodes */}
        {ecoreNodes.map(node => {
          const sx = toX(node.position.x), sy = toY(node.position.y);
          const nw = MINI_NODE_W * mmScale, nh = MINI_NODE_H * mmScale;
          if (sx + nw < 0 || sx > width || sy + nh < 0 || sy > height) return null;
          const color = cardColor(node.data?.domain);
          return (
            <rect key={node.id} x={sx} y={sy} width={nw} height={nh}
              rx={Math.max(2, 8 * mmScale)}
              fill={color} stroke={darken(color, 25)} strokeWidth={1}
            />
          );
        })}

        {/* Current viewport rectangle */}
        <rect x={vpX} y={vpY} width={vpW} height={vpH}
          fill="rgba(59,130,246,0.07)" stroke="rgba(59,130,246,0.55)"
          strokeWidth={1.5} rx={2}
        />

        {/* Off-screen edge indicators */}
        {indicators.map((ind, i) => (
          <circle key={i} cx={ind.x} cy={ind.y} r={4.5}
            fill={ind.color} stroke="white" strokeWidth={1.2}
          />
        ))}
      </svg>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

const createControlButton = (onClick: () => void, title: string, icon: React.ReactNode) => (
  <button
    onClick={onClick}
    style={{
      width: 36,
      height: 36,
      borderRadius: 10,
      border: '1px solid #e5e7eb',
      background: '#ffffff',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 18,
      transition: 'all 0.2s ease',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    }}
    title={title}
    onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f0f0')}
    onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
  >
    {icon}
  </button>
);


const TOOL_LABELS: Record<string, Record<string, string>> = {
  element: {
    'class': 'Class',
    'abstract-class': 'AbstractClass',
    'interface': 'Interface',
    'enumeration': 'Enumeration',
    'package': 'Package',
  },
  member: {
    'attribute': '+ attribute: Type',
    'method': '+ method(): ReturnType',
    'private-attribute': '- privateAttribute: Type',
    'protected-attribute': '# protectedAttribute: Type',
    'private-method': '- privateMethod(): ReturnType',
    'protected-method': '# protectedMethod(): ReturnType',
  },
  relationship: {
    'association': 'Association',
    'aggregation': 'Aggregation',
    'composition': 'Composition',
    'inheritance': 'Inheritance',
    'realization': 'Realization',
    'dependency': 'Dependency',
  },
  multiplicity: {
    'one': '1',
    'many': '*',
    'optional': '0..1',
    'range': '1..*',
  },
};

const getToolLabel = (toolType: string, toolName: string): string => {
  return TOOL_LABELS[toolType]?.[toolName] || toolName;
};

export const FlowCanvas = forwardRef<{
  handleToolClick: (toolType: string, toolName: string, diagramType?: string) => void;
  loadDiagramData: (nodes: any[], edges: any[]) => void;
  getNodes: () => Node[];
  getEdges: () => Edge[];
  addEcoreFile: (fileName: string, fileContent: string, meta?: any) => void;
  resetExpandedFile: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  getReactionEdges: () => Edge[];
  getWorkspaceSnapshot: () => WorkspaceSnapshot;
  fitUmlView: () => void;
}, FlowCanvasProps>(
  ({
    onDeploy,
    onToolClick,
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
    onHistoryChange,
    projectTabsBelowModeToggle,
  }, ref) => {

    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
    // Ref mirror of reactFlowInstance – always current, safe to read from any closure or setTimeout
    const reactFlowInstanceRef = useRef<ReactFlowInstance | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isInteractive, setIsInteractive] = useState(true);
    const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
    const [expandedFileId, setExpandedFileId] = useState<string | null>(null);
    const [connectionDragState, setConnectionDragState] = useState<ConnectionDragState | null>(null);
    const [codeEditorState, setCodeEditorState] = useState<CodeEditorState | null>(null);
    const [routingStyle] = useState<'curved' | 'orthogonal'>('orthogonal');
    const [hoveredMergeGroup, setHoveredMergeGroup] = useState<string | null>(null);
    const [pendingDelete, setPendingDelete] = useState<{ nodeIds: string[]; edgeIds: string[]; fileId: string | null } | null>(null);
    const [detailModel, setDetailModel] = useState<{ model: any; ecoreContent: string } | null>(null);
    const handleShowDetails = useCallback((modelObj: any, fileContent: string) => {
      setDetailModel({ model: modelObj, ecoreContent: fileContent });
    }, []);

    // Close detail panel when clicking outside the modal content (capture phase)
    useEffect(() => {
      if (!detailModel) return;
      const handleOutsideDetail = (e: Event) => {
        const target = e.target as HTMLElement;
        if (target.closest('[data-model-detail-modal]')) return;
        if (target.closest('button, input, textarea, select, a, [role="dialog"]')) return;
        setDetailModel(null);
      };
      document.addEventListener('pointerdown', handleOutsideDetail, true);
      document.addEventListener('mousedown', handleOutsideDetail, true);
      return () => {
        document.removeEventListener('pointerdown', handleOutsideDetail, true);
        document.removeEventListener('mousedown', handleOutsideDetail, true);
      };
    }, [detailModel]);

    // Unified delete handler — used by both keyboard Delete and context menu
    const handleRequestDelete = useCallback((nodeId: string) => {
      setPendingDelete({ nodeIds: [], edgeIds: [], fileId: nodeId });
    }, []);
    // Track ReactFlow viewport for CircleOverlay sync
    const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });

    // Canvas center in flow coordinates — fixed at origin, ReactFlow's default fitView center
    const [circleSelected, setCircleSelected] = useState(false);
    const [circleVisible, setCircleVisible] = useState(true);

    // Ref flag: set to true just before setCircle() in autoLayoutEcoreBoxes so the
    // useEffect below can call fitViewToCircle once React has committed the new circle.
    const pendingFitToCircle = useRef(false);

    // Add-reaction mode: first clicked node becomes source, second creates the edge
    const [reactionSourceId, setReactionSourceId] = useState<string | null>(null);

    useEffect(() => {
      if (!circleVisible) return;
      const displaced = clampAllNodesToCircle(nodes, circle);
      if (displaced.size > 0) {
        setNodes(prev => prev.map(n => {
          const newPos = displaced.get(n.id);
          return newPos ? { ...n, position: newPos } : n;
        }));
      }
      // Nur wenn circleVisible sich ändert
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [circleVisible]);

    // Circle geometry — radius changes only when ecoreFile node count changes


    const storageKey = getLocalStorageKey(userId, vsumId);

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
      undo,
      redo,
      canUndo,
      canRedo,
      updateEdgeCode,
      setHistoryPaused,
      establishBaseline,
    } = useFlowState();
    const [circle, setCircle] = useCircleContainment(nodes);
    const { viewTypes, addViewType, deleteViewType, updateAngle, unlinkNode } = useViewTypes(vsumId);


    // Helper function to calculate optimal handles based on which direction target is from source
    const calculateOptimalHandles = useCallback((sourceNode: Node, targetNode: Node) => {
      const dx = targetNode.position.x - sourceNode.position.x;
      const dy = targetNode.position.y - sourceNode.position.y;

      // Simple rule: compare vertical vs horizontal distance
      if (Math.abs(dy) > Math.abs(dx)) {
        // Vertical connection is dominant
        if (dy > 0) {
          // Target is BELOW source
          return { sourceHandle: 'bottom-source', targetHandle: 'top-target' };
        } else {
          // Target is ABOVE source
          return { sourceHandle: 'top-source', targetHandle: 'bottom-target' };
        }
      } else if (dx > 0) {
        // Horizontal connection is dominant - Target is to the RIGHT of source
        return { sourceHandle: 'right-source', targetHandle: 'left-target' };
      } else {
        // Horizontal connection is dominant - Target is to the LEFT of source
        return { sourceHandle: 'left-source', targetHandle: 'right-target' };
      }
    }, []);

    // Helper to update a single edge's handles based on node positions
    const updateEdgeHandles = useCallback((edge: Edge, currentNodes: Node[]) => {
      // Update handles for both reactions and UML edges
      if (edge.type !== 'reactions' && edge.type !== 'uml') return edge;

      const sourceNode = currentNodes.find(n => n.id === edge.source);
      const targetNode = currentNodes.find(n => n.id === edge.target);

      if (!sourceNode || !targetNode) return edge;

      // Use calculateOptimalHandles to get new handles
      const handles = calculateOptimalHandles(sourceNode, targetNode);
      const newSourceHandle = edge.type === 'uml' ? handles.sourceHandle : handles.sourceHandle.replace('-source', '').replace('-target', '');
      const newTargetHandle = edge.type === 'uml' ? handles.targetHandle : handles.targetHandle.replace('-target', '').replace('-source', '');

      // Only update if handles changed
      if (edge.sourceHandle === newSourceHandle && edge.targetHandle === newTargetHandle) {
        return edge;
      }

      const dx = targetNode.position.x - sourceNode.position.x;
      const dy = targetNode.position.y - sourceNode.position.y;
      console.log(`✅ Auto-updating ${edge.type} edge ${edge.id} handles:`, {
        positions: { dx, dy },
        old: { source: edge.sourceHandle, target: edge.targetHandle },
        new: { source: newSourceHandle, target: newTargetHandle }
      });

      return {
        ...edge,
        sourceHandle: newSourceHandle,
        targetHandle: newTargetHandle,
        // Clear custom control point since path needs recalculation
        data: {
          ...edge.data,
          customControlPoint: undefined,
        }
      };
    }, [calculateOptimalHandles]);

    // Recalculate edge handles after node drag ends
    const recalculateEdgeHandles = useCallback(() => {
      console.log('🔄 Node drag finished, recalculating edge handles...');

      if (!reactFlowInstance) return;

      const currentNodes = reactFlowInstance.getNodes();
      setEdges(currentEdges => currentEdges.map(edge => updateEdgeHandles(edge, currentNodes)));
    }, [reactFlowInstance, setEdges, updateEdgeHandles]);

    const onNodesChange = useCallback((changes: any) => {
      const clampedChanges = changes.map((change: any) => {
        if (change.type !== 'position' || !change.position) return change;

        let pos = change.position;

        // 1. Clamp to circle boundary (workspace only — not in UML view)
        if (circleVisible && !umlModalOpen) {
          const domNode = document.querySelector(`.react-flow__node[data-id="${change.id}"]`);
          const nodeSize = domNode
            ? { width: domNode.clientWidth, height: domNode.clientHeight }
            : { width: 280, height: 180 };
          pos = clampToCircle(pos, circle, nodeSize);
        }

        // 2. Block movement into another EcoreFileBox
        const self = nodes.find(n => n.id === change.id);
        if (self?.type === 'ecoreFile') {
          const others = nodes.filter(n => n.id !== change.id && n.type === 'ecoreFile');
          const wouldOverlap = others.some(n =>
            ecoreRectsOverlap(pos.x, pos.y, n.position.x, n.position.y),
          );
          if (wouldOverlap) pos = self.position; // hard wall — revert to current position
        }

        return { ...change, position: pos };
      });

      const isDragging = clampedChanges.some(
        (c: any) => c.type === 'position' && c.dragging === true,
      );
      const dragEnded = clampedChanges.some(
        (c: any) => c.type === 'position' && c.dragging === false,
      );
      if (isDragging) setHistoryPaused(true);
      if (dragEnded) setHistoryPaused(false);

      originalOnNodesChange(clampedChanges);

      // Close model detail panel when its box is moved
      if (detailModel) {
        const detailName = detailModel.model?.name as string | undefined;
        const detailModelId = detailModel.model?.id;
        const detailBoxDragged = clampedChanges.some((c: any) => {
          if (c.type !== 'position' || !c.dragging) return false;
          const node = nodes.find(n => n.id === c.id);
          if (node?.type !== 'ecoreFile') return false;
          if (detailModelId != null) {
            return node.data?.metaModelId === detailModelId
              || node.data?.metaModelSourceId === detailModelId;
          }
          if (detailName && node.data?.fileName) {
            return String(node.data.fileName).replace(/\.ecore$/i, '') === detailName;
          }
          return false;
        });
        if (detailBoxDragged) setDetailModel(null);
      }

      const finishedDragging = clampedChanges.some(
        (c: any) => c.type === 'position' && c.dragging === false,
      );
      if (finishedDragging) {
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
    }, [originalOnNodesChange, recalculateEdgeHandles, circle, circleVisible, umlModalOpen, nodes, detailModel, setEdges]);


    const edgeColorMapRef = useRef<Map<string, string>>(new Map());
    const nextColorIndexRef = useRef<number>(0);


    useEffect(() => {
      console.log('Loading edge color map for:', { userId, vsumId, storageKey });
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw) as Record<string, string>;
          edgeColorMapRef.current = new Map(Object.entries(parsed));
          const used = new Set(Object.values(parsed));
          let maxIndex = 0;
          COLOR_LIST.forEach((c, i) => {
            if (used.has(c)) maxIndex = Math.max(maxIndex, i + 1);
          });
          nextColorIndexRef.current = maxIndex % COLOR_LIST.length;
          console.log('Loaded edge color map:', edgeColorMapRef.current.size, 'entries');
        } else {
          console.log('No edge color map found, resetting');
          edgeColorMapRef.current = new Map();
          nextColorIndexRef.current = 0;
        }
      } catch (e) {
        console.warn('Failed to load edge color map', e);
        edgeColorMapRef.current = new Map();
        nextColorIndexRef.current = 0;
      }
    }, [userId, vsumId, storageKey]);

    useEffect(() => {
      if (!reactFlowInstance) return;
      const timeout = setTimeout(() => {
      }, 500); // ← 100ms war zu wenig
      return () => clearTimeout(timeout);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reactFlowInstance]);

    const persistEdgeColorMap = useCallback(() => {
      try {
        const obj: Record<string, string> = {};
        edgeColorMapRef.current.forEach((v, k) => {
          obj[k] = v;
        });
        localStorage.setItem(storageKey, JSON.stringify(obj));
        console.log('Persisted edge color map to:', storageKey);
      } catch (e) {
        console.error('Failed to persist edge color map', e);
      }
    }, [storageKey]);

    const getColorForPair = useCallback((idA: string, idB: string) => {
      const key = pairKey(idA, idB);
      const existing = edgeColorMapRef.current.get(key);
      if (existing) return existing;
      const color = COLOR_LIST[nextColorIndexRef.current % COLOR_LIST.length];
      edgeColorMapRef.current.set(key, color);
      nextColorIndexRef.current += 1;
      persistEdgeColorMap();
      return color;
    }, [persistEdgeColorMap]);

    // Helper to collect edges for each side of a node
    const collectNodeSideEdges = useCallback((node: Node, allEdges: Edge[]) => {
      const sideMap = new Map<HandlePosition, string[]>();
      (['top', 'bottom', 'left', 'right'] as HandlePosition[]).forEach(pos => {
        sideMap.set(pos, []);
      });

      allEdges.forEach(edge => {
        if (edge.type !== 'reactions') return;

        if (edge.source === node.id && edge.sourceHandle) {
          const handle = edge.sourceHandle as HandlePosition;
          if (!sideMap.get(handle)?.includes(edge.id)) {
            sideMap.get(handle)?.push(edge.id);
          }
        }

        if (edge.target === node.id && edge.targetHandle) {
          const handle = edge.targetHandle as HandlePosition;
          if (!sideMap.get(handle)?.includes(edge.id)) {
            sideMap.get(handle)?.push(edge.id);
          }
        }
      });

      return sideMap;
    }, []);

    // Helper to create edge sort comparator based on the other connected node
    const createEdgeSortComparator = useCallback((nodeId: string, allEdges: Edge[]) => {
      return (a: string, b: string) => {
        const edgeA = allEdges.find(e => e.id === a);
        const edgeB = allEdges.find(e => e.id === b);
        if (!edgeA || !edgeB) return 0;

        const otherNodeA = edgeA.source === nodeId ? edgeA.target : edgeA.source;
        const otherNodeB = edgeB.source === nodeId ? edgeB.target : edgeB.source;

        return otherNodeA.localeCompare(otherNodeB);
      };
    }, []);

    // Helper to build distribution metadata for a node's sides
    const buildNodeDistribution = useCallback((
      nodeId: string,
      sideMap: Map<HandlePosition, string[]>,
      allEdges: Edge[]
    ) => {
      const nodeDistribution = new Map<HandlePosition, Array<{ edgeId: string; index: number; total: number }>>();
      const comparator = createEdgeSortComparator(nodeId, allEdges);

      sideMap.forEach((edgeIds, position) => {
        const sortedEdgeIds = [...edgeIds].sort(comparator);
        const total = sortedEdgeIds.length;
        const distribution = sortedEdgeIds.map((edgeId, index) => ({ edgeId, index, total }));
        nodeDistribution.set(position, distribution);

        if (total > 1) {
          console.log(`📊 Node ${nodeId} - ${position} handle: ${total} edges`, sortedEdgeIds);
        }
      });

      return nodeDistribution;
    }, [createEdgeSortComparator]);

    // Calculate edge distribution metadata for each node side
    const edgeDistributionMap = useMemo(() => {
      const map = new Map<string, Map<HandlePosition, Array<{ edgeId: string; index: number; total: number }>>>();

      nodes.forEach(node => {
        if (node.type !== 'ecoreFile') return;

        const sideMap = collectNodeSideEdges(node, edges);
        const nodeDistribution = buildNodeDistribution(node.id, sideMap, edges);
        map.set(node.id, nodeDistribution);
      });

      return map;
    }, [nodes, edges, collectNodeSideEdges, buildNodeDistribution]);

    useEffect(() => {
      console.log('EDGES STATE CHANGED:', edges);
      console.log('Number of edges:', edges.length);
      if (edges.length > 0) {
        console.log('First edge:', edges[0]);
      }
    }, [edges]);

    const { onDrop, onDragOver } = useDragAndDrop({
      reactFlowInstance,
      reactFlowWrapper,
      addNode,
      addEdge,
    });

    const isPositionInsideNode = useCallback((
      position: { x: number; y: number },
      node: Node
    ): boolean => {
      const { width, height } = node.type === 'ecoreFile' ? ECORE_FILE_BOX_SIZE : NODE_DIMENSIONS;
      return (
        position.x >= node.position.x &&
        position.x <= node.position.x + width &&
        position.y >= node.position.y &&
        position.y <= node.position.y + height
      );
    }, []);

    const findEcoreTargetAtPosition = useCallback((
      flowPosition: { x: number; y: number },
      sourceNodeId: string,
    ): Node | null => {
      const candidates = nodes.filter(
        n => n.type === 'ecoreFile' && n.id !== sourceNodeId,
      );
      const hit = candidates.find(n => isPositionInsideNode(flowPosition, n));
      if (hit) return hit;

      let closest: Node | null = null;
      let minDist = Infinity;
      for (const n of candidates) {
        const cx = n.position.x + ECORE_FILE_BOX_SIZE.width / 2;
        const cy = n.position.y + ECORE_FILE_BOX_SIZE.height / 2;
        const dist = Math.hypot(flowPosition.x - cx, flowPosition.y - cy);
        if (dist < minDist && dist <= 80) {
          minDist = dist;
          closest = n;
        }
      }
      return closest;
    }, [nodes, isPositionInsideNode]);

    const getMetaModelSourceIdForNode = useCallback((nodeId?: string | null) => {
      if (!nodeId) return undefined;
      const node = nodes.find(n => n.id === nodeId);
      const value = node?.data?.metaModelSourceId ?? node?.data?.metaModelId;
      return typeof value === 'number' ? value : undefined;
    }, [nodes]);

    const getBackendMetaModelIdForNode = useCallback((nodeId?: string | null) => {
      if (!nodeId) return undefined;
      const node = nodes.find(n => n.id === nodeId);
      const value = node?.data?.metaModelId ?? node?.data?.metaModelSourceId;
      return typeof value === 'number' ? value : undefined;
    }, [nodes]);

    useEffect(() => {
      const isEditableElement = (target: HTMLElement): boolean => {
        return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true';
      };

      const handleDeleteKey = (event: KeyboardEvent): boolean => {
        const selectedNodes = nodes.filter(n => n.selected);
        const selectedEdges = edges.filter(e => e.selected);
        const ecoreNodes = selectedNodes.filter(n => n.type === 'ecoreFile');
        const otherNodes = selectedNodes.filter(n => n.type !== 'ecoreFile');

        // Any selected connection → remove only edges (never a meta-model box)
        if (selectedEdges.length > 0) {
          event.preventDefault();
          setPendingDelete({
            nodeIds: otherNodes.map(n => n.id),
            edgeIds: selectedEdges.map(e => e.id),
            fileId: null,
          });
          return true;
        }

        const ecoreTargetId = ecoreNodes[0]?.id ?? selectedFileId;
        if (ecoreTargetId) {
          event.preventDefault();
          setPendingDelete({
            nodeIds: otherNodes.map(n => n.id),
            edgeIds: [],
            fileId: ecoreTargetId,
          });
          return true;
        }

        if (otherNodes.length > 0) {
          event.preventDefault();
          setPendingDelete({ nodeIds: otherNodes.map(n => n.id), edgeIds: [], fileId: null });
          return true;
        }

        return false;
      };

      const handleUndoRedo = (event: KeyboardEvent): void => {
        const key = event.key.toLowerCase();

        if (key === 'z') {
          event.preventDefault();
          if (event.shiftKey && canRedo) redo();
          else if (!event.shiftKey && canUndo) undo();
        } else if (key === 'y' && canRedo) {
          event.preventDefault();
          redo();
        }
      };

      const handleKeyDown = (event: KeyboardEvent) => {
        if (isEditableElement(event.target as HTMLElement)) return;

        const isDeleteKey = event.key === 'Delete' || event.key === 'Backspace';
        if (isDeleteKey && handleDeleteKey(event)) return;

        const hasModifier = event.ctrlKey || event.metaKey;
        if (hasModifier) handleUndoRedo(event);
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo, canUndo, canRedo, nodes, edges, selectedFileId, onEcoreFileDelete, setPendingDelete]);


    const buildInitialReactionCode = useCallback((sourceNodeId: string, targetNodeId: string): string => {
      const sourceNode = nodes.find(n => n.id === sourceNodeId);
      const targetNode = nodes.find(n => n.id === targetNodeId);

      const getEPackageName = (node: Node | undefined) => {
        const match = node?.data?.fileContent?.match(/<ecore:EPackage[^>]+name="([^"]+)"/);
        return match?.[1] ?? node?.data?.fileName?.replace('.ecore', '') ?? 'source';
      };

      const sourcePackageName = getEPackageName(sourceNode);
      const targetPackageName = getEPackageName(targetNode);
      const sourceUri = sourceNode?.data?.nsUri ?? `http://vitruv.tools/${sourcePackageName}`;
      const targetUri = targetNode?.data?.nsUri ?? `http://vitruv.tools/${targetPackageName}`;

      return `import "${sourceUri}" as ${sourcePackageName}\nimport "${targetUri}" as ${targetPackageName}\n\nreactions: ${sourcePackageName}To${targetPackageName}\nin reaction to changes in ${sourcePackageName}\nexecute actions in ${targetPackageName}\n\n`;
    }, [nodes]);

    const resolveReactionFileId = async (raw: any): Promise<number | null> => {
      if (typeof raw === 'number') return raw;
      if (typeof raw === 'string') return Number(raw) || null;
      if (typeof raw?.id === 'number') return raw.id;
      return null;
    };

    const uploadReactionFile = useCallback(async (
      sourceNodeId: string,
      targetNodeId: string,
      edgeId: string
    ): Promise<number | null> => {
      const uniquePadding = ' '.repeat(Math.floor(Math.random() * 50) + 1);
      const initialContent = buildInitialReactionCode(sourceNodeId, targetNodeId) + uniquePadding;
      const fileName = `reaction-${Date.now()}-${Math.random().toString(36).slice(2)}.reactions`;
      const file = new File([initialContent], fileName, { type: 'text/plain;charset=utf-8' });

      try {
        const uploadResult = await apiService.uploadFile(file, 'REACTION');
        const reactionFileId = await resolveReactionFileId(uploadResult?.data);
        if (reactionFileId == null) {
          console.error('❌ Upload succeeded but no file ID returned');
        } else {
          console.log('✅ Reaction file created for new edge:', edgeId, 'fileId:', reactionFileId);
        }
        return reactionFileId;
      } catch (err) {
        console.error('Failed to create reaction file for new edge:', err);
        return null;
      }
    }, [buildInitialReactionCode]);


    const buildNewEdge = useCallback((
      sourceNodeId: string,
      targetNode: Node,
      reactionFileId: number | null,
      color: string
    ): Edge | null => {
      const sourceNode = nodes.find(n => n.id === sourceNodeId);
      if (!sourceNode) return null;

      const handles = calculateOptimalHandles(sourceNode, targetNode);
      const sourceHandle = handles.sourceHandle.replace('-source', '').replace('-target', '');
      const targetHandle = handles.targetHandle.replace('-target', '').replace('-source', '');

      const edgeId = `edge-${sourceNodeId}-${targetNode.id}-${Date.now()}`;
      return {
        id: edgeId,
        source: sourceNodeId,
        target: targetNode.id,
        sourceHandle,
        targetHandle,
        type: 'reactions',
        style: { stroke: color, strokeWidth: 2 },
        data: {
          reactionFileId,
          sourceMetaModelId: getBackendMetaModelIdForNode(sourceNodeId),
          targetMetaModelId: getBackendMetaModelIdForNode(targetNode.id),
          sourceMetaModelSourceId: getMetaModelSourceIdForNode(sourceNodeId),
          targetMetaModelSourceId: getMetaModelSourceIdForNode(targetNode.id),
        },
      };
    }, [nodes, calculateOptimalHandles, getBackendMetaModelIdForNode, getMetaModelSourceIdForNode]);

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
      return findEcoreTargetAtPosition(flowPosition, sourceNodeId);
    }, [nodes, reactFlowInstance, findEcoreTargetAtPosition]);

    const commitReactionEdge = useCallback((newEdge: Edge) => {
      setEdges(prev => {
        const exists = prev.some(
          e => e.type === 'reactions' && e.source === newEdge.source && e.target === newEdge.target,
        );
        if (exists) return prev;
        return [...prev, newEdge];
      });
      window.setTimeout(() => recalculateEdgeHandles(), 0);
    }, [setEdges, recalculateEdgeHandles]);

    const handleConnectionEnd = useCallback(async (e: MouseEvent) => {
      const dragState = connectionDragState;
      setConnectionDragState(null);

      if (!reactFlowInstance || !dragState?.isActive || !dragState.sourceNodeId) {
        return;
      }

      const sourceNodeId = dragState.sourceNodeId;
      const targetNode = findEcoreTargetFromPointer(e.clientX, e.clientY, sourceNodeId);

      if (!targetNode) return;

      const alreadyConnected = edges.some(edge =>
        edge.source === sourceNodeId && edge.target === targetNode.id,
      );
      if (alreadyConnected) return;

      const color = getColorForPair(sourceNodeId, targetNode.id);
      const edgeId = `edge-${sourceNodeId}-${targetNode.id}-${Date.now()}`;
      const reactionFileId = await uploadReactionFile(sourceNodeId, targetNode.id, edgeId);
      const newEdge = buildNewEdge(sourceNodeId, targetNode, reactionFileId, color);
      if (newEdge) {
        commitReactionEdge(newEdge);
      }
    }, [
      reactFlowInstance,
      edges,
      connectionDragState,
      getColorForPair,
      findEcoreTargetFromPointer,
      uploadReactionFile,
      buildNewEdge,
      commitReactionEdge,
    ]);

    const handleConnectionMove = useCallback((e: MouseEvent) => {
      if (!reactFlowInstance) return;

      const flowPosition = reactFlowInstance.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });

      console.log('🟨 handleConnectionMove - updating position:', flowPosition);

      setConnectionDragState(prev => {
        if (!prev?.isActive) return prev;
        return {
          ...prev,
          currentPosition: flowPosition,
        };
      });
    }, [reactFlowInstance]);

    useEffect(() => {
      if (!connectionDragState?.isActive) return;

      const handleMove = (e: any) => handleConnectionMove(e);
      const handleEnd = (e: any) => handleConnectionEnd(e);
      const captureOptions = { capture: true };

      // Add listeners to both document and globalThis for cross-browser compatibility
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


    const handleEdgeDoubleClick = useCallback(async (edgeId: string) => {
      const edge = edges.find(e => e.id === edgeId);
      if (!edge) return;

      const getFileName = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        return node?.type === 'ecoreFile' ? node.data.fileName : undefined;
      };

      let initialCode = edge.data?.code || '';
      const reactionFileId = edge.data?.reactionFileId;

      if (!initialCode && typeof reactionFileId === 'number') {
        try {
          initialCode = await apiService.getFile(reactionFileId);
        } catch (error) {
          console.error('Failed to fetch reaction file', error);
        }
      }

      if (!initialCode || initialCode.trim() === '') {
        initialCode = buildInitialReactionCode(edge.source, edge.target);
      }

      setCodeEditorState({
        isOpen: true,
        edgeId,
        initialCode,
        sourceFileName: getFileName(edge.source),
        targetFileName: getFileName(edge.target),
        reactionFileId,
      });
    }, [edges, nodes, buildInitialReactionCode]);

    const handleCloseCodeEditor = useCallback(() => {
      setCodeEditorState(null);
    }, []);

    const handleSaveCode = useCallback(async (code: string) => {
      if (!codeEditorState?.edgeId) {
        return;
      }

      const edgeId = codeEditorState.edgeId;

      const toFiniteNumber = (value: unknown): number | null => {
        if (typeof value === 'number') return Number.isFinite(value) ? value : null;
        if (typeof value === 'string') {
          const parsed = Number(value);
          return Number.isFinite(parsed) ? parsed : null;
        }
        return null;
      };

      const extractFileId = (data: unknown): number | null => {
        if (data == null) return null;
        const direct = toFiniteNumber(data);
        if (direct !== null) return direct;
        if (typeof data === 'object' && 'id' in (data as Record<string, unknown>)) {
          return toFiniteNumber((data as Record<string, unknown>).id);
        }
        return null;
      };

      try {
        const fileName = `reaction-${Date.now()}-${Math.random().toString(36).slice(2)}.reactions`;
        const file = new File([code], fileName, { type: 'text/plain;charset=utf-8' });

        let reactionFileId = codeEditorState.reactionFileId ?? null;

        if (reactionFileId == null) {
          const uploadResult = await apiService.uploadFile(file, 'REACTION');
          reactionFileId = extractFileId(uploadResult?.data);
          if (reactionFileId == null) {
            throw new Error('Reaction file upload succeeded but did not return a file ID.');
          }
        } else {
          await apiService.updateReactionFile(reactionFileId, file);
        }

        updateEdgeCode(edgeId, code);

        if (reactionFileId != null) {
          setCodeEditorState(prev =>
            prev
              ? {
                ...prev,
                reactionFileId,
              }
              : prev
          );
        }

        setEdges(prev =>
          prev.map(edge =>
            edge.id === edgeId
              ? {
                ...edge,
                data: {
                  ...edge.data,
                  reactionFileId: reactionFileId ?? edge.data?.reactionFileId ?? null,
                  sourceMetaModelId:
                    getBackendMetaModelIdForNode(edge.source) ??
                    edge.data?.sourceMetaModelId,
                  targetMetaModelId:
                    getBackendMetaModelIdForNode(edge.target) ??
                    edge.data?.targetMetaModelId,
                  sourceMetaModelSourceId:
                    getMetaModelSourceIdForNode(edge.source) ??
                    edge.data?.sourceMetaModelSourceId,
                  targetMetaModelSourceId:
                    getMetaModelSourceIdForNode(edge.target) ??
                    edge.data?.targetMetaModelSourceId,
                },
              }
              : edge
          )
        );
      } catch (err) {
        console.error('Failed to save reaction file', err);
        throw err;
      }
    }, [codeEditorState, updateEdgeCode, setEdges, getBackendMetaModelIdForNode, getMetaModelSourceIdForNode]);

    const handleDeleteEdge = useCallback(() => {
      if (codeEditorState?.edgeId) {
        removeEdge(codeEditorState.edgeId);
        setCodeEditorState(null);
      }
    }, [codeEditorState, removeEdge]);

    const handleToolClick = useCallback((toolType: string, toolName: string, diagramType?: string) => {
      if (!reactFlowInstance || !reactFlowWrapper.current) return;

      const canvasBounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = reactFlowInstance.project({
        x: canvasBounds.width / 2,
        y: canvasBounds.height / 2,
      });

      const label = getToolLabel(toolType, toolName);

      const newNode: Omit<Node, 'id'> = {
        type: 'editable',
        position,
        data: {
          label,
          toolType,
          toolName,
          diagramType
        }
      };

      console.log('Adding new node from tool click:', newNode);
      addNode(newNode);
    }, [reactFlowInstance, addNode]);

    const loadDiagramData = useCallback((newNodes: any[], newEdges: any[]) => {
      console.log('Loading diagram data (raw):', { newNodes, newEdges });

      const nodesWithIds = newNodes.map((n, idx) => ({
        ...n,
        id: n.id ?? `loaded-node-${idx}-${Date.now()}`,
      }));

      const seen = new Set<string>();
      const edgesWithUniqueIds = newEdges.map((e, idx) => {
        let baseId = e.id ?? `loaded-edge-${idx}`;
        if (seen.has(baseId)) {
          let k = 1;
          let newId = `${baseId}-${k}`;
          while (seen.has(newId)) {
            k += 1;
            newId = `${baseId}-${k}`;
          }
          console.warn('🔁 Renaming duplicate loaded edge id:', baseId, '→', newId, e);
          baseId = newId;
        }
        seen.add(baseId);

        return {
          ...e,
          id: baseId,
        };
      });

      console.log(
        'Edges after uniquify:',
        edgesWithUniqueIds.map(e => e.id)
      );

      setHistoryPaused(true);
      setNodes([]);
      setEdges([]);
      if (nodesWithIds.length > 0) setNodes(nodesWithIds);
      if (edgesWithUniqueIds.length > 0) setEdges(edgesWithUniqueIds);

      // Reset undo baseline to the loaded diagram (not the pre-load empty state).
      requestAnimationFrame(() => {
        establishBaseline({
          nodes: nodesWithIds,
          edges: edgesWithUniqueIds,
        });
        setHistoryPaused(false);
      });

      console.log('Diagram data loaded successfully');
    }, [setNodes, setEdges, setHistoryPaused, establishBaseline]);


    const handleDragOver = useCallback((event: React.DragEvent) => {
      onDragOver(event);
      setIsDragOver(true);
    }, [onDragOver]);

    const handleDragLeave = useCallback(() => {
      setIsDragOver(false);
    }, []);

    const handleDrop = useCallback((event: React.DragEvent) => {
      setIsDragOver(false);
      onDrop(event);
    }, [onDrop]);

    const handleLabelChange = useCallback((id: string, newLabel: string) => {
      updateNodeLabel(id, newLabel);
    }, [updateNodeLabel]);

    const handleConnectionStart = useCallback((
      nodeId: string,
      handle: HandlePosition,
      tipScreenPos: { x: number; y: number }
    ) => {
      if (!reactFlowInstance) return;

      // Convert the DOM screen position of the arrow tip to flow coordinates
      const flowTipPos = reactFlowInstance.screenToFlowPosition(tipScreenPos);

      setConnectionDragState({
        isActive: true,
        sourceNodeId: nodeId,
        sourceHandle: handle,
        currentPosition: flowTipPos,
        sourceTipPosition: flowTipPos,
      });
    }, [reactFlowInstance]);


    // Uses the ref mirror so it is safe to call from any closure or setTimeout without
    // worrying about stale captures of reactFlowInstance.
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

    const fitViewToCircle = useCallback((c: Circle) => {
      const inst = reactFlowInstanceRef.current;
      if (!inst || !reactFlowWrapper.current) return;
      const { width, height } = reactFlowWrapper.current.getBoundingClientRect();
      if (!width || !height) return;
      const padding = 60;
      const zoom = Math.min(
        (width - padding * 2) / (c.r * 2),
        (height - padding * 2) / (c.r * 2)
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
      const padding = 60;
      const zoom = Math.min(
        (width - padding * 2) / (newR * 2),
        (height - padding * 2) / (newR * 2)
      );
      const clampedZoom = Math.min(Math.max(zoom, 0.05), 2);
      reactFlowInstance.setViewport({
        x: width / 2 - circle.cx * clampedZoom,
        y: height / 2 - circle.cy * clampedZoom,
        zoom: clampedZoom,
      });
    }, [reactFlowInstance, circle.cx, circle.cy]);

    const handleAddViewType = useCallback((
      label: string, scope: ViewTypeScope, linkedNodeIds: string[], angle: number, editable: boolean
    ) => {
      addViewType({ label, scope, angle, linkedNodeIds, editable });
    }, [addViewType]);


    const handleCircleResize = useCallback((newR: number) => {
      const MIN_RADIUS = 260;
      const safeR = Math.max(MIN_RADIUS, newR);
      const newCircle: Circle = { ...circle, r: safeR };
      setCircle(newCircle);

      const displaced = clampAllNodesToCircle(nodes, newCircle);
      if (displaced.size > 0) {
        setNodes(prev => prev.map(n => {
          const newPos = displaced.get(n.id);
          return newPos ? { ...n, position: newPos } : n;
        }));
      }
      fitViewToCircle(newCircle);
    }, [circle, setCircle, nodes, setNodes, fitViewToCircle]);

    const handleEcoreFileSelect = useCallback((fileName: string) => {
      const ecoreNode = nodes.find(
        n => n.type === 'ecoreFile' && n.data.fileName === fileName
      );
      if (!ecoreNode) return;

      // ── Add-reaction mode: two-click edge creation ──────────────────────────
      if (addReactionMode) {
        if (!reactionSourceId) {
          // First click — set as source
          setReactionSourceId(ecoreNode.id);
        } else if (reactionSourceId === ecoreNode.id) {
          // Clicked same node — deselect source
          setReactionSourceId(null);
        } else {
          // Second click — create reaction edge
          const sourceNode = nodes.find(n => n.id === reactionSourceId);
          if (sourceNode) {
            const color = getColorForPair(sourceNode.id, ecoreNode.id);
            const handles = calculateOptimalHandles(sourceNode, ecoreNode);
            const cleanSrc = handles.sourceHandle.replace('-source', '').replace('-target', '');
            const cleanTgt = handles.targetHandle.replace('-target', '').replace('-source', '');
            const newEdge: Edge = {
              id: `edge-reaction-${Date.now()}`,
              source: sourceNode.id,
              target: ecoreNode.id,
              type: 'reactions',
              sourceHandle: cleanSrc,
              targetHandle: cleanTgt,
              data: {
                code: '',
                backendRelationId: null,
                reactionFileId: null,
                sourceMetaModelId: sourceNode.data?.metaModelId ?? sourceNode.data?.metaModelSourceId,
                targetMetaModelId: ecoreNode.data?.metaModelId ?? ecoreNode.data?.metaModelSourceId,
                sourceMetaModelSourceId: sourceNode.data?.metaModelSourceId ?? sourceNode.data?.metaModelId,
                targetMetaModelSourceId: ecoreNode.data?.metaModelSourceId ?? ecoreNode.data?.metaModelId,
              },
              style: { stroke: color, strokeWidth: 2 },
            };
            commitReactionEdge(newEdge);
          }
          setReactionSourceId(null);
          onReactionModeEnd?.();
        }
        return; // don't do normal select in reaction mode
      }

      // ── Normal select ───────────────────────────────────────────────────────
      setSelectedFileId(ecoreNode.id);
      onEcoreFileSelect?.(fileName);
    }, [nodes, onEcoreFileSelect, addReactionMode, reactionSourceId, getColorForPair, calculateOptimalHandles, commitReactionEdge, onReactionModeEnd]);

    // Clear reaction source when mode is toggled off
    useEffect(() => {
      if (!addReactionMode) setReactionSourceId(null);
    }, [addReactionMode]);

    // Notify parent whenever undo/redo availability changes
    useEffect(() => {
      onHistoryChange?.(canUndo, canRedo);
    }, [canUndo, canRedo, onHistoryChange]);

    const handleEcoreFileExpand = useCallback((fileName: string, fileContent: string) => {
      const ecoreNode = nodes.find(
        n => n.type === 'ecoreFile' && n.data.fileName === fileName
      );

      if (ecoreNode) {
        setExpandedFileId(ecoreNode.id);
        setSelectedFileId(ecoreNode.id);
      }

      onEcoreFileExpand?.(fileName, fileContent);
    }, [nodes, onEcoreFileExpand]);

    const resetExpandedFile = useCallback(() => {
      setExpandedFileId(null);
      const updatedNodes = nodes.map(n =>
        n.type === 'ecoreFile'
          ? { ...n, data: { ...n.data, isExpanded: false } }
          : n
      );
      setNodes(updatedNodes);
    }, [nodes, setNodes]);

    const addEcoreFile = useCallback((fileName: string, fileContent: string, meta?: any) => {
      const ecoreNodes = nodes.filter(n => n.type === 'ecoreFile');
      const position = findFreeEcorePosition(ecoreNodes, meta?.position ?? { x: 60, y: 60 });
      const metaModelId = typeof meta?.metaModelId === 'number' ? meta.metaModelId : undefined;
      const metaModelSourceId = typeof meta?.metaModelSourceId === 'number'
        ? meta.metaModelSourceId
        : metaModelId;

      const nsUri = extractNsUriFromEcore(fileContent);


      const newEcoreNode: Node = {
        id: `ecore-${Date.now()}`,
        type: 'ecoreFile',
        position: position,
        data: {
          fileName,
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
          onRename: onEcoreFileRename,
          onShowDetails: handleShowDetails,
          isExpanded: false,
        },
        draggable: true,
      };

      addNode(newEcoreNode);
      setSelectedFileId(newEcoreNode.id);

      if (onEcoreFileSelect) {
        onEcoreFileSelect(fileName);
      }
    }, [nodes, addNode, handleEcoreFileExpand, handleEcoreFileSelect, onEcoreFileSelect, onEcoreFileDelete, onEcoreFileRename, handleRequestDelete, handleShowDetails]);

    useEffect(() => {
      const handleCreateReactionEdge = (e: Event) => {
        const custom = e as CustomEvent<{
          sourceNodeId: string;
          targetNodeId: string;
          code: string;
          originalEdgeId: number;
        }>;

        const { sourceNodeId, targetNodeId, code, originalEdgeId } = custom.detail;

        const sourceNode = nodes.find(n => n.id === sourceNodeId);
        const targetNode = nodes.find(n => n.id === targetNodeId);

        if (!sourceNode || !targetNode) {
          console.warn('Could not find nodes for edge creation:', custom.detail);
          return;
        }

        const color = getColorForPair(sourceNodeId, targetNodeId);
        const handles = calculateOptimalHandles(sourceNode, targetNode);

        // Strip -source and -target suffixes from handles for ReactFlow compatibility
        const cleanSourceHandle = handles.sourceHandle.replace('-source', '').replace('-target', '');
        const cleanTargetHandle = handles.targetHandle.replace('-target', '').replace('-source', '');

        const newEdge: Edge = {
          id: `edge-${sourceNodeId}-${targetNodeId}-${Date.now()}`,
          source: sourceNodeId,
          target: targetNodeId,
          sourceHandle: cleanSourceHandle,
          targetHandle: cleanTargetHandle,
          type: 'reactions',
          data: {
            code: code,
            originalEdgeId: originalEdgeId,
            sourceMetaModelId: getBackendMetaModelIdForNode(sourceNodeId),
            targetMetaModelId: getBackendMetaModelIdForNode(targetNodeId),
            sourceMetaModelSourceId: getMetaModelSourceIdForNode(sourceNodeId),
            targetMetaModelSourceId: getMetaModelSourceIdForNode(targetNodeId),
          },
          style: {
            stroke: color,
            strokeWidth: 2,
          },
        };

        console.log('Creating reaction edge from event:', newEdge);
        addEdge(newEdge);
      };

      globalThis.addEventListener('vitruv.createReactionEdge', handleCreateReactionEdge as EventListener);

      return () => {
        globalThis.removeEventListener('vitruv.createReactionEdge', handleCreateReactionEdge as EventListener);
      };
    }, [nodes, addEdge, getColorForPair, getBackendMetaModelIdForNode, getMetaModelSourceIdForNode, calculateOptimalHandles]);

    // Helper to find node by meta model ID
    const findNodeByMetaModelId = useCallback((metaModelId: number) => {
      return nodes.find(n =>
        n.type === 'ecoreFile' &&
        (n.data?.metaModelId === metaModelId || n.data?.metaModelSourceId === metaModelId)
      );
    }, [nodes]);

    // Helper to check if edge already exists between nodes
    const edgeExistsBetweenNodes = useCallback((sourceId: string, targetId: string) => {
      return edges.some(edge =>
        edge.type === 'reactions' &&
        ((edge.source === sourceId && edge.target === targetId) ||
          (edge.source === targetId && edge.target === sourceId))
      );
    }, [edges]);

    // Helper to process a single relation and create edge
    const processRelation = useCallback((
      relation: { id: number; sourceId: number; targetId: number; reactionFileId?: number | null },
      preserveExisting: boolean
    ) => {
      const sourceNode = findNodeByMetaModelId(relation.sourceId);
      const targetNode = findNodeByMetaModelId(relation.targetId);

      if (!sourceNode || !targetNode) {
        console.warn('Could not find nodes for relation:', relation, 'Available nodes:', nodes.filter(n => n.type === 'ecoreFile').map(n => ({ id: n.id, metaModelId: n.data?.metaModelId, metaModelSourceId: n.data?.metaModelSourceId })));
        return;
      }

      const existsByBackendId = edges.some(edge => edge.data?.backendRelationId === relation.id);
      if (existsByBackendId) return;

      if (preserveExisting && edgeExistsBetweenNodes(sourceNode.id, targetNode.id)) {
        console.log('Preserving existing edge between nodes:', sourceNode.id, targetNode.id);
        return;
      }

      const color = getColorForPair(sourceNode.id, targetNode.id);
      const handles = calculateOptimalHandles(sourceNode, targetNode);
      const cleanSourceHandle = handles.sourceHandle.replace('-source', '').replace('-target', '');
      const cleanTargetHandle = handles.targetHandle.replace('-target', '').replace('-source', '');

      console.log(`✅ Creating metamodel connection: ${sourceNode.data?.fileName} → ${targetNode.data?.fileName}`, {
        handles: { source: cleanSourceHandle, target: cleanTargetHandle },
        positions: { source: sourceNode.position, target: targetNode.position }
      });

      const newEdge: Edge = {
        id: `edge-backend-${relation.id}-${Date.now()}`,
        source: sourceNode.id,
        target: targetNode.id,
        type: 'reactions',
        sourceHandle: cleanSourceHandle,
        targetHandle: cleanTargetHandle,
        data: {
          code: '',
          backendRelationId: relation.id,
          reactionFileId: relation.reactionFileId ?? null,
          sourceMetaModelId: sourceNode.data?.metaModelId ?? sourceNode.data?.metaModelSourceId,
          targetMetaModelId: targetNode.data?.metaModelId ?? targetNode.data?.metaModelSourceId,
          sourceMetaModelSourceId: sourceNode.data?.metaModelSourceId ?? sourceNode.data?.metaModelId,
          targetMetaModelSourceId: targetNode.data?.metaModelSourceId ?? targetNode.data?.metaModelId,
        },
        style: {
          stroke: color,
          strokeWidth: 2,
        },
      };

      addEdge(newEdge);
    }, [nodes, edges, findNodeByMetaModelId, edgeExistsBetweenNodes, getColorForPair, calculateOptimalHandles, addEdge]);

    useEffect(() => {
      const handleLoadMetaModelRelations = (e: Event) => {
        const custom = e as CustomEvent<{
          relations?: Array<Record<string, unknown>>;
          preserveExisting?: boolean;
        }>;

        const preserveExisting = custom.detail?.preserveExisting ?? false;
        const relations = (custom.detail?.relations ?? [])
          .map(rel => ({
            id: typeof rel.id === 'number' ? rel.id : 0,
            sourceId: (rel.sourceId ?? rel.sourceMetaModelId) as number,
            targetId: (rel.targetId ?? rel.targetMetaModelId) as number,
            reactionFileId: (rel.reactionFileId ?? rel.reactionFileStorageId ?? null) as number | null,
          }))
          .filter(
            rel => typeof rel.sourceId === 'number' && typeof rel.targetId === 'number',
          );

        relations.forEach(relation => processRelation(relation, preserveExisting));
      };

      globalThis.addEventListener('vitruv.loadMetaModelRelations', handleLoadMetaModelRelations as EventListener);
      globalThis.addEventListener('vitruv.loadRelations', handleLoadMetaModelRelations as EventListener);
      return () => {
        globalThis.removeEventListener('vitruv.loadMetaModelRelations', handleLoadMetaModelRelations as EventListener);
        globalThis.removeEventListener('vitruv.loadRelations', handleLoadMetaModelRelations as EventListener);
      };
    }, [processRelation, reactFlowInstance, fitViewToCircle, circle]);

    useEffect(() => {
      onDiagramChange?.(nodes, edges);
    }, [nodes, edges, onDiagramChange]);

    const getReactionEdges = useCallback(() => {
      return edges.filter(e => e.type === 'reactions');
    }, [edges]);

    const buildWorkspaceSnapshot = useCallback(
      (): WorkspaceSnapshot => buildWorkspaceSnapshotFrom(nodes, edges, getMetaModelSourceIdForNode),
      [nodes, edges, getMetaModelSourceIdForNode],
    );

    useEffect(() => {
      if (!nodes.length || !edges.length) return;

      const nodeIds = new Set(nodes.map(n => n.id));
      const filteredEdges = edges.filter(
        (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
      );

      if (filteredEdges.length !== edges.length) {
        console.log('🧹 Removing orphan reaction edges after node deletion');
        setEdges(filteredEdges);
      }
    }, [nodes, edges, setEdges]);

    useEffect(() => {
      if (!edges.length) return;

      const seen = new Map<string, number>();
      let changed = false;

      const fixedEdges = edges.map((edge) => {
        const count = seen.get(edge.id) ?? 0;

        if (count === 0) {
          seen.set(edge.id, 1);
          return edge;
        }

        const newId = `${edge.id}__${count}`;
        seen.set(edge.id, count + 1);
        changed = true;
        console.warn('🔁 Renaming duplicate edge id:', edge.id, '→', newId, edge);
        return { ...edge, id: newId };
      });

      if (changed) {
        setEdges(fixedEdges);
      }
    }, [edges, setEdges]);

    // Helper to calculate repulsive forces between nodes
    const calculateRepulsiveForces = useCallback((
      componentNodes: string[],
      positions: Map<string, { x: number; y: number }>,
      forces: Map<string, { x: number; y: number }>
    ) => {
      for (let i = 0; i < componentNodes.length; i++) {
        for (let j = i + 1; j < componentNodes.length; j++) {
          const nodeA = componentNodes[i];
          const nodeB = componentNodes[j];
          const posA = positions.get(nodeA)!;
          const posB = positions.get(nodeB)!;

          const dx = posB.x - posA.x;
          const dy = posB.y - posA.y;
          const distance = Math.hypot(dx, dy) || 1;

          const force = LAYOUT_CONFIG.REPULSION_STRENGTH / (distance * distance);
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;

          const forceA = forces.get(nodeA)!;
          const forceB = forces.get(nodeB)!;
          forceA.x -= fx;
          forceA.y -= fy;
          forceB.x += fx;
          forceB.y += fy;
        }
      }
    }, []);

    // Helper to calculate attractive forces for connected nodes
    const calculateAttractiveForces = useCallback((
      componentNodes: string[],
      positions: Map<string, { x: number; y: number }>,
      forces: Map<string, { x: number; y: number }>,
      adjacencyMap: Map<string, Set<string>>,
      idealEdgeLength: number
    ) => {
      componentNodes.forEach(nodeId => {
        const neighbors = adjacencyMap.get(nodeId) || new Set();
        neighbors.forEach(neighborId => {
          if (!componentNodes.includes(neighborId)) return;

          const posA = positions.get(nodeId)!;
          const posB = positions.get(neighborId)!;

          const dx = posB.x - posA.x;
          const dy = posB.y - posA.y;
          const distance = Math.hypot(dx, dy) || 1;

          const force = LAYOUT_CONFIG.ATTRACTION_STRENGTH * (distance - idealEdgeLength);
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;

          const forceA = forces.get(nodeId)!;
          forceA.x += fx;
          forceA.y += fy;
        });
      });
    }, []);

    // Force-directed layout for a single component
    const layoutComponent = useCallback((
      componentNodes: string[],
      startX: number,
      startY: number,
      adjacencyMap: Map<string, Set<string>>
    ) => {
      if (componentNodes.length === 1) {
        return new Map([[componentNodes[0], { x: startX, y: startY }]]);
      }

      const positions = new Map<string, { x: number; y: number }>();
      componentNodes.forEach((nodeId, idx) => {
        const angle = (idx / componentNodes.length) * 2 * Math.PI;
        const radius = Math.max(200, componentNodes.length * 40);
        positions.set(nodeId, {
          x: startX + radius + radius * Math.cos(angle),
          y: startY + radius + radius * Math.sin(angle)
        });
      });

      const idealEdgeLength = LAYOUT_CONFIG.BOX_WIDTH + LAYOUT_CONFIG.MIN_HORIZONTAL_SPACING;

      for (let iter = 0; iter < LAYOUT_CONFIG.ITERATIONS; iter++) {
        const forces = new Map<string, { x: number; y: number }>();
        componentNodes.forEach(nodeId => forces.set(nodeId, { x: 0, y: 0 }));

        calculateRepulsiveForces(componentNodes, positions, forces);
        calculateAttractiveForces(componentNodes, positions, forces, adjacencyMap, idealEdgeLength);

        // Apply forces with damping
        componentNodes.forEach(nodeId => {
          const pos = positions.get(nodeId)!;
          const force = forces.get(nodeId)!;
          pos.x += force.x * LAYOUT_CONFIG.DAMPING;
          pos.y += force.y * LAYOUT_CONFIG.DAMPING;
        });
      }

      // Normalize positions to start from (startX, startY)
      let minX = Infinity, minY = Infinity;
      positions.forEach(pos => {
        minX = Math.min(minX, pos.x);
        minY = Math.min(minY, pos.y);
      });

      positions.forEach(pos => {
        pos.x = pos.x - minX + startX;
        pos.y = pos.y - minY + startY;
      });

      return positions;
    }, [calculateRepulsiveForces, calculateAttractiveForces]);

    // Build adjacency map from edges
    const buildAdjacencyMap = useCallback((ecoreNodes: Node[], allEdges: Edge[]) => {
      const adjacencyMap = new Map<string, Set<string>>();
      ecoreNodes.forEach(node => adjacencyMap.set(node.id, new Set()));

      allEdges.forEach(edge => {
        if (edge.type === 'reactions') {
          adjacencyMap.get(edge.source)?.add(edge.target);
          adjacencyMap.get(edge.target)?.add(edge.source);
        }
      });

      return adjacencyMap;
    }, []);

    // Find connected components using BFS
    const findConnectedComponents = useCallback((
      ecoreNodes: Node[],
      adjacencyMap: Map<string, Set<string>>
    ) => {
      const visited = new Set<string>();
      const components: string[][] = [];
      const isolatedNodes: string[] = [];

      // Identify isolated nodes
      ecoreNodes.forEach(node => {
        if ((adjacencyMap.get(node.id)?.size || 0) === 0) {
          isolatedNodes.push(node.id);
          visited.add(node.id);
        }
      });

      // BFS for connected components
      ecoreNodes.forEach(startNode => {
        if (visited.has(startNode.id)) return;

        const component: string[] = [];
        const queue = [startNode.id];
        visited.add(startNode.id);

        while (queue.length > 0) {
          const nodeId = queue.shift()!;
          component.push(nodeId);

          const neighbors = adjacencyMap.get(nodeId);
          neighbors?.forEach(neighborId => {
            if (!visited.has(neighborId)) {
              visited.add(neighborId);
              queue.push(neighborId);
            }
          });
        }

        if (component.length > 0) {
          components.push(component);
        }
      });

      return { components, isolatedNodes };
    }, []);

    // Helper to optimize edge handles for a set of nodes
    const optimizeEdgeHandles = useCallback((targetNodes: Node[], allEdges: Edge[]) => {
      return allEdges.map(edge => {
        if (edge.type !== 'reactions') return edge;

        const sourceNode = targetNodes.find(n => n.id === edge.source);
        const targetNode = targetNodes.find(n => n.id === edge.target);

        if (!sourceNode || !targetNode) return edge;

        const handles = calculateOptimalHandles(sourceNode, targetNode);
        const cleanSourceHandle = handles.sourceHandle.replace('-source', '').replace('-target', '');
        const cleanTargetHandle = handles.targetHandle.replace('-target', '').replace('-source', '');

        return {
          ...edge,
          sourceHandle: cleanSourceHandle,
          targetHandle: cleanTargetHandle,
          data: {
            ...edge.data,
            customControlPoint: undefined
          }
        };
      });
    }, [calculateOptimalHandles]);

    // Advanced auto-layout with force-directed algorithm for optimal positioning
    const autoLayoutEcoreBoxes = useCallback(() => {
      const ecoreNodes = nodes.filter(n => n.type === 'ecoreFile');
      if (ecoreNodes.length === 0) return;

      console.log('📐 Auto-layouting', ecoreNodes.length, 'ecore boxes with', edges.length, 'edges');

      const adjacencyMap = buildAdjacencyMap(ecoreNodes, edges);
      const { components, isolatedNodes } = findConnectedComponents(ecoreNodes, adjacencyMap);

      console.log(`📊 Layout analysis: ${components.length} components, ${isolatedNodes.length} isolated nodes`);

      // Layout each component
      const positionMap = new Map<string, { x: number; y: number }>();
      let currentY = LAYOUT_CONFIG.START_Y;

      components.forEach(component => {
        const componentPositions = layoutComponent(component, LAYOUT_CONFIG.START_X, currentY, adjacencyMap);
        componentPositions.forEach((pos, nodeId) => positionMap.set(nodeId, pos));

        let maxY = 0;
        componentPositions.forEach(pos => maxY = Math.max(maxY, pos.y));
        currentY = maxY + LAYOUT_CONFIG.BOX_HEIGHT + LAYOUT_CONFIG.MIN_VERTICAL_SPACING * 2;
      });

      // Layout isolated nodes in a compact grid
      if (isolatedNodes.length > 0) {
        const itemsPerRow = Math.ceil(Math.sqrt(isolatedNodes.length * 2));
        isolatedNodes.forEach((nodeId, idx) => {
          const row = Math.floor(idx / itemsPerRow);
          const col = idx % itemsPerRow;
          positionMap.set(nodeId, {
            x: LAYOUT_CONFIG.START_X + col * (LAYOUT_CONFIG.BOX_WIDTH + LAYOUT_CONFIG.MIN_HORIZONTAL_SPACING),
            y: currentY + row * (LAYOUT_CONFIG.BOX_HEIGHT + LAYOUT_CONFIG.MIN_VERTICAL_SPACING)
          });
        });
      }

      // Apply positions to nodes
      const updatedNodes = nodes.map(node => {
        if (node.type !== 'ecoreFile') return node;
        const position = positionMap.get(node.id);
        return position ? { ...node, position } : node;
      });

      setNodes(updatedNodes);

      // Optimize edge handles after layout, then center view on the circle.
      // pendingFitToCircle.current = true signals the useEffect([circle]) below to call
      // fitViewToCircle() once React has committed the new circle state.
      // fitViewToCircle now reads reactFlowInstanceRef (a ref, always current) so there
      // are no stale-closure issues regardless of when the effect fires.
      setTimeout(() => {
        const optimizedEdges = optimizeEdgeHandles(updatedNodes, edges);
        setEdges(optimizedEdges);

        // Recompute circle center from final node positions
        const ecoreUpdated = updatedNodes.filter(n => n.type === 'ecoreFile');
        const newCircle = computeInitialCircle(ecoreUpdated);
        pendingFitToCircle.current = true;   // signal the useEffect to fit after commit
        setCircle(newCircle);
      }, 50);
    }, [nodes, edges, setNodes, setEdges, buildAdjacencyMap, findConnectedComponents, layoutComponent, optimizeEdgeHandles, setCircle]);

    // Listen for auto-layout trigger
    useEffect(() => {
      const handleAutoLayout = () => {
        console.log('📐 Auto-layout triggered via event');
        autoLayoutEcoreBoxes();
      };

      globalThis.addEventListener('vitruv.autoLayoutWorkspace', handleAutoLayout as EventListener);

      return () => {
        globalThis.removeEventListener('vitruv.autoLayoutWorkspace', handleAutoLayout as EventListener);
      };
    }, [autoLayoutEcoreBoxes]);

    // Listen for edge clicks to toggle selection
    useEffect(() => {
      const updateEdgeSelection = (edges: Edge[], edgeId: string, currentlySelected: boolean) =>
        edges.map(edge => ({ ...edge, selected: edge.id === edgeId ? !currentlySelected : false }));

      const deselectAllNodes = (nodes: Node[]) =>
        nodes.map(node => ({ ...node, selected: false }));

      const handleEdgeClick = (e: Event) => {
        const { edgeId, currentlySelected } = (e as CustomEvent<{ edgeId: string; currentlySelected: boolean }>).detail;
        setEdges(prev => updateEdgeSelection(prev, edgeId, currentlySelected));
        setNodes(prev => deselectAllNodes(prev));
        setSelectedFileId(null);
      };

      globalThis.addEventListener('edge-clicked', handleEdgeClick as EventListener);

      return () => {
        globalThis.removeEventListener('edge-clicked', handleEdgeClick as EventListener);
      };
    }, [setEdges, setNodes]);

    // Helper to update a single edge's control point
    const updateEdgeControlPoint = useCallback((edgeId: string, controlPoint: { x: number; y: number } | null) => {
      setEdges(prevEdges => prevEdges.map(edge =>
        edge.id === edgeId
          ? { ...edge, data: { ...edge.data, customControlPoint: controlPoint } }
          : edge
      ));
    }, [setEdges]);

    // Listen for UML edge control point dragging
    useEffect(() => {
      const handleControlDrag = (e: Event) => {
        const customEvent = e as CustomEvent<{ edgeId: string; x: number; y: number }>;
        const { edgeId, x, y } = customEvent.detail;

        if (!reactFlowInstance) return;

        const flowPosition = reactFlowInstance.screenToFlowPosition({ x, y });
        updateEdgeControlPoint(edgeId, flowPosition);
      };

      const handleControlDrop = (e: Event) => {
        const customEvent = e as CustomEvent<{ edgeId: string; point: { x: number; y: number } | null }>;
        const { edgeId, point } = customEvent.detail;
        updateEdgeControlPoint(edgeId, point);
      };

      globalThis.addEventListener('uml-edge-control-drag', handleControlDrag as EventListener);
      globalThis.addEventListener('uml-edge-control-drop', handleControlDrop as EventListener);

      return () => {
        globalThis.removeEventListener('uml-edge-control-drag', handleControlDrag as EventListener);
        globalThis.removeEventListener('uml-edge-control-drop', handleControlDrop as EventListener);
      };
    }, [reactFlowInstance, updateEdgeControlPoint]);

    useImperativeHandle(ref, () => ({
      handleToolClick,
      loadDiagramData,
      getNodes: () => nodes,
      getEdges: () => edges,
      addEcoreFile,
      resetExpandedFile,
      undo,
      redo,
      canUndo,
      canRedo,
      getReactionEdges,
      getWorkspaceSnapshot: buildWorkspaceSnapshot,
      autoLayoutEcoreBoxes,
      fitUmlView,
    }), [handleToolClick, loadDiagramData, nodes, edges, addEcoreFile, resetExpandedFile, undo, redo, canUndo, canRedo, getReactionEdges, buildWorkspaceSnapshot, autoLayoutEcoreBoxes, fitUmlView]);

    const mappedNodes = nodes.map(node => {
      if (node.type === 'editable') {
        return {
          ...node,
          data: {
            ...node.data,
            onLabelChange: handleLabelChange,
            onDelete: removeNode
          }
        };
      }

      if (node.type === 'ecoreFile') {
        return {
          ...node,
          data: {
            ...node.data,
            onExpand: handleEcoreFileExpand,
            onSelect: handleEcoreFileSelect,
            onDelete: onEcoreFileDelete,
            onRequestDelete: handleRequestDelete,
            onRename: onEcoreFileRename,
            onShowDetails: handleShowDetails,
            isExpanded: expandedFileId === node.id,
            onConnectionStart: handleConnectionStart,
            isConnectionActive: connectionDragState?.isActive || false,
            edgeDistribution: edgeDistributionMap.get(node.id),
            isReactionSource: reactionSourceId === node.id,
          },
          selected: selectedFileId === node.id,
          draggable: !connectionDragState?.isActive && !addReactionMode,
        };
      }

      return node;
    });

    const uniqueEdges = useMemo(() => {
      const idCount = new Map<string, number>();

      return edges.map((e, index) => {
        const baseId = e.id || `edge-${index}`;
        const count = idCount.get(baseId) ?? 0;
        idCount.set(baseId, count + 1);

        if (count === 0) {
          return { ...e, id: baseId };
        }

        const newId = `${baseId}-dup-${count}`;
        console.warn('🔁 Renaming duplicate edge id:', baseId, '→', newId, e);
        return { ...e, id: newId };
      });
    }, [edges]);

    const handleEdgeHandleChange = useCallback((edgeId: string, newSourceHandle: string, newTargetHandle: string) => {
      console.log(`🔄 Changing handles for edge ${edgeId}:`, { newSource: newSourceHandle, newTarget: newTargetHandle });
      setEdges(prevEdges => prevEdges.map(edge =>
        edge.id === edgeId
          ? { ...edge, sourceHandle: newSourceHandle, targetHandle: newTargetHandle, data: { ...edge.data, customControlPoint: undefined } }
          : edge
      ));
    }, [setEdges]);

    // Helper to calculate default control point for an edge
    const calculateDefaultControlPoint = useCallback((e: Edge) => {
      const src = nodes.find(n => n.id === e.source);
      const tgt = nodes.find(n => n.id === e.target);
      if (!src || !tgt) return { x: 0, y: 0 };
      return {
        x: (src.position.x + tgt.position.x + NODE_DIMENSIONS.width) / 2,
        y: (src.position.y + tgt.position.y + NODE_DIMENSIONS.height) / 2
      };
    }, [nodes]);

    // Helper to create edge sort comparator for reordering
    const createEdgeReorderComparator = useCallback((
      targetEdgeId: string,
      controlPoint: { x: number; y: number },
      handle: string
    ) => {
      return (a: Edge, b: Edge) => {
        const aPos = a.id === targetEdgeId ? controlPoint : (a.data?.customControlPoint || calculateDefaultControlPoint(a));
        const bPos = b.id === targetEdgeId ? controlPoint : (b.data?.customControlPoint || calculateDefaultControlPoint(b));
        return (handle === 'top' || handle === 'bottom') ? aPos.x - bPos.x : aPos.y - bPos.y;
      };
    }, [calculateDefaultControlPoint]);

    // Helper to apply reordering data to edges
    const applyEdgeReorderData = useCallback((
      prevEdges: Edge[],
      reorderedSourceEdges: Edge[],
      reorderedTargetEdges: Edge[]
    ) => {
      return prevEdges.map(e => {
        const sourceIndex = reorderedSourceEdges.findIndex(re => re.id === e.id);
        const targetIndex = reorderedTargetEdges.findIndex(re => re.id === e.id);

        const foundInSource = sourceIndex >= 0;
        const foundInTarget = targetIndex >= 0;

        if (foundInSource || foundInTarget) {
          return {
            ...e,
            data: {
              ...e.data,
              sourceParallelIndex: foundInSource ? sourceIndex : e.data?.sourceParallelIndex,
              sourceParallelCount: foundInSource ? reorderedSourceEdges.length : e.data?.sourceParallelCount,
              targetParallelIndex: foundInTarget ? targetIndex : e.data?.targetParallelIndex,
              targetParallelCount: foundInTarget ? reorderedTargetEdges.length : e.data?.targetParallelCount,
            }
          };
        }
        return e;
      });
    }, []);

    const performEdgeReorder = useCallback((edgeId: string, controlPoint: { x: number; y: number }) => {
      const edge = edges.find(e => e.id === edgeId);
      if (edge?.type !== 'reactions') return;

      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);
      if (!sourceNode || !targetNode) return;

      setEdges(prevEdges => {
        const sameSourceEdges = prevEdges.filter(e =>
          e.type === 'reactions' && e.source === edge.source && e.sourceHandle === edge.sourceHandle
        );
        const sameTargetEdges = prevEdges.filter(e =>
          e.type === 'reactions' && e.target === edge.target && e.targetHandle === edge.targetHandle
        );

        const sourceComparator = createEdgeReorderComparator(edgeId, controlPoint, edge.sourceHandle!);
        const targetComparator = createEdgeReorderComparator(edgeId, controlPoint, edge.targetHandle!);

        const reorderedSourceEdges = sameSourceEdges.length > 1 ? [...sameSourceEdges].sort(sourceComparator) : sameSourceEdges;
        const reorderedTargetEdges = sameTargetEdges.length > 1 ? [...sameTargetEdges].sort(targetComparator) : sameTargetEdges;

        return applyEdgeReorderData(prevEdges, reorderedSourceEdges, reorderedTargetEdges);
      });
    }, [edges, nodes, setEdges, createEdgeReorderComparator, applyEdgeReorderData]);



    const handleEdgeReorderRequest = useCallback((edgeId: string, controlPoint: { x: number; y: number }) => {
      performEdgeReorder(edgeId, controlPoint);
    }, [performEdgeReorder]);

    // Helper to calculate average source position for merge point
    const calculateAverageSourcePosition = useCallback((eligibleEdges: Edge[]) => {
      let sumX = 0, sumY = 0, count = 0;
      eligibleEdges.forEach(edge => {
        const sourceNode = nodes.find(n => n.id === edge.source);
        if (sourceNode) {
          sumX += sourceNode.position.x + NODE_DIMENSIONS.width / 2;
          sumY += sourceNode.position.y + NODE_DIMENSIONS.height / 2;
          count++;
        }
      });
      return count > 0 ? { x: sumX / count, y: sumY / count } : { x: 0, y: 0 };
    }, [nodes]);

    // Helper to calculate merge point between source average and target
    const calculateMergePoint = useCallback((avgSource: { x: number; y: number }, targetNode: Node) => {
      const targetCenterX = targetNode.position.x + NODE_DIMENSIONS.width / 2;
      const targetCenterY = targetNode.position.y + NODE_DIMENSIONS.height / 2;

      // Place merge point vertically under/above the target center so
      // the last segment into the class box is a straight line into
      // the middle (no diagonal hit on the left/right side).
      return {
        x: targetCenterX,
        y: avgSource.y + (targetCenterY - avgSource.y) * 0.4,
      };
    }, []);

    // Calculate merge points for UML inheritance edges with same target.
    // We keep merge visualization ONLY for inheritance (like multiple
    // subclasses pointing to the same superclass), not for other UML
    // relationships. This gives a clean "fan-in" into the superclass
    // while keeping compositions and associations as simple lines.
    const umlMergeData = useMemo(() => {
      const mergePointsMap = new Map<string, { x: number; y: number; mergeGroupId: string }>();
      const firstInGroupMap = new Map<string, string>();
      const mergeGroupSourceNodesMap = new Map<string, string[]>();
      const hasRelationshipType = (data: unknown): data is { relationshipType?: string } =>
        typeof data === 'object' && data !== null && 'relationshipType' in data;

      // Consider only UML inheritance edges for merging
      const umlInheritanceEdges = uniqueEdges.filter(
        (e) => e.type === 'uml' && hasRelationshipType(e.data) && e.data.relationshipType === 'inheritance'
      );

      if (umlInheritanceEdges.length === 0) {
        return { mergePointsMap, firstInGroupMap, mergeGroupSourceNodesMap };
      }

      // Count inheritance edges per source node
      const edgesPerSource = new Map<string, number>();
      umlInheritanceEdges.forEach((edge) => {
        edgesPerSource.set(edge.source, (edgesPerSource.get(edge.source) || 0) + 1);
      });

      // Group inheritance edges by target (superclass)
      const edgesByTarget = new Map<string, Edge[]>();
      umlInheritanceEdges.forEach((edge) => {
        const existing = edgesByTarget.get(edge.target) || [];
        existing.push(edge);
        edgesByTarget.set(edge.target, existing);
      });

      // For each superclass, create one merge point for eligible subclasses
      edgesByTarget.forEach((edgesGroup, targetId) => {
        if (edgesGroup.length < 2) return;

        // Only merge subclasses that connect to this superclass once
        const eligibleEdges = edgesGroup.filter(
          (edge) => (edgesPerSource.get(edge.source) || 0) === 1
        );
        if (eligibleEdges.length < 2) return;

        eligibleEdges.sort((a, b) => a.source.localeCompare(b.source));

        const targetNode = nodes.find((n) => n.id === targetId);
        if (!targetNode) return;

        const avgSourcePos = calculateAverageSourcePosition(eligibleEdges);
        const mergePoint = calculateMergePoint(avgSourcePos, targetNode);
        const mergeGroupId = `merge-${targetId}`;

        mergeGroupSourceNodesMap.set(
          mergeGroupId,
          eligibleEdges.map((e) => e.source)
        );
        eligibleEdges.forEach((edge) => {
          mergePointsMap.set(edge.id, { ...mergePoint, mergeGroupId });
        });

        firstInGroupMap.set(mergeGroupId, eligibleEdges[0].id);
      });

      return { mergePointsMap, firstInGroupMap, mergeGroupSourceNodesMap };
    }, [uniqueEdges, nodes, calculateAverageSourcePosition, calculateMergePoint]);

    // Helper to get edge distribution data
    const getEdgeDistributionData = useCallback((edge: Edge) => {
      const sourceDistribution = edgeDistributionMap.get(edge.source);
      const targetDistribution = edgeDistributionMap.get(edge.target);
      return {
        sourceData: sourceDistribution?.get(edge.sourceHandle as HandlePosition)?.find(d => d.edgeId === edge.id),
        targetData: targetDistribution?.get(edge.targetHandle as HandlePosition)?.find(d => d.edgeId === edge.id),
      };
    }, [edgeDistributionMap]);

    // Helper to get UML merge data for an edge
    const getUmlMergeInfo = useCallback((edge: Edge) => {
      if (edge.type !== 'uml') {
        return { mergePoint: undefined, hasMerge: false, isFirstInMergeGroup: false, mergeGroupSourceNodes: [] as string[] };
      }
      const mergePoint = umlMergeData.mergePointsMap.get(edge.id);
      const hasMerge = !!mergePoint;
      let isFirstInMergeGroup = false;
      let mergeGroupSourceNodes: string[] = [];

      if (mergePoint?.mergeGroupId) {
        const firstEdgeId = umlMergeData.firstInGroupMap.get(mergePoint.mergeGroupId);
        isFirstInMergeGroup = firstEdgeId === edge.id;
        mergeGroupSourceNodes = umlMergeData.mergeGroupSourceNodesMap.get(mergePoint.mergeGroupId) || [];
      }
      return { mergePoint, hasMerge, isFirstInMergeGroup, mergeGroupSourceNodes };
    }, [umlMergeData]);

    // Callbacks for reaction edges (defined once, not per-edge)
    const handleMergeGroupHover = useCallback((groupId: string | null) => {
      setHoveredMergeGroup(groupId);
    }, []);

    const handleEdgeDragStart = useCallback((_edgeId: string) => {
    }, []);

    const handleEdgeDrag = useCallback((_edgeId: string, _point: { x: number; y: number }) => {
    }, []);

    const handleEdgeDragEnd = useCallback((edgeId: string, point: { x: number; y: number }) => {
      updateEdgeControlPoint(edgeId, point);
    }, [updateEdgeControlPoint]);

    // Map edges with enriched data
    const mappedEdges = uniqueEdges.map(edge => {
      const { sourceData, targetData } = getEdgeDistributionData(edge);
      const { mergePoint, hasMerge, isFirstInMergeGroup, mergeGroupSourceNodes } = getUmlMergeInfo(edge);
      const isReaction = edge.type === 'reactions';
      const isUml = edge.type === 'uml';

      return {
        ...edge,
        data: {
          ...edge.data,
          mergePoint,
          hasMerge,
          isFirstInMergeGroup,
          mergeGroupSourceNodes,
          hoveredMergeGroup,
          onMergeGroupHover: isUml ? handleMergeGroupHover : undefined,
          onDoubleClick: isReaction ? () => handleEdgeDoubleClick(edge.id) : undefined,
          routingStyle,
          separation: 36,
          sourceParallelIndex: sourceData?.index,
          sourceParallelCount: sourceData?.total,
          targetParallelIndex: targetData?.index,
          targetParallelCount: targetData?.total,
          customControlPoint: edge.data?.customControlPoint,
          onEdgeDragStart: isReaction ? handleEdgeDragStart : undefined,
          onEdgeDrag: isReaction ? handleEdgeDrag : undefined,
          onEdgeDragEnd: isReaction ? handleEdgeDragEnd : undefined,
          onHandleChange: isReaction ? handleEdgeHandleChange : undefined,
          onReorderRequest: isReaction ? handleEdgeReorderRequest : undefined,
        },
        selectable: isReaction,
        focusable: isReaction,
        style: {
          ...edge.style,
          pointerEvents: (isUml ? 'none' : 'all') as React.CSSProperties['pointerEvents'],
        },
      };
    });

    const ecoreNodes = nodes.filter(n => n.type === 'ecoreFile');

    const getConnectionLinePositions = () => {
      if (
        !connectionDragState?.isActive ||
        !connectionDragState.sourceTipPosition ||
        !connectionDragState.currentPosition ||
        !reactFlowInstance ||
        !reactFlowWrapper.current
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
    };



    const connectionLinePositions = getConnectionLinePositions();
    const umlViewActive = !!umlModalOpen;

    return (
      <div
        ref={reactFlowWrapper}
        style={{
          flexGrow: 1,
          height: '100%',
          position: 'relative',
          border: isDragOver ? '3px dashed #3498db' : 'none',
          transition: 'border 0.2s ease',
          cursor: addReactionMode ? (reactionSourceId ? 'crosshair' : 'cell') : undefined,
        }}
      >
        <ReactFlow
          nodes={mappedNodes}
          edges={mappedEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onInit={(instance) => {
            setReactFlowInstance(instance);
            reactFlowInstanceRef.current = instance;
            setViewport(instance.getViewport());
          }}
          onMove={(_event, vp) => setViewport(vp)}
          nodesDraggable={umlViewActive || (isInteractive && !connectionDragState?.isActive)}
          nodesConnectable={!umlViewActive && isInteractive}
          elementsSelectable={umlViewActive || isInteractive}
          edgesUpdatable={false}
          edgesFocusable={umlViewActive || isInteractive}
          panOnDrag={umlViewActive || isInteractive}
          panOnScroll={umlViewActive || isInteractive}
          zoomOnScroll={umlViewActive || isInteractive}
          zoomOnPinch={umlViewActive || isInteractive}
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
            if (addReactionMode) { setReactionSourceId(null); onReactionModeEnd?.(); }
          }}
        >
          <Background />
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
            onDeleteViewType={deleteViewType}
            onUpdateViewTypeAngle={updateAngle}
            onUnlinkNode={unlinkNode}
          />
        )}

        {connectionLinePositions && (
          <ConnectionLine
            sourcePosition={connectionLinePositions.source}
            targetPosition={connectionLinePositions.target}
          />
        )}

        <CustomMinimap
          nodes={nodes}
          edges={edges}
          circle={circleVisible ? circle : undefined}
          viewport={viewport}
          containerW={reactFlowWrapper.current?.clientWidth ?? 800}
          containerH={reactFlowWrapper.current?.clientHeight ?? 600}
          width={200}
          height={204}
        />

        {/* ── Mode toggle + project tabs (stacked) ── */}
        <div
          style={{
            position: 'absolute',
            top: 14,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 31,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: '#ffffff',
              borderRadius: 8,
              boxShadow: '0 4px 16px rgba(0,0,0,0.13), 0 0 0 1px rgba(0,0,0,0.07)',
              height: 52,
              padding: '0 5px',
              gap: 2,
            }}
          >
            {([
              { label: 'Modeling',   icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>, active: !circleVisible },
              { label: 'View Types', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="3" x2="12" y2="21"/><line x1="3" y1="12" x2="21" y2="12"/></svg>, active: circleVisible },
            ] as const).map(({ label, icon, active }) => (
              <button
                key={label}
                onClick={() => {
                  const next = label === 'View Types';
                  setCircleVisible(next);
                  if (!next && circleSelected) setCircleSelected(false);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  height: 40,
                  padding: '0 16px',
                  border: active ? '1px solid #049484' : '1px solid transparent',
                  borderRadius: 6,
                  background: active ? '#049484' : 'transparent',
                  color: active ? '#ffffff' : '#64748b',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLButtonElement).style.background = '#f1f5f9'; (e.currentTarget as HTMLButtonElement).style.color = '#1e293b'; } }}
                onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#64748b'; } }}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
          {projectTabsBelowModeToggle}
        </div>

        <div
          style={{
            position: 'absolute',
            right: 16,
            bottom: 16,
            zIndex: 31,
            display: 'flex',
            flexDirection: 'column',
            gap: 20
          }}
        >
          {createControlButton(() => reactFlowInstance?.zoomIn?.(), 'Zoom in', '+')}
          {createControlButton(() => reactFlowInstance?.zoomOut?.(), 'Zoom out', '–')}
          {createControlButton(() => fitViewToCircle(circle), 'Fit view', '⛶')}
          {createControlButton(
            () => setIsInteractive(prev => !prev),
            isInteractive ? 'Lock interactions' : 'Unlock interactions',
            isInteractive ? '🔓' : '🔒'
          )}
        </div>

        {isDragOver && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(52, 152, 219, 0.95)',
            color: 'white',
            padding: '24px 48px',
            borderRadius: '12px',
            fontSize: '20px',
            fontWeight: 'bold',
            zIndex: 1000,
            pointerEvents: 'none',
            boxShadow: '0 8px 32px rgba(52, 152, 219, 0.3)',
            border: '2px solid rgba(255, 255, 255, 0.3)',
            backdropFilter: 'blur(10px)'
          }}>
            Drop files here
          </div>
        )}

        {codeEditorState && (
          <CodeEditorModal
            isOpen={codeEditorState.isOpen}
            onClose={handleCloseCodeEditor}
            onSave={handleSaveCode}
            onDelete={handleDeleteEdge}
            initialCode={codeEditorState.initialCode}
            edgeId={codeEditorState.edgeId || ''}
            sourceFileName={codeEditorState.sourceFileName}
            targetFileName={codeEditorState.targetFileName}
            vsumId={vsumId}
            lspEndpoint="/lsp"
            languageId="reactions"
            fileExtension=".reactions"
            title="Reaction Editor"
          />
        )}

        <ConfirmDialog
          isOpen={pendingDelete !== null}
          title="Remove from canvas"
          message={
            pendingDelete?.fileId && (pendingDelete.edgeIds.length > 0 || pendingDelete.nodeIds.length > 0)
              ? 'Remove the selected connection(s) and the meta model from the canvas?'
              : pendingDelete?.edgeIds.length
                ? 'Remove the selected connection from the canvas?'
                : 'Do you really want to remove this element from the canvas?'
          }
          confirmText="Remove"
          cancelText="Cancel"
          variant="danger"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            if (!pendingDelete) return;
            pendingDelete.edgeIds.forEach(eid => removeEdge(eid));
            pendingDelete.nodeIds.forEach(nid => removeNode(nid));
            if (pendingDelete.fileId) {
              removeNode(pendingDelete.fileId);
              setSelectedFileId(null);
              if (onEcoreFileDelete) onEcoreFileDelete(pendingDelete.fileId);
            }
            setPendingDelete(null);
          }}
        />

        {detailModel && ReactDOM.createPortal(
          <>
            <div
              role="presentation"
              data-model-detail-dismiss
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 10000,
                background: 'rgba(0, 0, 0, 0.5)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 10001,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              <div style={{ pointerEvents: 'auto' }} data-model-detail-modal>
                <ModelDetailModal
                  model={detailModel.model}
                  ecoreContent={detailModel.ecoreContent}
                  onClose={() => setDetailModel(null)}
                  onUpdated={() => setDetailModel(null)}
                  embedded
                />
              </div>
            </div>
          </>,
          document.body,
        )}
      </div>
    );
  });