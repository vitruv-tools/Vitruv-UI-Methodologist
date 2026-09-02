import React from 'react';
import type { Edge, Node } from 'reactflow';
import type { ViewType } from '../../hooks/useViewTypes';
import { MethodologistMetricsView } from '../metrics/MethodologistMetricsView';

export interface CanvasMetricsOverlayProps {
  projectId?: number;
  visible: boolean;
  canvasNodes: Node[];
  canvasEdges: Edge[];
  viewTypes: ViewType[];
  onClose?: () => void;
}

export const CanvasMetricsOverlay: React.FC<CanvasMetricsOverlayProps> = ({
  projectId,
  visible,
  canvasNodes,
  canvasEdges,
  viewTypes,
  onClose,
}) => (
  <div
    data-testid="canvas-metrics-overlay"
    style={{
      position: 'absolute',
      top: 72,
      left: 0,
      right: 0,
      bottom: 0,
      display: visible ? 'flex' : 'none',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      pointerEvents: 'none',
      background: 'transparent',
      backdropFilter: 'none',
      WebkitBackdropFilter: 'none',
      filter: 'none',
      padding: '8px 16px 16px',
      boxSizing: 'border-box',
    }}
  >
    <div style={{ position: 'relative', zIndex: 1, maxHeight: '100%', display: 'flex', pointerEvents: 'auto' }}>
      <MethodologistMetricsView
        vsumId={projectId}
        nodes={canvasNodes}
        edges={canvasEdges}
        viewTypes={viewTypes}
        enabled={visible}
        onClose={onClose}
      />
    </div>
  </div>
);
