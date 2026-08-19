import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { FlowNodeECoreData } from '../../../types/flow';

const DOT_SIZE = 12;
const HIT_SIZE = 18;

export interface GhostNodeData {
  label?: string;
  group?: string;
  ecore: FlowNodeECoreData;
}

/**
 * Visible midpoint handle on an intra-model UML association (EReference).
 *
 * Both a source and a target reaction handle sit on the same dot so a
 * fine-granular reaction can start or end at this EReference. Handle ids
 * use the existing `reaction-{source|target}-{eReferenceId}` convention
 * so connect / save treat the reference as a normal EObject endpoint.
 */
const GhostNode: React.FC<NodeProps<GhostNodeData>> = memo(({ data }) => {
  const eObjectId = data?.ecore?.eObjectId;
  if (!eObjectId) return null;

  return (
    <div
      style={{
        width: DOT_SIZE,
        height: DOT_SIZE,
        borderRadius: '50%',
        background: '#ffffff',
        border: '2px solid #374151',
        boxShadow: '0 1px 2px rgba(0,0,0,0.35)',
        position: 'relative',
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        id={`reaction-target-${eObjectId}`}
        className="reaction-handle reaction-handle-target ghost-reaction-handle"
        isConnectable
        style={{
          left: (DOT_SIZE - HIT_SIZE) / 2,
          top: (DOT_SIZE - HIT_SIZE) / 2,
          width: HIT_SIZE,
          height: HIT_SIZE,
          borderRadius: '50%',
          background: 'transparent',
          border: 'none',
          transform: 'none',
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id={`reaction-source-${eObjectId}`}
        className="reaction-handle reaction-handle-source ghost-reaction-handle"
        isConnectable
        style={{
          left: (DOT_SIZE - HIT_SIZE) / 2,
          top: (DOT_SIZE - HIT_SIZE) / 2,
          width: HIT_SIZE,
          height: HIT_SIZE,
          borderRadius: '50%',
          background: 'transparent',
          border: 'none',
          transform: 'none',
        }}
      />
    </div>
  );
});

GhostNode.displayName = 'GhostNode';

export default GhostNode;
