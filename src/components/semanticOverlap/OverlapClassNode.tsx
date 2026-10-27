import React from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { themeVars } from '../../theme/theme';
import type { OverlapClassNodeData } from '../../utils/semanticOverlap/linkDiagramLayout';

/** A class box in the link diagram; the handle sits on the side facing the other metamodel. */
export const OverlapClassNode: React.FC<NodeProps<OverlapClassNodeData>> = ({ data }) => {
  const isSource = data.side === 'source';
  return (
    <div
      title={data.qualifiedName}
      style={{
        width: 220,
        padding: '8px 12px',
        borderRadius: 8,
        border: `${data.selected ? 2 : 1}px solid ${data.selected ? '#049484' : themeVars.umlBoxBorder}`,
        background: data.unmatched ? themeVars.umlBoxMuted : themeVars.umlBoxBg,
        color: data.unmatched ? themeVars.umlBoxTextMuted : themeVars.umlBoxText,
        opacity: data.unmatched ? 0.6 : 1,
        boxShadow: data.selected ? '0 0 0 3px rgba(4,148,132,0.18)' : 'none',
        fontSize: 13,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
        <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {data.label}
        </span>
        {!data.unmatched && (
          <span style={{ fontSize: 11, color: themeVars.umlBoxTextMuted }}>
            {data.correspondenceIds.length === 1 ? '1 match' : `${data.correspondenceIds.length} matches`}
          </span>
        )}
      </div>
      <div style={{ fontSize: 11, color: themeVars.umlBoxTextMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {data.packageName}
      </div>
      <Handle
        type={isSource ? 'source' : 'target'}
        position={isSource ? Position.Right : Position.Left}
        isConnectable={false}
        style={{ opacity: 0 }}
      />
    </div>
  );
};
