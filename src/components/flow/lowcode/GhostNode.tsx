import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';

/**
 * Invisible helper node for mid-edge reaction handle routing.
 *
 * Ghost nodes sit at the boundary between two meta-model bounding boxes
 * so fine-granular reaction edges can route through them cleanly.
 * They are never visible to the user.
 */
const GhostNode: React.FC<NodeProps> = memo(({ id }) => (
  <div style={{ width: 1, height: 1, opacity: 0 }}>
    <Handle
      type="source"
      position={Position.Right}
      id={`ghost-source-${id}`}
      className="reaction-handle"
      style={{ opacity: 0, pointerEvents: 'none' }}
    />
    <Handle
      type="target"
      position={Position.Left}
      id={`ghost-target-${id}`}
      className="reaction-handle"
      style={{ opacity: 0, pointerEvents: 'none' }}
    />
  </div>
));

GhostNode.displayName = 'GhostNode';

export default GhostNode;
