import React, { useState } from 'react';
import { EdgeLabelRenderer, getBezierPath, type EdgeProps } from 'reactflow';
import { themeVars } from '../../theme/theme';
import { KIND_DASH } from '../../utils/semanticOverlap/correspondenceKind';
import type { ScoreEdgeData } from '../../utils/semanticOverlap/linkDiagramLayout';

export const formatPercent = (score: number) => `${Math.round(score * 100)} %`;

/** Dash pattern of class ↔ instance links (same-concept links are solid). */
export const INSTANCE_DASH = KIND_DASH.instance;

/**
 * A correspondence link; width and opacity grow with the score. Instance, path, split, merge and
 * conditional links have their own dash pattern and a label.
 */
export const ScoreEdge: React.FC<EdgeProps<ScoreEdgeData>> = ({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data,
}) => {
  const [hovered, setHovered] = useState(false);
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const score = data?.score ?? 0;
  const selected = data?.selected ?? false;
  const instanceLabel = data?.instanceLabel;
  const label = instanceLabel ?? data?.kindLabel;
  const dash = instanceLabel ? INSTANCE_DASH : data?.kind && KIND_DASH[data.kind];
  return (
    <>
      <path
        id={id}
        d={path}
        fill="none"
        stroke={selected ? '#049484' : themeVars.umlEdge}
        strokeWidth={(1 + 5 * score) * (selected ? 1.4 : 1)}
        strokeOpacity={selected ? 1 : 0.25 + 0.75 * score}
        strokeDasharray={dash || undefined}
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
            {label ? `${label} · ${formatPercent(score)}` : formatPercent(score)}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};
