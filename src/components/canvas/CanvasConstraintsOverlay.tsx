import React from 'react';
import type { Node } from 'reactflow';
import { ConstraintsView } from '../constraints/ConstraintsView';

export interface CanvasConstraintsOverlayProps {
  projectId?: number;
  visible: boolean;
  canvasNodes: Node[];
  onHighlightNode: (nodeId: string | null) => void;
  filterNodeId: string | null;
}

export const CanvasConstraintsOverlay: React.FC<CanvasConstraintsOverlayProps> = ({
  projectId,
  visible,
  canvasNodes,
  onHighlightNode,
  filterNodeId,
}) => (
  <div data-testid="canvas-constraints-overlay" style={{
    position: 'absolute', top: 72, left: 0, right: 0, bottom: 0,
    display: visible ? 'flex' : 'none',
    zIndex: 100, pointerEvents: 'none',
  }}>
    <ConstraintsView
      key={projectId ?? 'default'}
      vsumId={projectId?.toString()}
      canvasNodes={canvasNodes}
      onHighlightNode={onHighlightNode}
      filterNodeId={filterNodeId}
    />
  </div>
);
