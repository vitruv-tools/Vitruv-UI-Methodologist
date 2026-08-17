import React, { memo } from 'react';
import { type NodeProps } from 'reactflow';

export interface BoundingBoxNodeData {
  label: string;
  color?: string;
  isBoundingBox: true;
  width?: number;
  height?: number;
}

/**
 * Bounding box group node wrapping all EObject nodes from one meta-model.
 *
 * Styled to match old branch reference: dashed colored border, colored header
 * bar with model name, "Contents - Drag classes here..." placeholder area.
 */
const BoundingBoxNode: React.FC<NodeProps<BoundingBoxNodeData>> = ({ data, selected }) => {
  const { label, color = '#f0a030' } = data;
  const borderColor = selected ? '#1976d2' : color;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        border: `2.5px dashed ${borderColor}`,
        borderRadius: 10,
        background: `${color}08`,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Model header bar */}
      <div
        style={{
          background: `${color}25`,
          borderBottom: `1.5px dashed ${color}88`,
          borderRadius: '8px 8px 0 0',
          padding: '8px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          pointerEvents: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: color, display: 'inline-block',
          }} />
          <span style={{ fontWeight: 700, fontSize: 13, color: '#333' }}>
            {label}
          </span>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: color, display: 'inline-block',
          }} />
        </div>
        <div style={{ fontSize: 10, color: '#888', fontStyle: 'italic' }}>
          Contents
        </div>
      </div>

      {/* Body area (children rendered by React Flow inside) */}
      <div style={{ flex: 1 }} />
    </div>
  );
};

export default memo(BoundingBoxNode);
