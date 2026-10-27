import React, { useState } from 'react';
import { EdgeLabelRenderer, getBezierPath, type EdgeProps } from 'reactflow';
import { themeVars } from '../../theme/theme';
import type { ScoreEdgeData } from '../../utils/semanticOverlap/linkDiagramLayout';

export const formatPercent = (score: number) => `${Math.round(score * 100)} %`;

/** A correspondence link; width and opacity grow with the score. */
export const ScoreEdge: React.FC<EdgeProps<ScoreEdgeData>> = ({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data,
}) => {
  const [hovered, setHovered] = useState(false);
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const score = data?.score ?? 0;
  const selected = data?.selected ?? false;
  return (
    <>
      <path
        id={id}
        d={path}
        fill="none"
        stroke={selected ? '#049484' : themeVars.umlEdge}
        strokeWidth={(1 + 5 * score) * (selected ? 1.4 : 1)}
        strokeOpacity={selected ? 1 : 0.25 + 0.75 * score}
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
            {formatPercent(score)}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};
