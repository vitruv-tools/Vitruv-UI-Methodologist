import React, { useCallback, useRef, useState } from 'react';
import { EditableNode } from './EditableNode';

import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  ReactFlowInstance
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Sidebar } from './Sidebar';
const nodeTypes = { editable: EditableNode };
const initialNodes: Node[] = [

];
const initialEdges: Edge[] = [];

let id = 3;
const getId = () => (id++).toString();

function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

  const onConnect = useCallback(
    (params: Edge | Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      // React Flow expects 'application/reactflow' key for custom node types
      const type = event.dataTransfer.getData('application/reactflow');
      if (!type || !reactFlowInstance) return;

      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!reactFlowBounds) return;

      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      let label = '';
      if (type === 'sequence') label = 'Sequence Table';
      if (type === 'object') label = 'Object Table';

      const newNode: Node = {
        id: getId(),
        type: 'editable',
        position,
        data: { label, onLabelChange }
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
  );

  const onLabelChange = (id: string, newLabel: string) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, label: newLabel, onLabelChange } }
          : node
      )
    );
  };

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex' }}>
      <Sidebar />
      <div
        ref={reactFlowWrapper}
        style={{ flexGrow: 1, height: '100vh', marginLeft: 180 }}
      >
        {/* DEPLOY BUTTON */}
        <div style={{ padding: 10, position: 'absolute', top: 10, right: 30, zIndex: 100 }}>
          <button
            style={{
              padding: '8px 20px',
              fontSize: 16,
              borderRadius: 6,
              background: '#0091ea',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
            }}
            onClick={() => {
              console.log('DEPLOY:', { nodes, edges });
              alert('Model data printed to console!\n(Next step: send to Vitruvius backend)');
            }}
          >
            Deploy
          </button>
        </div>
        <ReactFlow
          nodes={nodes}
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
    </div>
  );
}

export default App;