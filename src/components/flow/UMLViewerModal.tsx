import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, { Background, Edge, MiniMap, Node, ReactFlowInstance } from 'reactflow';
import 'reactflow/dist/style.css';
import { EditableNode } from './EditableNode';
import { UMLRelationship } from './UMLRelationship';
import { generateUMLFromEcore } from '../../utils/umlGenerator';

interface UMLViewerModalProps {
  isOpen: boolean;
  title?: string;
  ecoreContent: string;
  onClose: () => void;
}

const nodeTypes = { editable: EditableNode };
const edgeTypes = { uml: UMLRelationship };

export const UMLViewerModal: React.FC<UMLViewerModalProps> = ({ isOpen, title, ecoreContent, onClose }) => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [ready, setReady] = useState(false);
  const rfRef = useRef<ReactFlowInstance | null>(null);

  // Parse once per content
  useEffect(() => {
    if (!isOpen) return;
    const { nodes: umlNodes, edges: umlEdges } = generateUMLFromEcore(ecoreContent);
    setNodes(umlNodes as unknown as Node[]);
    setEdges(umlEdges as unknown as Edge[]);
    setReady(true);
  }, [isOpen, ecoreContent]);

  useEffect(() => {
    if (ready && rfRef.current) {
      // Delay to ensure layout mounts
      const t = setTimeout(() => {
        try {
          rfRef.current?.fitView?.({ padding: 0.2 });
        } catch {}
      }, 0);
      return () => clearTimeout(t);
    }
  }, [ready, nodes, edges]);

  const handleInit = useCallback((inst: ReactFlowInstance) => {
    rfRef.current = inst;
    requestAnimationFrame(() => inst.fitView?.({ padding: 0.2 }));
  }, []);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '92vw',
          height: '88vh',
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '10px 14px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#fafafa',
          }}
        >
          <div style={{ fontWeight: 700, color: '#111827' }}>
            {title || 'UML Diagram'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => rfRef.current?.fitView?.({ padding: 0.2 })}
              style={{ border: '1px solid #e5e7eb', background: '#fff', padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
              title="Fit view"
            >
              ⛶
            </button>
            <button
              onClick={onClose}
              style={{ border: '1px solid #e5e7eb', background: '#fff', padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onInit={handleInit}
            fitView
            elementsSelectable
            panOnDrag
            panOnScroll
            zoomOnScroll
            zoomOnPinch
          >
            <MiniMap />
            <Background />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
};


