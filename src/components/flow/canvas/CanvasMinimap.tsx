import React from 'react';
import { Edge, Node } from 'reactflow';
import { Circle } from '../../../hooks/useCircleContainment';
import { edgeIndicatorPos } from '../../../utils/minimapGeometry';
import { cardColor, darken } from '../EcoreFileBox';
import { ECORE_FILE_BOX_SIZE } from '../flowCanvasConstants';

const MINI_NODE_W = ECORE_FILE_BOX_SIZE.width;
const MINI_NODE_H = ECORE_FILE_BOX_SIZE.height;

export interface CanvasMinimapProps {
  nodes: Node[];
  edges: Edge[];
  circle?: Circle;
  viewport: { x: number; y: number; zoom: number };
  containerW: number;
  containerH: number;
  width: number;
  height: number;
}

/**
 * Minimap that tracks the viewport centre rather than the whole graph, so it
 * always shows what the user is looking at, scaled down. Items outside the
 * visible slice are represented by coloured dots on the border.
 */
export const CanvasMinimap: React.FC<CanvasMinimapProps> = ({
  nodes, edges, circle, viewport, containerW, containerH, width, height,
}) => {
  const ecoreNodes = nodes.filter(n => n.type === 'ecoreFile');

  // Viewport centre in flow coordinates
  const flowCX = (-viewport.x + containerW / 2) / viewport.zoom;
  const flowCY = (-viewport.y + containerH / 2) / viewport.zoom;
  const visW = containerW / viewport.zoom;
  const visH = containerH / viewport.zoom;

  // Scale so the current viewport fills ~80% of the minimap, clamped so extreme
  // zoom levels stay legible.
  const mmScale = Math.max(0.03, Math.min(2, Math.min(
    (width * 0.8) / Math.max(visW, 50),
    (height * 0.8) / Math.max(visH, 50),
  )));

  const toX = (fx: number) => (fx - flowCX) * mmScale + width / 2;
  const toY = (fy: number) => (fy - flowCY) * mmScale + height / 2;

  const nodeMap = new Map(ecoreNodes.map(n => [n.id, n]));

  const vpX = toX(flowCX - visW / 2);
  const vpY = toY(flowCY - visH / 2);
  const vpW = visW * mmScale;
  const vpH = visH * mmScale;

  const indicators: { id: string; x: number; y: number; color: string }[] = [];
  ecoreNodes.forEach(node => {
    const sx = toX(node.position.x + MINI_NODE_W / 2);
    const sy = toY(node.position.y + MINI_NODE_H / 2);
    const ind = edgeIndicatorPos(sx, sy, width, height);
    if (ind) indicators.push({ id: node.id, ...ind, color: cardColor(node.data?.domain) });
  });
  if (circle && circle.r > 0) {
    const ind = edgeIndicatorPos(toX(circle.cx), toY(circle.cy), width, height);
    if (ind) indicators.push({ id: 'circle-overlay', ...ind, color: 'rgba(4,148,132,0.85)' });
  }

  return (
    <div style={{
      position: 'absolute', right: 60, bottom: 16,
      width, height, zIndex: 30,
      background: '#f0f4f8', borderRadius: 8,
      border: '1px solid #e2e8f0',
      boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
      overflow: 'hidden',
    }}>
      <svg width={width} height={height} style={{ display: 'block' }}>
        {/* Views circle, drawn only when it overlaps the visible slice */}
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

        {edges.map(edge => {
          const src = nodeMap.get(edge.source);
          const tgt = nodeMap.get(edge.target);
          if (!src || !tgt) return null;
          return (
            <line key={edge.id}
              x1={toX(src.position.x + MINI_NODE_W / 2)} y1={toY(src.position.y + MINI_NODE_H / 2)}
              x2={toX(tgt.position.x + MINI_NODE_W / 2)} y2={toY(tgt.position.y + MINI_NODE_H / 2)}
              stroke="#94a3b8" strokeWidth={1.2}
            />
          );
        })}

        {ecoreNodes.map(node => {
          const sx = toX(node.position.x);
          const sy = toY(node.position.y);
          const nw = MINI_NODE_W * mmScale;
          const nh = MINI_NODE_H * mmScale;
          if (sx + nw < 0 || sx > width || sy + nh < 0 || sy > height) return null;
          const color = cardColor(node.data?.domain);
          return (
            <rect key={node.id} x={sx} y={sy} width={nw} height={nh}
              rx={Math.max(2, 8 * mmScale)}
              fill={color} stroke={darken(color, 25)} strokeWidth={1}
            />
          );
        })}

        <rect x={vpX} y={vpY} width={vpW} height={vpH}
          fill="rgba(59,130,246,0.07)" stroke="rgba(59,130,246,0.55)"
          strokeWidth={1.5} rx={2}
        />

        {indicators.map(ind => (
          <circle key={ind.id} cx={ind.x} cy={ind.y} r={4.5}
            fill={ind.color} stroke="white" strokeWidth={1.2}
          />
        ))}
      </svg>
    </div>
  );
};
