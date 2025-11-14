import React, { useRef, useState, forwardRef, useImperativeHandle, useEffect, useCallback } from 'react';
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

const COLOR_LIST = [
  '#ab1c91ff', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
  '#d636a3ff', '#ff9f40', '#4daf4a', '#ff6b6b', '#b388eb',
  '#9c6644', '#f39ed1', '#a9a9a9', '#c9d22f', '#33c7c7',
  '#2a86d6', '#ffb86b', '#63c37a', '#ff4f7a', '#b08fe8'
];

const LOCALSTORAGE_KEY = 'flow_edge_color_map_v1';
const NODE_DIMENSIONS = { width: 280, height: 180 };

const nodeTypes = {
  editable: EditableNode,
  ecoreFile: EcoreFileBox
};
const edgeTypes = { 
  uml: UMLRelationship,
  reactions: ReactionRelationship
};


interface FlowCanvasProps {
  onDeploy?: (nodes: Node[], edges: Edge[]) => void;
  onToolClick?: (toolType: string, toolName: string, diagramType?: string) => void;
  onDiagramChange?: (nodes: Node[], edges: Edge[]) => void;
  onEcoreFileSelect?: (fileName: string) => void;
  onEcoreFileExpand?: (fileName: string, fileContent: string) => void;
  onEcoreFileDelete?: (id: string) => void;
  onEcoreFileRename?: (id: string, newFileName: string) => void;
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
}, FlowCanvasProps>(
  ({ onDeploy, onToolClick, onDiagramChange, onEcoreFileSelect, onEcoreFileExpand, onEcoreFileDelete, onEcoreFileRename }, ref) => {

    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isInteractive, setIsInteractive] = useState(true);
    const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
    const [expandedFileId, setExpandedFileId] = useState<string | null>(null);
    const [connectionDragState, setConnectionDragState] = useState<ConnectionDragState | null>(null);
    const [codeEditorState, setCodeEditorState] = useState<CodeEditorState | null>(null);
    const [routingStyle, setRoutingStyle] = useState<'curved' | 'orthogonal'>('orthogonal');

    const {
      nodes,
      edges,
      onNodesChange,
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

    const edgeColorMapRef = useRef<Map<string, string>>(new Map());
    const nextColorIndexRef = useRef<number>(0);

    useEffect(() => {
      try {
        const raw = localStorage.getItem(LOCALSTORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Record<string, string>;
          edgeColorMapRef.current = new Map(Object.entries(parsed));
          const used = new Set(Object.values(parsed));
          let maxIndex = 0;
          COLOR_LIST.forEach((c, i) => { 
            if (used.has(c)) maxIndex = Math.max(maxIndex, i + 1); 
          });
          nextColorIndexRef.current = maxIndex % COLOR_LIST.length;
        }
      } catch (e) {
        console.warn('Failed to load edge color map', e);
      }
    }, []);

    const persistEdgeColorMap = useCallback(() => {
      try {
        const obj: Record<string, string> = {};
        edgeColorMapRef.current.forEach((v, k) => {
          obj[k] = v;
        });
        localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(obj));
      } catch (e) {
        // Silent fail
      }
    }, []);

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
      handle: HandlePosition
    ): { x: number; y: number } | null => {
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return null;

      const { x: nodeX, y: nodeY } = node.position;
      const { width, height } = NODE_DIMENSIONS;

      const positions: Record<HandlePosition, { x: number; y: number }> = {
        top: { x:  nodeX + width / 2.55, y: nodeY - 42 },
        bottom: { x:  nodeX + width / 2.5, y: nodeY + 125 },
        left: { x: nodeX - 40, y: nodeY + height / 4.4 },
        right: { x: nodeX + width - 20, y: nodeY + height / 4.4},
      };

      return positions[handle];
    }, [nodes]);

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

    useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        const target = event.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
          return;
        }


        if (event.key === 'Delete' || event.key === 'Backspace') {
          if (reactFlowInstance) {
            const selectedNodes = reactFlowInstance.getNodes().filter(n => n.selected);
            const selectedEdges = reactFlowInstance.getEdges().filter(e => e.selected);
            if (selectedNodes.length > 0) {
              event.preventDefault();
              selectedNodes.forEach((n) => removeNode(n.id));
              return;
            }
            if (selectedEdges.length > 0) {
              event.preventDefault();
              selectedEdges.forEach((e) => removeEdge(e.id));
              return;
            }
          }

          if (selectedFileId && onEcoreFileDelete) {
            event.preventDefault();
            onEcoreFileDelete(selectedFileId);
            setSelectedFileId(null);
            return;
          }
        }

        if (!(event.ctrlKey || event.metaKey)) return;

        const key = event.key.toLowerCase();
        
        if (key === 'z') {
          event.preventDefault();
          if (event.shiftKey) {
            if (canRedo) redo();
          } else {
            if (canUndo) undo();
          }
        } else if (key === 'y') {
          event.preventDefault();
          if (canRedo) redo();
        }
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

        const existingEdge = edges.find(edge =>
          (edge.source === connectionDragState.sourceNodeId && edge.target === targetNode.id) ||
          (edge.source === targetNode.id && edge.target === connectionDragState.sourceNodeId)
        );

        if (!existingEdge) {
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
          };

          console.log('🎯 Creating edge:', newEdge);
          addEdge(newEdge);
        } else {
          console.log('⚠️ Connection already exists');
        }
      } else {
        console.log('❌ Connection ended in empty space - cancelled');
      }

      setConnectionDragState(null);
    }, [reactFlowInstance, nodes, edges, addEdge, connectionDragState, getColorForPair, isPositionInsideNode, calculateTargetHandle]);

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

      const handlers = {
        move: (e: any) => handleConnectionMove(e),
        end: (e: any) => handleConnectionEnd(e),
      };

      const addListeners = () => {
        const targets = [document, window];
        const events = ['pointermove', 'pointerup'] as const;
        
        targets.forEach(target => {
          events.forEach((event, idx) => {
            target.addEventListener(event, idx === 0 ? handlers.move : handlers.end, { capture: true });
          });
        });
      };

      const removeListeners = () => {
        const targets = [document, window];
        const events = ['pointermove', 'pointerup'] as const;
        
        targets.forEach(target => {
          events.forEach((event, idx) => {
            target.removeEventListener(event, idx === 0 ? handlers.move : handlers.end, { capture: true });
          });
        });
      };

      document.body.style.cursor = 'crosshair';
      addListeners();

      return () => {
        removeListeners();
        document.body.style.cursor = '';
      };
    }, [connectionDragState?.isActive, handleConnectionMove, handleConnectionEnd]);

    const handleEdgeDoubleClick = useCallback((edgeId: string) => {
      const edge = edges.find(e => e.id === edgeId);
      if (!edge) return;

      const getFileName = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        return node?.type === 'ecoreFile' ? node.data.fileName : undefined;
      };

      setCodeEditorState({
        isOpen: true,
        edgeId,
        initialCode: edge.data?.code || '',
        sourceFileName: getFileName(edge.source),
        targetFileName: getFileName(edge.target),
      });
    }, [edges, nodes]);

    const handleCloseCodeEditor = useCallback(() => {
      setCodeEditorState(null);
    }, []);

    const handleSaveCode = useCallback((code: string) => {
      if (codeEditorState?.edgeId) {
        updateEdgeCode(codeEditorState.edgeId, code);
      }
    }, [codeEditorState, updateEdgeCode]);

    const handleDeleteEdge = useCallback(() => {
      if (codeEditorState?.edgeId) {
        removeEdge(codeEditorState.edgeId);
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
      console.log('Loading diagram data:', { newNodes, newEdges });
      setNodes([]);
      setEdges([]);
      if (newNodes.length > 0) setNodes(newNodes);
      if (newEdges.length > 0) setEdges(newEdges);
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
      onDiagramChange?.(nodes, edges);
    }, [nodes, edges, onDiagramChange]);

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
    }), [handleToolClick, loadDiagramData, nodes, edges, addEcoreFile, resetExpandedFile, undo, redo, canUndo, canRedo]);

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
          },
          selected: selectedFileId === node.id,
          draggable: !connectionDragState?.isActive,
        };
      }

      return node;
    });

    const mappedEdges = edges.map(edge => ({
      ...edge,
      data: {
        ...edge.data,
        onDoubleClick: edge.type === 'reactions' ? handleEdgeDoubleClick : undefined,
        routingStyle,
        separation: 36,
      },

      selectable: edge.type === 'reactions',
      focusable: edge.type === 'reactions',
      style: {
        ...edge.style,
        pointerEvents: (edge.type === 'uml' ? 'none' : 'all') as React.CSSProperties['pointerEvents'],
      },
    }));

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
          panOnDrag={isInteractive}
          panOnScroll={isInteractive}
          zoomOnScroll={isInteractive}
          zoomOnPinch={isInteractive}
        >
          <MiniMap position="bottom-right" style={{ bottom: 16, right: 16, zIndex: 30 }} />
          <Background />
        </ReactFlow>

        {/* Connection Line */}
        {connectionLinePositions && (
          <ConnectionLine
            sourcePosition={connectionLinePositions.source}
            targetPosition={connectionLinePositions.target}
          />
        )}

{/* Zoom & Control Buttons */}
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
    () => setRoutingStyle(prev => prev === 'curved' ? 'orthogonal' : 'curved'),
    `Edge style: ${routingStyle === 'curved' ? 'Curved' : 'Orthogonal'} (click to toggle)`,
    routingStyle === 'orthogonal' ? '└' : '∿'
  )}
  {createControlButton(
    () => setIsInteractive(prev => !prev),
    isInteractive ? 'Lock interactions' : 'Unlock interactions',
    isInteractive ? '🔓' : '🔒'
  )}
</div>


        {/* Drag Over Overlay */}
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

        {/* Code Editor Modal */}
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