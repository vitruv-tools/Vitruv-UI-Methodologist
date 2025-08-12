import React, { useRef, useState } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  ReactFlowInstance,
  Node,
  Edge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useFlowState } from '../../hooks/useFlowState';
import { useDragAndDrop } from '../../hooks/useDragAndDrop';
import { EditableNode } from './EditableNode';

const nodeTypes = { editable: EditableNode };

interface FlowCanvasProps {
  onDeploy?: (nodes: Node[], edges: Edge[]) => void;
}

export function FlowCanvas({ onDeploy }: FlowCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    updateNodeLabel,
  } = useFlowState();

  const { onDrop, onDragOver } = useDragAndDrop({
    reactFlowInstance,
    reactFlowWrapper,
    addNode,
  });

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

  return (
    <div
      ref={reactFlowWrapper}
      style={{ 
        flexGrow: 1, 
        height: '100vh',
        position: 'relative',
        border: isDragOver ? '3px dashed #3498db' : 'none',
        transition: 'border 0.2s ease'
      }}
    > 
      <ReactFlow
        nodes={nodes.map(node => ({
          ...node,
          data: { ...node.data, onLabelChange: handleLabelChange }
        }))}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onInit={setReactFlowInstance}
        nodeTypes={nodeTypes}
      >
        <MiniMap />
        <Controls />
        <Background />
      </ReactFlow>
      
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
} 