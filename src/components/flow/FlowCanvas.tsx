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
import { CodeEditorModal } from './CodeEditorModal';

// Konstanten
const COLOR_LIST = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
  '#368bd6', '#ff9f40', '#4daf4a', '#ff6b6b', '#b388eb',
  '#9c6644', '#f39ed1', '#a9a9a9', '#c9d22f', '#33c7c7',
  '#2a86d6', '#ffb86b', '#63c37a', '#ff4f7a', '#b08fe8'
];

const LOCALSTORAGE_KEY = 'flow_edge_color_map_v1';
const NODE_DIMENSIONS = { width: 280, height: 180 };

const nodeTypes = {
  editable: EditableNode,
  ecoreFile: EcoreFileBox
};
const edgeTypes = { uml: UMLRelationship };

// Types
interface FlowCanvasProps {
  onDeploy?: (nodes: Node[], edges: Edge[]) => void;
  onDiagramChange?: (nodes: Node[], edges: Edge[]) => void;
  onEcoreFileSelect?: (fileName: string) => void;
  onEcoreFileExpand?: (fileName: string, fileContent: string) => void;
  onEcoreFileDelete?: (id: string) => void;
  onEcoreFileRename?: (id: string, newFileName: string) => void;
}

export const FlowCanvas = forwardRef<{ 
  loadDiagramData: (nodes: any[], edges: any[]) => void;
  resetExpandedFile: () => void;
  setInteractive: (enabled: boolean) => void;
  setDraggable: (enabled: boolean) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}, FlowCanvasProps>(
  ({ onDeploy, onDiagramChange, ecoreFiles = [], onEcoreFileSelect, onEcoreFileExpand, onEcoreFileDelete, onEcoreFileRename }, ref) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isInteractive, setIsInteractive] = useState(true);
  const [isDraggable, setIsDraggable] = useState(true);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [expandedFileId, setExpandedFileId] = useState<string | null>(null);
  const [showEcoreBoxes, setShowEcoreBoxes] = useState<boolean>(true);
  const [routingStyle, setRoutingStyle] = useState<'curved' | 'orthogonal'>('orthogonal');
  const [lineSeparation] = useState<number>(36);
  
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
    addEdge,
  });

    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isInteractive, setIsInteractive] = useState(true);
    const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
    const [expandedFileId, setExpandedFileId] = useState<string | null>(null);
    const [connectionDragState, setConnectionDragState] = useState<ConnectionDragState | null>(null);
    const [codeEditorState, setCodeEditorState] = useState<CodeEditorState | null>(null);

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

      // Delete selected nodes/edges or selected Ecore box
      if (event.key === 'Delete' || event.key === 'Backspace') {
        // Try React Flow selection first
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
      } catch (e) {
        console.warn('Failed to load edge color map', e);
      }
    }, []);

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [undo, redo, canUndo, canRedo]);

  const loadDiagramData = (newNodes: any[], newEdges: any[]) => {
    setNodes([]);
    setEdges([]);
    
    if (newNodes.length > 0) {
      setNodes(newNodes);
    }
    if (newEdges.length > 0) {
      setEdges(newEdges);
    }
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

  const handleEcoreFileSelect = (fileName: string) => {
    const file = ecoreFiles.find(f => f.fileName === fileName);
    if (file) {
      setSelectedFileId(file.id);
      if (onEcoreFileSelect) {
        onEcoreFileSelect(fileName);
      }
    }, [addNode, handleEcoreFileExpand, handleEcoreFileSelect, onEcoreFileSelect, onEcoreFileDelete, onEcoreFileRename]);

  const handleEcoreFileExpand = (fileName: string, fileContent: string) => {
    const file = ecoreFiles.find(f => f.fileName === fileName);
    if (file) {
      setExpandedFileId(null);
      setExpandedFileId(file.id);
      setSelectedFileId(file.id);
      // Hide the clicked project box while the UML diagram is open
      setShowEcoreBoxes(false);
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
    loadDiagramData: loadDiagramData,
    resetExpandedFile: () => setExpandedFileId(null),
    setInteractive: (enabled: boolean) => setIsInteractive(enabled),
    setDraggable: (enabled: boolean) => setIsDraggable(enabled),
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
        nodes={nodes.map(node => ({
          ...node,
          data: { ...node.data, onLabelChange: handleLabelChange, onDelete: removeNode }
        }))}
        edges={edges.map(edge => ({
          ...edge,
          data: { ...(edge.data as any), routingStyle, separation: lineSeparation }
        }))}
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
      
      
      
      {showEcoreBoxes && ecoreFiles.map((file) => (
        <EcoreFileBox
          key={file.id}
          id={file.id}
          fileName={file.fileName}
          fileContent={file.fileContent}
          position={file.position}
          onExpand={handleEcoreFileExpand}
          onSelect={handleEcoreFileSelect}
          onDelete={onEcoreFileDelete}
          onRename={onEcoreFileRename}
          isSelected={selectedFileId === file.id}
          isExpanded={expandedFileId === file.id}
          description={file.description}
          keywords={file.keywords}
          domain={file.domain}
          createdAt={file.createdAt}
        />
      ))}
      
      {/* Canvas Controls anchored to wrapper so they move with sidebar resizing */}
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
          onClick={() => setRoutingStyle(prev => prev === 'orthogonal' ? 'curved' : 'orthogonal')}
          style={{ width: 36, height: 36, borderRadius: 6, border: '1px solid #e5e7eb', background: '#ffffff', cursor: 'pointer' }}
          title={`Routing: ${routingStyle === 'orthogonal' ? 'Orthogonal' : 'Curved'} (toggle)`}
        >
          {routingStyle === 'orthogonal' ? '└' : '∿'}
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

      {/* Toggle to restore hidden project box/card when a UML diagram is open */}
      {!showEcoreBoxes && (
        <button
          onClick={() => setShowEcoreBoxes(true)}
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
            lineHeight: 1
          }}
          title="Show meta model cards"
          aria-label="Show meta model cards"
        >
          🗂️
        </button>
      )}

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
          {createZoomButton(() => reactFlowInstance?.zoomIn?.(), 'Zoom in', '+')}
          {createZoomButton(() => reactFlowInstance?.zoomOut?.(), 'Zoom out', '–')}
          {createZoomButton(() => reactFlowInstance?.fitView?.({ padding: 0.2 }), 'Fit view', '⛶')}
          {createZoomButton(
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
