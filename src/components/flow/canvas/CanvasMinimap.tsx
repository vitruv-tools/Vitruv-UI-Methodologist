import React from 'react';
import { Edge, Node } from 'reactflow';
import { Circle } from '../../../hooks/useCircleContainment';
import { edgeIndicatorPos } from '../../../utils/minimapGeometry';
import {
  collectCanvasMinimapItems,
  buildMinimapEndpointIndex,
  minimapEdgeSegments,
} from '../../../utils/canvasMinimapItems';
import { darken } from '../../../utils/metaModelColors';

export interface CanvasMinimapProps {
  nodes: Node[];
  edges: Edge[];
  reactionRoutes?: Map<string, { points: Array<{ x: number; y: number }> }>;
  circle?: Circle;
  viewport: { x: number; y: number; zoom: number };
  containerW: number;
  containerH: number;
  width: number;
  height: number;
}

/**
 * Minimap that tracks the viewport centre rather than the whole graph, so it
 * always shows what the user is looking at, scaled down. In Reactions mode it
 * draws bounding boxes and EObject nodes with the same colors as VSUM cards.
 */
export const CanvasMinimap: React.FC<CanvasMinimapProps> = ({
  nodes, edges, reactionRoutes, circle, viewport, containerW, containerH, width, height,
}) => {
  const items = collectCanvasMinimapItems(nodes);
  const endpointIndex = buildMinimapEndpointIndex(nodes, items);
  const edgeSegs = minimapEdgeSegments(nodes, edges, items, endpointIndex, reactionRoutes);

  const flowCX = (-viewport.x + containerW / 2) / viewport.zoom;
  const flowCY = (-viewport.y + containerH / 2) / viewport.zoom;
  const visW = containerW / viewport.zoom;
  const visH = containerH / viewport.zoom;

  const mmScale = Math.max(0.03, Math.min(2, Math.min(
    (width * 0.8) / Math.max(visW, 50),
    (height * 0.8) / Math.max(visH, 50),
  )));

  const toX = (fx: number) => (fx - flowCX) * mmScale + width / 2;
  const toY = (fy: number) => (fy - flowCY) * mmScale + height / 2;

  const vpX = toX(flowCX - visW / 2);
  const vpY = toY(flowCY - visH / 2);
  const vpW = visW * mmScale;
  const vpH = visH * mmScale;

  const indicators: { id: string; x: number; y: number; color: string }[] = [];
  items.filter(item => item.kind !== 'eobject').forEach(item => {
    const sx = toX(item.x + item.width / 2);
    const sy = toY(item.y + item.height / 2);
    const ind = edgeIndicatorPos(sx, sy, width, height);
    if (ind) indicators.push({ id: item.id, ...ind, color: item.color });
  });
  if (circle && circle.r > 0) {
    const ind = edgeIndicatorPos(toX(circle.cx), toY(circle.cy), width, height);
    if (ind) indicators.push({ id: 'circle-overlay', ...ind, color: 'rgba(4,148,132,0.85)' });
  }

  const boxes = items.filter(i => i.kind !== 'eobject');
  const eobjects = items.filter(i => i.kind === 'eobject');

  return (
    <div style={{
      position: 'absolute', right: 60, bottom: 16,
      width, height, zIndex: 30,
      background: 'var(--v-surface)', borderRadius: 8,
      border: '1px solid var(--v-border)',
      boxShadow: 'var(--v-card-shadow)',
      overflow: 'hidden',
    }}>
      <svg width={width} height={height} style={{ display: 'block' }}>
        {circle && circle.r > 0 && (() => {
          const cx = toX(circle.cx);
          const cy = toY(circle.cy);
          const r = circle.r * mmScale;
          if (cx + r < 0 || cx - r > width || cy + r < 0 || cy - r > height) return null;
          return (
            <circle cx={cx} cy={cy} r={r}
              fill="rgba(4,148,132,0.05)" stroke="rgba(4,148,132,0.45)"
              strokeWidth={1.5} strokeDasharray="4 3"
            />
          );
        })()}

        {edgeSegs.map(seg => {
          const screen = seg.points.map(p => ({ x: toX(p.x), y: toY(p.y) }));
          const last = screen[screen.length - 1];
          const prev = screen[screen.length - 2] ?? last;
          const angle = Math.atan2(last.y - prev.y, last.x - prev.x) * (180 / Math.PI);
          return (
            <g key={seg.id}>
              <polyline
                data-edge={seg.id}
                points={screen.map(p => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke="#94a3b8"
                strokeWidth={1.2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <g transform={`translate(${last.x}, ${last.y}) rotate(${angle})`}>
                <polygon points="-5,-2.5 0,0 -5,2.5" fill="#94a3b8" />
              </g>
            </g>
          );
        })}

        {boxes.map(item => {
          const sx = toX(item.x);
          const sy = toY(item.y);
          const nw = item.width * mmScale;
          const nh = item.height * mmScale;
          if (sx + nw < 0 || sx > width || sy + nh < 0 || sy > height) return null;
          return (
            <rect
              key={item.id}
              data-kind={item.kind}
              x={sx} y={sy} width={nw} height={nh}
              rx={Math.max(2, 8 * mmScale)}
              fill={item.color}
              stroke={darken(item.color, 25)}
              strokeWidth={item.kind === 'boundingBox' ? 1.4 : 1}
              strokeDasharray={item.kind === 'boundingBox' ? `${4 * mmScale} ${3 * mmScale}` : undefined}
            />
          );
        })}

        {eobjects.map(item => {
          const sx = toX(item.x);
          const sy = toY(item.y);
          const nw = item.width * mmScale;
          const nh = item.height * mmScale;
          if (sx + nw < 0 || sx > width || sy + nh < 0 || sy > height) return null;
          return (
            <rect
              key={item.id}
              data-kind="eobject"
              x={sx} y={sy} width={nw} height={nh}
              rx={Math.max(1, 3 * mmScale)}
              fill="var(--v-uml-box-bg)"
              stroke={darken(item.color, 20)}
              strokeWidth={0.8}
            />
          );
        })}

        <rect x={vpX} y={vpY} width={vpW} height={vpH}
          fill="rgba(59,130,246,0.07)" stroke="rgba(59,130,246,0.55)"
          strokeWidth={1.5} rx={2}
        />

        {indicators.map(ind => (
          <circle key={ind.id} cx={ind.x} cy={ind.y} r={4.5}
            fill={ind.color} stroke="var(--v-surface)" strokeWidth={1.2}
          />
        ))}
      </svg>
    </div>
  );
};
