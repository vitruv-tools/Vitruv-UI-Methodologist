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
import { EcoreFileBox } from './EcoreFileBox';
import { ConnectionLine } from './ConnectionLine';

const COLOR_LIST = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
  '#368bd6', '#ff9f40', '#4daf4a', '#ff6b6b', '#b388eb',
  '#9c6644', '#f39ed1', '#a9a9a9', '#c9d22f', '#33c7c7',
  '#2a86d6', '#ffb86b', '#63c37a', '#ff4f7a', '#b08fe8'
];

const nodeTypes = {
  editable: EditableNode,
  ecoreFile: EcoreFileBox
};
const edgeTypes = { uml: UMLRelationship };

interface FlowCanvasProps {
  onDeploy?: (nodes: Node[], edges: Edge[]) => void;
  onToolClick?: (toolType: string, toolName: string, diagramType?: string) => void;
  onDiagramChange?: (nodes: Node[], edges: Edge[]) => void;
  onEcoreFileSelect?: (fileName: string) => void;
  onEcoreFileExpand?: (fileName: string, fileContent: string) => void;
  onEcoreFileDelete?: (id: string) => void;
  onEcoreFileRename?: (id: string, newFileName: string) => void;
}

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

    const [connectionDragState, setConnectionDragState] = useState<{
      isActive: boolean;
      sourceNodeId: string | null;
      sourceHandle: 'top' | 'bottom' | 'left' | 'right' | null;
      currentPosition: { x: number; y: number } | null;
    } | null>(null);

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
      setNodes,
      setEdges,
      undo,
      redo,
      canUndo,
      canRedo,
    } = useFlowState();

    const LOCALSTORAGE_KEY = 'flow_edge_color_map_v1';
    const edgeColorMapRef = useRef<Map<string, string>>(new Map());
    const nextColorIndexRef = useRef<number>(0);

    const pairKey = (a: string, b: string) => (a < b ? `${a}::${b}` : `${b}::${a}`);

    useEffect(() => {
      try {
        const raw = localStorage.getItem(LOCALSTORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Record<string, string>;
          edgeColorMapRef.current = new Map(Object.entries(parsed));
          const used = new Set(Object.values(parsed));
          let maxIndex = 0;
          COLOR_LIST.forEach((c, i) => { if (used.has(c)) maxIndex = Math.max(maxIndex, i + 1); });
          nextColorIndexRef.current = maxIndex % COLOR_LIST.length;
        }
      } catch (e) {
        console.warn('Failed to load edge color map', e);
      }
    }, []);

    const persistEdgeColorMap = () => {
      try {
        const obj: Record<string, string> = {};
        edgeColorMapRef.current.forEach((v, k) => {
          obj[k] = v;
        });
        localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(obj));
      } catch (e) {
        // Silent fail
      }
    };

    const getColorForPair = React.useCallback((idA: string, idB: string) => {
      const key = pairKey(idA, idB);
      const existing = edgeColorMapRef.current.get(key);
      if (existing) return existing;
      const color = COLOR_LIST[nextColorIndexRef.current % COLOR_LIST.length];
      edgeColorMapRef.current.set(key, color);
      nextColorIndexRef.current += 1;
      persistEdgeColorMap();
      return color;
    }, []);

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

    const getHandlePosition = (
      nodeId: string,
      handle: 'top' | 'bottom' | 'left' | 'right'
    ): { x: number; y: number } | null => {
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return null;

      const nodeWidth = 280;
      const nodeHeight = 180;

      const nodeX = node.position.x;
      const nodeY = node.position.y;

      switch (handle) {
        case 'top':
          return { x: nodeX + nodeWidth / 2, y: nodeY };
        case 'bottom':
          return { x: nodeX + nodeWidth / 2, y: nodeY + nodeHeight };
        case 'left':
          return { x: nodeX, y: nodeY + nodeHeight / 2 };
        case 'right':
          return { x: nodeX + nodeWidth, y: nodeY + nodeHeight / 2 };
      }
    };

    useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        const target = event.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
          return;
        }

        if (event.ctrlKey || event.metaKey) {
          switch (event.key.toLowerCase()) {
            case 'z':
              event.preventDefault();
              if (event.shiftKey) {
                if (canRedo) {
                  redo();
                }
              } else {
                if (canUndo) {
                  undo();
                }
              }
              break;
            case 'y':
              event.preventDefault();
              if (canRedo) {
                redo();
              }
              break;
          }
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }, [undo, redo, canUndo, canRedo]);

    const handleConnectionEnd = useCallback((e: MouseEvent) => {
      console.log('handleConnectionEnd CALLED');

      if (!reactFlowInstance) {
        console.log('❌ No reactFlowInstance');
        return;
      }

      const currentState = connectionDragState;

      if (!currentState?.isActive || !currentState.sourceNodeId) {
        console.log('❌ No active connection or no source node');
        return;
      }

      console.log('🔵 Connection drag ended');

      const flowPosition = reactFlowInstance.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });

      const intersectingNodes = nodes.filter(node => {
        if (node.type !== 'ecoreFile') return false;
        if (node.id === currentState.sourceNodeId) return false;

        const nodeWidth = 280;
        const nodeHeight = 180;

        const isInside =
          flowPosition.x >= node.position.x &&
          flowPosition.x <= node.position.x + nodeWidth &&
          flowPosition.y >= node.position.y &&
          flowPosition.y <= node.position.y + nodeHeight;

        return isInside;
      });

      console.log('🔵 Intersecting nodes:', intersectingNodes);

      if (intersectingNodes.length > 0) {
        const targetNode = intersectingNodes[0];
        console.log('✅ Connection ended on node:', targetNode.id);

        const existingEdge = edges.find(edge =>
          (edge.source === currentState.sourceNodeId && edge.target === targetNode.id) ||
          (edge.source === targetNode.id && edge.target === currentState.sourceNodeId)
        );

        console.log('🔵 Existing edge?', existingEdge);

        if (!existingEdge) {
          const sourceNodePos = nodes.find(n => n.id === currentState.sourceNodeId)?.position;
          const targetNodePos = targetNode.position;

          let targetHandle: 'top' | 'bottom' | 'left' | 'right' = 'left';

          if (sourceNodePos && targetNodePos) {
            const dx = targetNodePos.x - sourceNodePos.x;
            const dy = targetNodePos.y - sourceNodePos.y;

            if (Math.abs(dx) > Math.abs(dy)) {
              targetHandle = dx > 0 ? 'left' : 'right';
            } else {
              targetHandle = dy > 0 ? 'top' : 'bottom';
            }
          }
          console.log('🔵 Calculated sourceHandle:', currentState.sourceHandle);
          console.log('🔵 Calculated targetHandle:', targetHandle);

          const color = getColorForPair(currentState.sourceNodeId, targetNode.id);

          const newEdge: Edge = {
            id: `edge-${currentState.sourceNodeId}-${targetNode.id}-${Date.now()}`,
            source: currentState.sourceNodeId,
            target: targetNode.id,
            sourceHandle: currentState.sourceHandle,
            targetHandle: targetHandle,
            type: 'default',
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
    }, [reactFlowInstance, nodes, edges, addEdge, connectionDragState, getColorForPair]);

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

      const moveHandler = (e: any) => {
        handleConnectionMove(e);
      };
      const endHandler = (e: any) => {
        handleConnectionEnd(e);
      };

      document.addEventListener('pointermove', moveHandler, { capture: true });
      document.addEventListener('pointerup', endHandler, { capture: true });

      window.addEventListener('pointermove', moveHandler, { capture: true });
      window.addEventListener('pointerup', endHandler, { capture: true });

      document.body.style.cursor = 'crosshair';

      return () => {
        document.removeEventListener('pointermove', moveHandler, { capture: true });
        document.removeEventListener('pointerup', endHandler, { capture: true });
        window.removeEventListener('pointermove', moveHandler, { capture: true });
        window.removeEventListener('pointerup', endHandler, { capture: true });
        document.body.style.cursor = '';
      };
    }, [connectionDragState?.isActive, handleConnectionMove, handleConnectionEnd]);

    const handleToolClick = (toolType: string, toolName: string, diagramType?: string) => {
      if (!reactFlowInstance || !reactFlowWrapper.current) return;

      const canvasBounds = reactFlowWrapper.current.getBoundingClientRect();
      const centerX = canvasBounds.width / 2;
      const centerY = canvasBounds.height / 2;

      const position = reactFlowInstance.project({
        x: centerX,
        y: centerY,
      });

      let label = '';
      let nodeType = 'editable';

      switch (toolType) {
        case 'element':
          switch (toolName) {
            case 'class':
              label = 'Class';
              break;
            case 'abstract-class':
              label = 'AbstractClass';
              break;
            case 'interface':
              label = 'Interface';
              break;
            case 'enumeration':
              label = 'Enumeration';
              break;
            case 'package':
              label = 'Package';
              break;
            default:
              label = toolName;
          }
          break;
        case 'member':
          switch (toolName) {
            case 'attribute':
              label = '+ attribute: Type';
              break;
            case 'method':
              label = '+ method(): ReturnType';
              break;
            case 'private-attribute':
              label = '- privateAttribute: Type';
              break;
            case 'protected-attribute':
              label = '# protectedAttribute: Type';
              break;
            case 'private-method':
              label = '- privateMethod(): ReturnType';
              break;
            case 'protected-method':
              label = '# protectedMethod(): ReturnType';
              break;
            default:
              label = toolName;
          }
          break;
        case 'relationship':
          switch (toolName) {
            case 'association':
              label = 'Association';
              break;
            case 'aggregation':
              label = 'Aggregation';
              break;
            case 'composition':
              label = 'Composition';
              break;
            case 'inheritance':
              label = 'Inheritance';
              break;
            case 'realization':
              label = 'Realization';
              break;
            case 'dependency':
              label = 'Dependency';
              break;
            default:
              label = toolName;
          }
          break;
        case 'multiplicity':
          switch (toolName) {
            case 'one':
              label = '1';
              break;
            case 'many':
              label = '*';
              break;
            case 'optional':
              label = '0..1';
              break;
            case 'range':
              label = '1..*';
              break;
            default:
              label = toolName;
          }
          break;
        default:
          label = toolName;
      }

      const newNode: Omit<Node, 'id'> = {
        type: nodeType,
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
    };

    const loadDiagramData = (newNodes: any[], newEdges: any[]) => {
      console.log('Loading diagram data:', { newNodes, newEdges });

      setNodes([]);
      setEdges([]);

      if (newNodes.length > 0) {
        setNodes(newNodes);
      }
      if (newEdges.length > 0) {
        setEdges(newEdges);
      }

      console.log('Diagram data loaded successfully');
    };

    const handleDragOver = (event: React.DragEvent) => {
      onDragOver(event);
      setIsDragOver(true);
    };

    const handleDragLeave = () => {
      setIsDragOver(false);
    };

    const handleDrop = (event: React.DragEvent) => {
      setIsDragOver(false);
      onDrop(event);
    };

    const handleLabelChange = (id: string, newLabel: string) => {
      updateNodeLabel(id, newLabel);
    };

    const handleConnectionStart = (nodeId: string, handle: 'top' | 'bottom' | 'left' | 'right') => {
      console.log('🔵 Connection drag started:', { nodeId, handle });

      const initialPosition = getHandlePosition(nodeId, handle);
      console.log('🔵 Initial position:', initialPosition);

      setConnectionDragState({
        isActive: true,
        sourceNodeId: nodeId,
        sourceHandle: handle,
        currentPosition: initialPosition,
      });
    };

    const addEcoreFile = (fileName: string, fileContent: string, meta?: any) => {
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
    };

    const handleEcoreFileSelect = (fileName: string) => {
      const ecoreNode = nodes.find(
        n => n.type === 'ecoreFile' && n.data.fileName === fileName
      );
      if (ecoreNode) {
        setSelectedFileId(ecoreNode.id);
        if (onEcoreFileSelect) {
          onEcoreFileSelect(fileName);
        }
      }
    };

    const handleEcoreFileExpand = (fileName: string, fileContent: string) => {
      const ecoreNode = nodes.find(
        n => n.type === 'ecoreFile' && n.data.fileName === fileName
      );

      if (ecoreNode) {
        setExpandedFileId(null);
        setExpandedFileId(ecoreNode.id);
        setSelectedFileId(ecoreNode.id);
        const updatedNodes = nodes.map(n =>
          n.id === ecoreNode.id
            ? { ...n, data: { ...n.data, isExpanded: true } }
            : n
        );
        setNodes(updatedNodes);
      }

      if (onEcoreFileExpand) {
        onEcoreFileExpand(fileName, fileContent);
      }
    };

    React.useEffect(() => {
      if (onDiagramChange) {
        onDiagramChange(nodes, edges);
      }
    }, [nodes, edges, onDiagramChange]);

    useImperativeHandle(ref, () => ({
      handleToolClick: handleToolClick,
      loadDiagramData: loadDiagramData,
      getNodes: () => nodes,
      getEdges: () => edges,
      addEcoreFile: addEcoreFile,
      resetExpandedFile: () => {
        setExpandedFileId(null);
        const updatedNodes = nodes.map(n =>
          n.type === 'ecoreFile'
            ? { ...n, data: { ...n.data, isExpanded: false } }
            : n
        );
        setNodes(updatedNodes);
      },
      undo: undo,
      redo: redo,
      canUndo: canUndo,
      canRedo: canRedo,
    }));

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
          nodes={nodes.map(node => {
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
          })}
          edges={edges}
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

        {connectionDragState?.isActive &&
          connectionDragState.sourceNodeId &&
          connectionDragState.sourceHandle &&
          connectionDragState.currentPosition &&
          reactFlowInstance &&
          reactFlowWrapper.current && (() => {
            const sourcePos = getHandlePosition(
              connectionDragState.sourceNodeId,
              connectionDragState.sourceHandle
            );

            if (!sourcePos) return null;

            const viewport = reactFlowInstance.getViewport();

            const sourceScreen = {
              x: sourcePos.x * viewport.zoom + viewport.x,
              y: sourcePos.y * viewport.zoom + viewport.y,
            };

            const targetScreen = {
              x: connectionDragState.currentPosition.x * viewport.zoom + viewport.x,
              y: connectionDragState.currentPosition.y * viewport.zoom + viewport.y,
            };

            return (
              <ConnectionLine
                sourcePosition={sourceScreen}
                targetPosition={targetScreen}
              />
            );
          })()}

        <div style={{ position: 'absolute', left: 16, bottom: 16, zIndex: 31, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button
            onClick={() => reactFlowInstance?.zoomIn?.()}
            style={{ width: 36, height: 36, borderRadius: 6, border: '1px solid #e5e7eb', background: '#ffffff', cursor: 'pointer' }}
            title="Zoom in"
          >
            +
          </button>
          <button
            onClick={() => reactFlowInstance?.zoomOut?.()}
            style={{ width: 36, height: 36, borderRadius: 6, border: '1px solid #e5e7eb', background: '#ffffff', cursor: 'pointer' }}
            title="Zoom out"
          >
            –
          </button>
          <button
            onClick={() => reactFlowInstance?.fitView?.({ padding: 0.2 })}
            style={{ width: 36, height: 36, borderRadius: 6, border: '1px solid #e5e7eb', background: '#ffffff', cursor: 'pointer' }}
            title="Fit view"
          >
            ⛶
          </button>
          <button
            onClick={() => {
              const next = !isInteractive;
              setIsInteractive(next);
            }}
            style={{ width: 36, height: 36, borderRadius: 6, border: '1px solid #e5e7eb', background: '#ffffff', cursor: 'pointer' }}
            title={isInteractive ? 'Lock interactions' : 'Unlock interactions'}
          >
            {isInteractive ? '🔓' : '🔒'}
          </button>
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
      </div>
    );
  });