import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactFlow, { Background, Edge, MiniMap, Node, ReactFlowInstance } from 'reactflow';
import 'reactflow/dist/style.css';
import { EditableNode } from './EditableNode';
import { UMLRelationship } from './UMLRelationship';
import { generateUMLFromEcore } from '../../utils/umlGenerator';
import { pickFocusUmlFlowNodes } from '../../utils/umlClassLayout';
import { ActionButton } from '../ui/ActionButton';
import { APP_FONT, largeModalPanelStyle, modalCloseButtonStyle, modalPanelHeaderStyle } from '../ui/sharedStyles';
import { modalBackdropStyle, modalDialogShellStyle, useModalBodyLock } from '../ui/modalUtils';

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

  const fitFocusedUmlView = useCallback((inst: ReactFlowInstance, nodeList: Node[]) => {
    const editable = nodeList.filter(n => n.type === 'editable');
    const focusNodes = pickFocusUmlFlowNodes(editable);
    inst.fitView({
      padding: 0.2,
      nodes: focusNodes.length > 0 ? focusNodes : editable,
    });
  }, []);

  useEffect(() => {
    if (ready && rfRef.current) {
      const t = setTimeout(() => {
        try {
          if (rfRef.current) fitFocusedUmlView(rfRef.current, nodes);
        } catch { /* layout not ready */ }
      }, 0);
      return () => clearTimeout(t);
    }
  }, [ready, nodes, edges, fitFocusedUmlView]);

  const handleInit = useCallback((inst: ReactFlowInstance) => {
    rfRef.current = inst;
    requestAnimationFrame(() => fitFocusedUmlView(inst, nodes));
  }, [nodes, fitFocusedUmlView]);

  // Toggle edge selection when a UML relationship is clicked
  useEffect(() => {
    if (!isOpen) return;

    const handleEdgeClick = (e: Event) => {
      const { edgeId, currentlySelected } = (e as CustomEvent<{ edgeId: string; currentlySelected: boolean }>).detail;
      setEdges(prev =>
        prev.map(edge => ({ ...edge, selected: edge.id === edgeId ? !currentlySelected : false })),
      );
      setNodes(prev => prev.map(node => ({ ...node, selected: false })));
    };

    globalThis.addEventListener('edge-clicked', handleEdgeClick as EventListener);
    return () => globalThis.removeEventListener('edge-clicked', handleEdgeClick as EventListener);
  }, [isOpen]);

  const handlePaneClick = useCallback(() => {
    setEdges(prev => prev.map(edge => ({ ...edge, selected: false })));
  }, []);

  useModalBodyLock(isOpen);

  if (!isOpen) return null;

  return (
    <dialog
      open
      style={{
        ...modalDialogShellStyle,
        display: 'grid',
        placeItems: 'center',
      }}
      onClose={onClose}
      onCancel={onClose}
    >
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
        style={{ ...modalBackdropStyle, position: 'absolute' }}
      />
      <div
        style={{
          ...largeModalPanelStyle,
          width: '92vw',
          height: '88vh',
          maxHeight: 'none',
        }}
      >
        <div style={modalPanelHeaderStyle}>
          <div
            style={{
              fontWeight: 700,
              color: '#0f172a',
              fontSize: '16px',
              fontFamily: APP_FONT,
              letterSpacing: '-0.01em',
            }}
          >
            {title || 'UML Diagram'}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <ActionButton
              variant="ghost"
              size="sm"
              onClick={() => {
                if (rfRef.current) fitFocusedUmlView(rfRef.current, nodes);
              }}
              title="Fit view"
            >
              Fit view
            </ActionButton>
            <button
              type="button"
              onClick={onClose}
              style={modalCloseButtonStyle}
              title="Close"
              aria-label="Close viewer"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f1f5f9';
                e.currentTarget.style.color = '#374151';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#94a3b8';
              }}
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
            onPaneClick={handlePaneClick}
            elementsSelectable
            edgesFocusable
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
    </dialog>
  );
};
