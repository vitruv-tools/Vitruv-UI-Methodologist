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
  MiniMap,
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
import { EcoreFileBox } from './EcoreFileBox';
import { ConnectionLine } from './ConnectionLine';
import { CodeEditorModal } from './CodeEditorModal';
import { apiService, MetaModelRelationRequest } from '../../services/api';
import { WorkspaceSnapshot } from '../../types/workspace';

const COLOR_LIST = [
  '#ab1c91ff', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
  '#d636a3ff', '#ff9f40', '#4daf4a', '#ff6b6b', '#b388eb',
  '#9c6644', '#f39ed1', '#a9a9a9', '#c9d22f', '#33c7c7',
  '#2a86d6', '#ffb86b', '#63c37a', '#ff4f7a', '#b08fe8'
];

const NODE_DIMENSIONS = { width: 280, height: 180 };

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


const getLocalStorageKey = (userId?: string, projectId?: string) => {
  if (userId && projectId) {
    return `flow_edge_color_map_v1_user_${userId}_project_${projectId}`;
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
  projectId?: string;
}

interface ConnectionDragState {
  isActive: boolean;
  sourceNodeId: string | null;
  sourceHandle: 'top' | 'bottom' | 'left' | 'right' | null;
  currentPosition: { x: number; y: number } | null;
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
    projectId
  }, ref) => {

    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isInteractive, setIsInteractive] = useState(true);
    const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
    const [expandedFileId, setExpandedFileId] = useState<string | null>(null);
    const [connectionDragState, setConnectionDragState] = useState<ConnectionDragState | null>(null);
    const [codeEditorState, setCodeEditorState] = useState<CodeEditorState | null>(null);
    const [routingStyle] = useState<'curved' | 'orthogonal'>('orthogonal');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [edgeDragState, setEdgeDragState] = useState<{
      edgeId: string;
      isDragging: boolean;
      controlPoint?: { x: number; y: number };
    } | null>(null);
    const [hoveredMergeGroup, setHoveredMergeGroup] = useState<string | null>(null);


    const storageKey = getLocalStorageKey(userId, projectId);

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
    } = useFlowState();

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

    // Wrapper to auto-update edge handles when nodes move
    const onNodesChange = useCallback((changes: any) => {
      originalOnNodesChange(changes);
      
      // Check if any nodes finished moving (dragging ended)
      const finishedDragging = changes.some((change: any) => 
        change.type === 'position' && change.dragging === false
      );
      
      if (finishedDragging) {
        // Small delay to ensure node positions are updated in state
        setTimeout(recalculateEdgeHandles, 100);
      }
    }, [originalOnNodesChange, recalculateEdgeHandles]);

    const edgeColorMapRef = useRef<Map<string, string>>(new Map());
    const nextColorIndexRef = useRef<number>(0);


    useEffect(() => {
      console.log('Loading edge color map for:', { userId, projectId, storageKey });
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
    }, [userId, projectId, storageKey]);


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

    const getHandlePosition = useCallback((
      nodeId: string,
      handle: HandlePosition,
      edgeId?: string
    ): { x: number; y: number } | null => {
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return null;

      const { x: nodeX, y: nodeY } = node.position;
      const { width, height } = NODE_DIMENSIONS;

      // Get distribution data for this node and handle
      const nodeDistribution = edgeDistributionMap.get(nodeId);
      const sideDistribution = nodeDistribution?.get(handle);
      
      let offsetMultiplier = 0;
      
      if (sideDistribution && edgeId) {
        const edgeData = sideDistribution.find(d => d.edgeId === edgeId);
        if (edgeData && edgeData.total > 1) {
          // Calculate symmetric offset from center
          const centerOffset = (edgeData.total - 1) / 2;
          offsetMultiplier = edgeData.index - centerOffset;
        }
      }

      // Spacing between handles when multiple edges exist
      const HANDLE_SPACING = 25;
      const offset = offsetMultiplier * HANDLE_SPACING;

      const positions: Record<HandlePosition, { x: number; y: number }> = {
        top: { x: nodeX + width / 2, y: nodeY },                    // Center of top edge
        bottom: { x: nodeX + width / 2, y: nodeY + height },        // Center of bottom edge
        left: { x: nodeX, y: nodeY + height / 2 },                  // Center of left edge
        right: { x: nodeX + width, y: nodeY + height / 2 },         // Center of right edge
      };

      const basePos = positions[handle];

      // Apply offset based on handle orientation
      if (handle === 'top' || handle === 'bottom') {
        return { x: basePos.x + offset, y: basePos.y };
      } else {
        return { x: basePos.x, y: basePos.y + offset };
      }
    }, [nodes, edgeDistributionMap]);

    const calculateTargetHandle = useCallback((
      sourcePos: { x: number; y: number },
      targetPos: { x: number; y: number }
    ): HandlePosition => {
      const dx = targetPos.x - sourcePos.x;
      const dy = targetPos.y - sourcePos.y;

      if (Math.abs(dx) > Math.abs(dy)) {
        return dx > 0 ? 'left' : 'right';
      }
      return dy > 0 ? 'top' : 'bottom';
    }, []);

    const isPositionInsideNode = useCallback((
      position: { x: number; y: number },
      node: Node
    ): boolean => {
      const { width, height } = NODE_DIMENSIONS;
      return (
        position.x >= node.position.x &&
        position.x <= node.position.x + width &&
        position.y >= node.position.y &&
        position.y <= node.position.y + height
      );
    }, []);

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
        if (reactFlowInstance) {
          const selectedNodes = reactFlowInstance.getNodes().filter(n => n.selected);
          if (selectedNodes.length > 0) {
            event.preventDefault();
            selectedNodes.forEach((n) => removeNode(n.id));
            return true;
          }

          const selectedEdges = reactFlowInstance.getEdges().filter(e => e.selected);
          if (selectedEdges.length > 0) {
            event.preventDefault();
            selectedEdges.forEach((e) => removeEdge(e.id));
            return true;
          }
        }

        if (selectedFileId && onEcoreFileDelete) {
          event.preventDefault();
          onEcoreFileDelete(selectedFileId);
          setSelectedFileId(null);
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
    }, [undo, redo, canUndo, canRedo, reactFlowInstance, removeNode, removeEdge, selectedFileId, onEcoreFileDelete]);

    const handleConnectionEnd = useCallback((e: MouseEvent) => {
      console.log('handleConnectionEnd CALLED');

      if (!reactFlowInstance || !connectionDragState?.isActive || !connectionDragState.sourceNodeId) {
        console.log('❌ Invalid connection state');
        return;
      }

      console.log('🔵 Connection drag ended');

      const flowPosition = reactFlowInstance.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });

      const intersectingNodes = nodes.filter(node => {
        if (node.type !== 'ecoreFile' || node.id === connectionDragState.sourceNodeId) {
          return false;
        }
        return isPositionInsideNode(flowPosition, node);
      });

      console.log('🔵 Intersecting nodes:', intersectingNodes);

      if (intersectingNodes.length > 0) {
        const targetNode = intersectingNodes[0];
        console.log('✅ Connection ended on node:', targetNode.id);

        // Check if edge in THIS DIRECTION already exists (allow bidirectional)
        const existingEdge = edges.find(edge =>
          edge.source === connectionDragState.sourceNodeId && edge.target === targetNode.id
        );

        if (existingEdge) {
          console.log('⚠️ Connection in this direction already exists');
          setConnectionDragState(null);
          return;
        }

        const sourceNodePos = nodes.find(n => n.id === connectionDragState.sourceNodeId)?.position;
        const targetNodePos = targetNode.position;

        let targetHandle: HandlePosition = 'left';

        if (sourceNodePos && targetNodePos) {
          targetHandle = calculateTargetHandle(sourceNodePos, targetNodePos);
        }

        console.log('🔵 Calculated handles:', {
          source: connectionDragState.sourceHandle,
          target: targetHandle
        });

        const color = getColorForPair(connectionDragState.sourceNodeId, targetNode.id);

        const newEdge: Edge = {
          id: `edge-${connectionDragState.sourceNodeId}-${targetNode.id}-${Date.now()}`,
          source: connectionDragState.sourceNodeId,
          target: targetNode.id,
          sourceHandle: connectionDragState.sourceHandle,
          targetHandle: targetHandle,
          type: 'reactions',
          style: {
            stroke: color,
            strokeWidth: 2,
          },
          data: {
            sourceMetaModelId: getBackendMetaModelIdForNode(connectionDragState.sourceNodeId),
            targetMetaModelId: getBackendMetaModelIdForNode(targetNode.id),
            sourceMetaModelSourceId: getMetaModelSourceIdForNode(connectionDragState.sourceNodeId),
            targetMetaModelSourceId: getMetaModelSourceIdForNode(targetNode.id),
          }
        };

        console.log('🎯 Creating edge:', newEdge);
        addEdge(newEdge);
      } else {
        console.log('❌ Connection ended in empty space - cancelled');
      }

      setConnectionDragState(null);
    }, [reactFlowInstance, nodes, edges, addEdge, connectionDragState, getColorForPair, isPositionInsideNode, calculateTargetHandle, getBackendMetaModelIdForNode, getMetaModelSourceIdForNode]);

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
      globalThis.addEventListener('pointermove', handleMove, captureOptions);
      globalThis.addEventListener('pointerup', handleEnd, captureOptions);

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

      console.log(edges)
      setCodeEditorState({
        isOpen: true,
        edgeId,
        initialCode,
        sourceFileName: getFileName(edge.source),
        targetFileName: getFileName(edge.target),
        reactionFileId,
      });
    }, [edges, nodes]);

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
        const fileName = `reaction-${edgeId}-${Date.now()}.reactions`;
        const file = new File([code], fileName, { type: 'text/plain;charset=utf-8' });

        let reactionFileId = codeEditorState.reactionFileId ?? null;

        if (reactionFileId == null) {
          const uploadResult = await apiService.uploadFile(file, 'REACTION');
          reactionFileId = extractFileId(uploadResult?.data);
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

      setNodes([]);
      setEdges([]);

      if (nodesWithIds.length > 0) setNodes(nodesWithIds);
      if (edgesWithUniqueIds.length > 0) setEdges(edgesWithUniqueIds);

      console.log('Diagram data loaded successfully');
    }, [setNodes, setEdges]);


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

    const handleConnectionStart = useCallback((nodeId: string, handle: HandlePosition) => {
      console.log('🔵 Connection drag started:', { nodeId, handle });

      const initialPosition = getHandlePosition(nodeId, handle);
      console.log('🔵 Initial position:', initialPosition);

      setConnectionDragState({
        isActive: true,
        sourceNodeId: nodeId,
        sourceHandle: handle,
        currentPosition: initialPosition,
      });
    }, [getHandlePosition]);

    const handleEcoreFileSelect = useCallback((fileName: string) => {
      const ecoreNode = nodes.find(
        n => n.type === 'ecoreFile' && n.data.fileName === fileName
      );
      if (ecoreNode) {
        setSelectedFileId(ecoreNode.id);
        onEcoreFileSelect?.(fileName);
      }
    }, [nodes, onEcoreFileSelect]);

    const handleEcoreFileExpand = useCallback((fileName: string, fileContent: string) => {
      const ecoreNode = nodes.find(
        n => n.type === 'ecoreFile' && n.data.fileName === fileName
      );

      if (ecoreNode) {
        setExpandedFileId(ecoreNode.id);
        setSelectedFileId(ecoreNode.id);
        const updatedNodes = nodes.map(n =>
          n.id === ecoreNode.id
            ? { ...n, data: { ...n.data, isExpanded: true } }
            : n
        );
        setNodes(updatedNodes);
      }

      onEcoreFileExpand?.(fileName, fileContent);
    }, [nodes, setNodes, onEcoreFileExpand]);

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
      const position = meta?.position || { x: 100, y: 100 };
      const metaModelId = typeof meta?.metaModelId === 'number' ? meta.metaModelId : undefined;
      const metaModelSourceId = typeof meta?.metaModelSourceId === 'number'
          ? meta.metaModelSourceId
          : metaModelId;

      const newEcoreNode: Node = {
        id: `ecore-${Date.now()}`,
        type: 'ecoreFile',
        position: position,
        data: {
          fileName,
          fileContent,
          description: meta?.description,
          keywords: meta?.keywords,
          domain: meta?.domain,
          createdAt: meta?.createdAt || new Date().toISOString(),
          metaModelId,
          metaModelSourceId,
          onExpand: handleEcoreFileExpand,
          onSelect: handleEcoreFileSelect,
          onDelete: onEcoreFileDelete,
          onRename: onEcoreFileRename,
          isExpanded: false,
        },
        draggable: true,
      };

      addNode(newEcoreNode);
      setSelectedFileId(newEcoreNode.id);

      if (onEcoreFileSelect) {
        onEcoreFileSelect(fileName);
      }
    }, [addNode, handleEcoreFileExpand, handleEcoreFileSelect, onEcoreFileSelect, onEcoreFileDelete, onEcoreFileRename]);

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
          relations?: Array<{
            id: number;
            sourceId: number;
            targetId: number;
            reactionFileId?: number | null;
          }>;
          preserveExisting?: boolean;
        }>;

        const relations = custom.detail?.relations ?? [];
        const preserveExisting = custom.detail?.preserveExisting ?? false;
        
        relations.forEach(relation => processRelation(relation, preserveExisting));

        if (relations.length > 0) {
          setTimeout(() => {
            reactFlowInstance?.fitView({ padding: 0.1, duration: 300 });
          }, 100);
        }
      };

      globalThis.addEventListener('vitruv.loadMetaModelRelations', handleLoadMetaModelRelations as EventListener);
      return () => globalThis.removeEventListener('vitruv.loadMetaModelRelations', handleLoadMetaModelRelations as EventListener);
    }, [processRelation, reactFlowInstance]);

    useEffect(() => {
      onDiagramChange?.(nodes, edges);
    }, [nodes, edges, onDiagramChange]);

    const getReactionEdges = useCallback(() => {
      return edges.filter(e => e.type === 'reactions');
    }, [edges]);

    const buildWorkspaceSnapshot = useCallback((): WorkspaceSnapshot => {
      const metaModelIds = Array.from(
          new Set(
              nodes
                  .filter(node => node.type === 'ecoreFile')
                  .map(node => node.data?.metaModelSourceId ?? node.data?.metaModelId)
                  .filter((value): value is number => typeof value === 'number')
          )
      );

      const metaModelRelationRequests: MetaModelRelationRequest[] = edges
          .filter(edge => edge.type === 'reactions')
          .map(edge => {
            const sourceId = getMetaModelSourceIdForNode(edge.source);
            const targetId = getMetaModelSourceIdForNode(edge.target);
            const reactionFileId =
                typeof edge.data?.reactionFileId === 'number'
                    ? edge.data.reactionFileId
                    : 0;

            if (typeof sourceId !== 'number' || typeof targetId !== 'number') {
              return null;
            }

            return {
              sourceId,
              targetId,
              reactionFileId,
            };
          })
          .filter((req): req is MetaModelRelationRequest => req !== null);

      return {
        metaModelIds,
        metaModelRelationRequests,
      };
    }, [nodes, edges, getMetaModelSourceIdForNode]);

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
      
      // Optimize edge handles after layout
      setTimeout(() => {
        const optimizedEdges = optimizeEdgeHandles(updatedNodes, edges);
        setEdges(optimizedEdges);
        
        // Fit view after layout
        setTimeout(() => reactFlowInstance?.fitView({ padding: 0.15, duration: 500 }), 50);
      }, 50);
    }, [nodes, edges, setNodes, setEdges, reactFlowInstance, buildAdjacencyMap, findConnectedComponents, layoutComponent, optimizeEdgeHandles]);

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
        setNodes(deselectAllNodes);
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
    }), [handleToolClick, loadDiagramData, nodes, edges, addEcoreFile, resetExpandedFile, undo, redo, canUndo, canRedo, getReactionEdges, buildWorkspaceSnapshot, autoLayoutEcoreBoxes]);

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
            onRename: onEcoreFileRename,
            isExpanded: expandedFileId === node.id,
            onConnectionStart: handleConnectionStart,
            isConnectionActive: connectionDragState?.isActive || false,
            edgeDistribution: edgeDistributionMap.get(node.id),
          },
          selected: selectedFileId === node.id,
          draggable: !connectionDragState?.isActive,
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
  if (!edge || edge.type !== 'reactions') return;

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
      return {
        x: avgSource.x + (targetCenterX - avgSource.x) * 0.4,
        y: avgSource.y + (targetCenterY - avgSource.y) * 0.4
      };
    }, []);

    // Calculate merge points for UML edges with same target
    const umlMergeData = useMemo(() => {
      const mergePointsMap = new Map<string, { x: number; y: number; mergeGroupId: string }>();
      const firstInGroupMap = new Map<string, string>();
      const mergeGroupSourceNodesMap = new Map<string, string[]>();
      
      // Count UML edges per source node
      const edgesPerSource = new Map<string, number>();
      uniqueEdges.filter(e => e.type === 'uml').forEach(edge => {
        edgesPerSource.set(edge.source, (edgesPerSource.get(edge.source) || 0) + 1);
      });
      
      // Group UML edges by target
      const edgesByTarget = new Map<string, Edge[]>();
      uniqueEdges.filter(e => e.type === 'uml').forEach(edge => {
        const existing = edgesByTarget.get(edge.target) || [];
        existing.push(edge);
        edgesByTarget.set(edge.target, existing);
      });
      
      // Process each target group
      edgesByTarget.forEach((edgesGroup, targetId) => {
        if (edgesGroup.length < 2) return;
        
        const eligibleEdges = edgesGroup.filter(edge => (edgesPerSource.get(edge.source) || 0) === 1);
        if (eligibleEdges.length < 2) return;
        
        eligibleEdges.sort((a, b) => a.source.localeCompare(b.source));
        
        const targetNode = nodes.find(n => n.id === targetId);
        if (!targetNode) return;
        
        const avgSourcePos = calculateAverageSourcePosition(eligibleEdges);
        const mergePoint = calculateMergePoint(avgSourcePos, targetNode);
        const mergeGroupId = `merge-${targetId}`;
        
        mergeGroupSourceNodesMap.set(mergeGroupId, eligibleEdges.map(e => e.source));
        eligibleEdges.forEach((edge, index) => {
          mergePointsMap.set(edge.id, { ...mergePoint, mergeGroupId });
          console.log(`   Edge ${index}: ${edge.id.slice(-8)} (source: ${edge.source.slice(-6)})`);
        });
        
        firstInGroupMap.set(mergeGroupId, eligibleEdges[0].id);
        console.log(`✨ Merge group ${mergeGroupId}: First edge = ${eligibleEdges[0].id.slice(-8)}`);
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

    const handleEdgeDragStart = useCallback((edgeId: string) => {
      setEdgeDragState({ edgeId, isDragging: true });
    }, []);

    const handleEdgeDrag = useCallback((edgeId: string, point: { x: number; y: number }) => {
      setEdgeDragState(prev => prev ? { ...prev, controlPoint: point } : null);
    }, []);

    const handleEdgeDragEnd = useCallback((edgeId: string, point: { x: number; y: number }) => {
      updateEdgeControlPoint(edgeId, point);
      setEdgeDragState(null);
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

    const getConnectionLinePositions = () => {
      if (!connectionDragState?.isActive ||
          !connectionDragState.sourceNodeId ||
          !connectionDragState.sourceHandle ||
          !connectionDragState.currentPosition ||
          !reactFlowInstance ||
          !reactFlowWrapper.current) {
        return null;
      }

      const sourcePos = getHandlePosition(
        connectionDragState.sourceNodeId,
        connectionDragState.sourceHandle
      );

      if (!sourcePos) return null;

      const viewport = reactFlowInstance.getViewport();

      console.log('🔍 Connection Line Debug:', {
        sourceFlowPos: sourcePos,
        currentFlowPos: connectionDragState.currentPosition,
        viewport,
      });

      const result = {
        source: {
          x: sourcePos.x * viewport.zoom + viewport.x,
          y: sourcePos.y * viewport.zoom + viewport.y,
        },
        target: {
          x: connectionDragState.currentPosition.x * viewport.zoom + viewport.x,
          y: connectionDragState.currentPosition.y * viewport.zoom + viewport.y,
        },
      };

      console.log('🔍 Connection Line Screen Positions:', result);

      return result;
    };

    const connectionLinePositions = getConnectionLinePositions();

    return (
      <div
        ref={reactFlowWrapper}
        style={{
          flexGrow: 1,
          height: '100%',
          position: 'relative',
          border: isDragOver ? '3px dashed #3498db' : 'none',
          transition: 'border 0.2s ease'
        }}
      >
        <ReactFlow
          nodes={mappedNodes}
          edges={mappedEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onInit={setReactFlowInstance}
          nodesDraggable={isInteractive && !connectionDragState?.isActive}
          nodesConnectable={isInteractive}
          elementsSelectable={isInteractive}
          edgesUpdatable={false}
          edgesFocusable={isInteractive}
          panOnDrag={isInteractive}
          panOnScroll={isInteractive}
          zoomOnScroll={isInteractive}
          zoomOnPinch={isInteractive}
          selectNodesOnDrag={false}
          onPaneClick={() => {
            // Deselect all nodes and edges when clicking on background
            setNodes(nds => nds.map(n => ({ ...n, selected: false })));
            setEdges(eds => eds.map(e => ({ ...e, selected: false })));
          }}
        >
          <MiniMap position="bottom-right" style={{ bottom: 16, right: 16, zIndex: 30 }} />
          <Background />
        </ReactFlow>

        {connectionLinePositions && (
          <ConnectionLine
            sourcePosition={connectionLinePositions.source}
            targetPosition={connectionLinePositions.target}
          />
        )}

        <div
          style={{
            position: 'absolute',
            left: 16,
            bottom: 16,
            zIndex: 31,
            display: 'flex',
            flexDirection: 'column',
            gap: 6
          }}
        >
          {createControlButton(() => reactFlowInstance?.zoomIn?.(), 'Zoom in', '+')}
          {createControlButton(() => reactFlowInstance?.zoomOut?.(), 'Zoom out', '–')}
          {createControlButton(() => reactFlowInstance?.fitView?.({ padding: 0.2 }), 'Fit view', '⛶')}
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
          />
        )}
      </div>
    );
  });