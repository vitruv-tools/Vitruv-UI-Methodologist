import React from 'react';
import type { Edge, Node } from 'reactflow';
import type { ViewType } from '../../hooks/useViewTypes';
import { MethodologistMetricsView } from '../metrics/MethodologistMetricsView';

export interface CanvasMetricsOverlayProps {
  projectId?: number;
  projectName?: string | null;
  visible: boolean;
  canvasNodes: Node[];
  canvasEdges: Edge[];
  viewTypes: ViewType[];
  onClose?: () => void;
}

export const CanvasMetricsOverlay: React.FC<CanvasMetricsOverlayProps> = ({
  projectId,
  projectName,
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
      alignItems: 'stretch',
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
    <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 1280, height: '100%', display: 'flex', pointerEvents: 'auto', minWidth: 0, minHeight: 0 }}>
      <MethodologistMetricsView
        vsumId={projectId}
        projectName={projectName}
        nodes={canvasNodes}
        edges={canvasEdges}
        viewTypes={viewTypes}
        enabled={visible}
        onClose={onClose}
      />
    </div>
  </div>
);
