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

  const handleLabelChange = (id: string, newLabel: string) => {
    updateNodeLabel(id, newLabel);
  };

  // const handleDeploy = () => {
  //   if (onDeploy) {
  //     onDeploy(nodes, edges);
  //   } else {
  //     console.log('DEPLOY:', { nodes, edges });
  //     alert('Model data printed to console!\n(Next step: send to Vitruvius backend)');
  //   }
  // };

  return (
    <div
      ref={reactFlowWrapper}
      style={{ flexGrow: 1, height: '100vh', marginLeft: 180 }}
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
        onDrop={onDrop}
        onDragOver={onDragOver}
        onInit={setReactFlowInstance}
        nodeTypes={nodeTypes}
      >
        <MiniMap />
        <Controls />
        <Background />
      </ReactFlow>
    </div>
  );
} 