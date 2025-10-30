import React, { useRef, useState, forwardRef, useImperativeHandle, useEffect } from 'react';
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

const nodeTypes = { 
  editable: EditableNode,
  ecoreFile: EcoreFileBox  // ← Neuer Node-Typ registriert
};
const edgeTypes = { uml: UMLRelationship };

interface FlowCanvasProps {
  onDeploy?: (nodes: Node[], edges: Edge[]) => void;
  onToolClick?: (toolType: string, toolName: string, diagramType?: string) => void;
  onDiagramChange?: (nodes: Node[], edges: Edge[]) => void;
  // ecoreFiles prop entfernt - wird Teil von nodes
  onEcoreFileSelect?: (fileName: string) => void;
  onEcoreFileExpand?: (fileName: string, fileContent: string) => void;
  // onEcoreFilePositionChange entfernt - onNodesChange macht das
  onEcoreFileDelete?: (id: string) => void;
  onEcoreFileRename?: (id: string, newFileName: string) => void;
}

// NEU:
export const FlowCanvas = forwardRef<{ 
  handleToolClick: (toolType: string, toolName: string, diagramType?: string) => void;
  loadDiagramData: (nodes: any[], edges: any[]) => void;
  getNodes: () => Node[];
  getEdges: () => Edge[];
  addEcoreFile: (fileName: string, fileContent: string, meta?: any) => void;  // ← meta hinzugefügt
  resetExpandedFile: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}, FlowCanvasProps>(
  ({ onDeploy, onToolClick, onDiagramChange, onEcoreFileSelect, onEcoreFileExpand, onEcoreFileDelete, onEcoreFileRename }, ref) => {
  // ecoreFiles prop entfernt aus destructuring
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isInteractive, setIsInteractive] = useState(true);
  // selectedFileId und expandedFileId bleiben, für interne Tracking
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [expandedFileId, setExpandedFileId] = useState<string | null>(null);
  
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

  const { onDrop, onDragOver } = useDragAndDrop({
    reactFlowInstance,
    reactFlowWrapper,
    addNode,
    addEdge,
  });

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

// NEU:
// ANPASSUNG in FlowCanvas:
const addEcoreFile = (fileName: string, fileContent: string, meta?: any) => {
  // Position aus meta verwenden, oder default
  const position = meta?.position || { x: 100, y: 100 };
  
  const newEcoreNode: Node = {
    id: `ecore-${Date.now()}`,
    type: 'ecoreFile',
    position: position,  // ← Verwende die übergebene Position
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

// NEU:
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

// NEU:
const handleEcoreFileExpand = (fileName: string, fileContent: string) => {
  // Finde den EcoreFile Node im nodes Array
  const ecoreNode = nodes.find(
    n => n.type === 'ecoreFile' && n.data.fileName === fileName
  );
  
  if (ecoreNode) {
    setExpandedFileId(null);
    setExpandedFileId(ecoreNode.id);
    setSelectedFileId(ecoreNode.id);
    
    // Update den Node's data um isExpanded zu setzen
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

  // NEU (gleich, aber mit angepasster addEcoreFile Signatur):
useImperativeHandle(ref, () => ({
  handleToolClick: handleToolClick,
  loadDiagramData: loadDiagramData,
  getNodes: () => nodes,
  getEdges: () => edges,
  addEcoreFile: addEcoreFile,  // ← Nimmt jetzt (fileName, fileContent, meta)
  resetExpandedFile: () => {
    setExpandedFileId(null);
    // Optional: Update alle EcoreFile Nodes um isExpanded zu clearen
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
     // NEU:
<ReactFlow
  nodes={nodes.map(node => {
    // Für alle Nodes: füge callbacks hinzu
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
    
    // Für EcoreFile Nodes: füge callbacks und state hinzu
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
        },
        selected: selectedFileId === node.id,  // ← ReactFlow's selection system
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
  nodesDraggable={isInteractive}
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

{/* EcoreFileBoxes werden NICHT mehr separat gerendert - sie sind jetzt Nodes! */}
      
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
          ✨ Drop UML element here ✨
        </div>
      )}
      
      
    </div>
  );
}); 