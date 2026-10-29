import React, { useState } from 'react';
import { EdgeLabelRenderer, getBezierPath, type EdgeProps } from 'reactflow';
import { themeVars } from '../../theme/theme';
import type { ScoreEdgeData } from '../../utils/semanticOverlap/linkDiagramLayout';

export const formatPercent = (score: number) => `${Math.round(score * 100)} %`;

/** Dash pattern of class ↔ instance links (same-concept links are solid). */
export const INSTANCE_DASH = '6 4';

/** A correspondence link; width and opacity grow with the score. Instance links are dashed and labelled. */
export const ScoreEdge: React.FC<EdgeProps<ScoreEdgeData>> = ({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data,
}) => {
  const [hovered, setHovered] = useState(false);
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const score = data?.score ?? 0;
  const selected = data?.selected ?? false;
  const instanceLabel = data?.instanceLabel;
  return (
    <>
      <path
        id={id}
        d={path}
        fill="none"
        stroke={selected ? '#049484' : themeVars.umlEdge}
        strokeWidth={(1 + 5 * score) * (selected ? 1.4 : 1)}
        strokeOpacity={selected ? 1 : 0.25 + 0.75 * score}
        strokeDasharray={instanceLabel ? INSTANCE_DASH : undefined}
      />
      {/* Wide invisible path for easier hovering and clicking. */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={14}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="react-flow__edge-interaction"
      />
      {(hovered || selected) && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              background: themeVars.surface,
              border: `1px solid ${themeVars.border}`,
              borderRadius: 6,
              padding: '2px 6px',
              fontSize: 11,
              fontWeight: 600,
              color: themeVars.text,
              pointerEvents: 'none',
            }}
          >
            {instanceLabel ? `${instanceLabel} · ${formatPercent(score)}` : formatPercent(score)}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};
