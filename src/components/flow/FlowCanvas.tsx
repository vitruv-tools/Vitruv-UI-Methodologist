import React, { useRef, useState, forwardRef, useImperativeHandle, useEffect, useCallback } from 'react';
import ReactFlow, { MiniMap, Background, ReactFlowInstance, Node, Edge } from 'reactflow';
import 'reactflow/dist/style.css';
import { useFlowState } from '../../hooks/useFlowState';
import { useDragAndDrop } from '../../hooks/useDragAndDrop';
import { EditableNode } from './EditableNode';
import { UMLRelationship } from './UMLRelationship';
import { EcoreFileBox } from './EcoreFileBox';

const nodeTypes = { editable: EditableNode, ecoreFile: EcoreFileBox };
const edgeTypes = { uml: UMLRelationship };

interface FlowCanvasProps {
  onDeploy?: (nodes: Node[], edges: Edge[]) => void;
  onDiagramChange?: (nodes: Node[], edges: Edge[]) => void;
  onEcoreFileSelect?: (fileName: string) => void;
  onEcoreFileExpand?: (fileName: string, fileContent: string) => void;
  onEcoreFileDelete?: (id: string) => void;
  onEcoreFileRename?: (id: string, newFileName: string) => void;
}

type FlowCanvasHandle = {
  loadDiagramData: (nodes: any[], edges: any[]) => void;
  resetExpandedFile: () => void;
  setInteractive: (enabled: boolean) => void;
  setDraggable: (enabled: boolean) => void;
  addEcoreFile: (
    fileName: string,
    fileContent: string,
    meta?: { position?: { x: number; y: number }; description?: string; keywords?: string; domain?: string; createdAt?: string }
  ) => string;
  getNodes: () => Node[];
  getEdges: () => Edge[];
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

export const FlowCanvas = forwardRef<FlowCanvasHandle, FlowCanvasProps>(
  ({ onDeploy, onDiagramChange, onEcoreFileSelect, onEcoreFileExpand, onEcoreFileDelete, onEcoreFileRename }, ref) => {
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isInteractive, setIsInteractive] = useState(true);
    const [isDraggable, setIsDraggable] = useState(true);
    const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
    const [expandedFileId, setExpandedFileId] = useState<string | null>(null);
    const [routingStyle, setRoutingStyle] = useState<'curved' | 'orthogonal'>('orthogonal');
    const [lineSeparation] = useState<number>(36);
    const controlButtonStyle: React.CSSProperties = {
      width: 36,
      height: 36,
      borderRadius: 6,
      border: '1px solid #e5e7eb',
      background: '#ffffff',
      cursor: 'pointer',
    };
    const hiddenEcoreNodeRef = useRef<Node | null>(null);

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
    } = useFlowState();

    const { onDrop, onDragOver } = useDragAndDrop({
      reactFlowInstance,
      reactFlowWrapper,
      addNode,
    });

    const loadDiagramData = (newNodes: any[], newEdges: any[]) => {
      setNodes([]);
      setEdges([]);
      if (newNodes.length > 0) setNodes(newNodes);
      if (newEdges.length > 0) setEdges(newEdges);
    };

    const handleCanvasDragOver = (event: React.DragEvent) => {
      onDragOver(event);
      setIsDragOver(true);
    };

    const handleDragLeave = () => setIsDragOver(false);

    const handleDrop = (event: React.DragEvent) => {
      setIsDragOver(false);
      onDrop(event);
    };

    const handleLabelChange = (id: string, newLabel: string) => {
      updateNodeLabel(id, newLabel);
    };

    const handleEcoreFileSelect = (fileName: string) => {
      const node = nodes.find((n) => n.type === 'ecoreFile' && (n.data as any)?.fileName === fileName);
      if (node) {
        setSelectedFileId(node.id);
        onEcoreFileSelect?.(fileName);
      }
    };

    const handleEcoreFileExpand = (fileName: string, fileContent: string) => {
      const node = nodes.find((n) => n.type === 'ecoreFile' && (n.data as any)?.fileName === fileName);
      if (node) {
        setExpandedFileId(null);
        setExpandedFileId(node.id);
        setSelectedFileId(node.id);
        // remember this ecore card so we can bring it back alongside UML
        hiddenEcoreNodeRef.current = { ...node };
      }
      onEcoreFileExpand?.(fileName, fileContent);
      // Lightly zoom out so the generated UML is seen from a bit farther
      requestAnimationFrame(() => {
        try {
          reactFlowInstance?.zoomTo?.(0.8);
        } catch {}
      });
    };

    useEffect(() => {
      if (onDiagramChange) onDiagramChange(nodes, edges);
    }, [nodes, edges, onDiagramChange]);

    // No auto-fit on load to avoid over-zooming; keep user's viewport

    useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Delete' || event.key === 'Backspace') {
          // Try React Flow selection first
          if (reactFlowInstance) {
            const selectedNodes = reactFlowInstance.getNodes().filter((n) => n.selected);
            const selectedEdges = reactFlowInstance.getEdges().filter((e) => e.selected);
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
          // If no RF selection, delete selected Ecore box if any
          if (selectedFileId && onEcoreFileDelete) {
            event.preventDefault();
            onEcoreFileDelete(selectedFileId);
            setSelectedFileId(null);
            return;
          }
        }

        if (event.ctrlKey || event.metaKey) {
          switch (event.key.toLowerCase()) {
            case 'z':
              event.preventDefault();
              if (event.shiftKey) {
                if (canRedo) redo();
              } else {
                if (canUndo) undo();
              }
              break;
            case 'y':
              event.preventDefault();
              if (canRedo) redo();
              break;
          }
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }, [reactFlowInstance, selectedFileId, onEcoreFileDelete, removeNode, removeEdge, canUndo, canRedo, undo, redo]);

    useImperativeHandle(ref, () => ({
      loadDiagramData,
      resetExpandedFile: () => setExpandedFileId(null),
      setInteractive: (enabled: boolean) => setIsInteractive(enabled),
      setDraggable: (enabled: boolean) => setIsDraggable(enabled),
      addEcoreFile: (fileName, fileContent, meta) => {
        const position = meta?.position ?? { x: 100, y: 100 };
        const id = addNode({
          type: 'ecoreFile',
          position,
          data: {
            fileName,
            fileContent,
            description: meta?.description,
            keywords: meta?.keywords,
            domain: meta?.domain,
            createdAt: meta?.createdAt,
          },
        });
        return id;
      },
      getNodes: () => nodes,
      getEdges: () => edges,
      undo,
      redo,
      canUndo,
      canRedo,
    }));

    return (
      <div
        ref={reactFlowWrapper}
        style={{
          flexGrow: 1,
          height: '100%',
          position: 'relative',
          border: isDragOver ? '3px dashed #3498db' : 'none',
          transition: 'border 0.2s ease',
        }}
      >
        <ReactFlow
          nodes={nodes.map((node) => {
            if (node.type === 'editable') {
              return {
                ...node,
                data: { ...node.data, onLabelChange: handleLabelChange, onDelete: removeNode },
              };
            }
            if (node.type === 'ecoreFile') {
              return {
                ...node,
                data: {
                  ...(node.data as any),
                  onExpand: handleEcoreFileExpand,
                  onSelect: handleEcoreFileSelect,
                  onDelete: onEcoreFileDelete,
                  onRename: onEcoreFileRename,
                  isSelected: selectedFileId === node.id,
                  isExpanded: expandedFileId === node.id,
                },
              };
            }
            return node;
          })}
          edges={edges.map((edge) => ({
            ...edge,
            data: { ...(edge.data as any), routingStyle, separation: lineSeparation },
          }))}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={handleDrop}
          onDragOver={handleCanvasDragOver}
          onDragLeave={handleDragLeave}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onInit={setReactFlowInstance}
          minZoom={0.6}
          maxZoom={1.6}
          defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
          nodesDraggable={isDraggable}
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

        <div
          style={{
            position: 'absolute',
            left: 16,
            bottom: 16,
            zIndex: 31,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <button onClick={() => reactFlowInstance?.zoomIn?.()} style={controlButtonStyle} title="Zoom in">
            +
          </button>
          <button onClick={() => reactFlowInstance?.zoomOut?.()} style={controlButtonStyle} title="Zoom out">
            –
          </button>
          <button onClick={() => reactFlowInstance?.fitView?.({ padding: 0.2 })} style={controlButtonStyle} title="Fit view">
            ⛶
          </button>
          <button
            onClick={() => setRoutingStyle((prev) => (prev === 'orthogonal' ? 'curved' : 'orthogonal'))}
            style={controlButtonStyle}
            title={`Routing: ${routingStyle === 'orthogonal' ? 'Orthogonal' : 'Curved'} (toggle)`}
          >
            {routingStyle === 'orthogonal' ? '└' : '∿'}
          </button>
          <button
            onClick={() => setIsInteractive((prev) => !prev)}
            style={controlButtonStyle}
            title={isInteractive ? 'Lock interactions' : 'Unlock interactions'}
          >
            {isInteractive ? '🔓' : '🔒'}
          </button>
        </div>

        {hiddenEcoreNodeRef.current && !nodes.some((n) => n.id === hiddenEcoreNodeRef.current?.id) && (
          <button
            onClick={() => {
              const saved = hiddenEcoreNodeRef.current;
              if (!saved) return;
              if (!nodes.some((n) => n.id === saved.id)) {
                setNodes((nds) => nds.concat(saved));
              }
            }}
            style={{
              position: 'absolute',
              top: 52,
              left: 2,
              zIndex: 31,
              width: 56,
              height: 56,
              borderRadius: 10,
              border: '1px solid #e5e7eb',
              background: '#ffffff',
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              fontSize: 28,
              lineHeight: 1,
            }}
            title="Show model card"
            aria-label="Show model card"
          >
            🗂️
          </button>
        )}

        {isDragOver && (
          <div
            style={{
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
              backdropFilter: 'blur(10px)',
            }}
          >
            Drop files here
          </div>
        )}
      </div>
    );
  }
);
