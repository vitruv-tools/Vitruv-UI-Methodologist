import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { edgeIndicatorPos } from '../../utils/minimapGeometry';

const BW = 190;
const NAME_H = 36;
const STEREO_H = 54;
const ATTR_ROW = 22;
const ATTR_PAD = 10;
const ADD_BTN_H = 22;
const METH_H = 26;

const MAP_W = 132;
const MAP_H = 92;
const MIN_MM_SCALE = 0.03;
const MAX_MM_SCALE = 2;
const VIEWPORT_FILL_RATIO = 0.8;
const INDICATOR_MARGIN = 6;

export interface UMLDiagramMinimapClass {
  id: string;
  x: number;
  y: number;
  isAbstract: boolean;
  isInterface: boolean;
  attributes: ReadonlyArray<unknown>;
}

export interface UMLDiagramMinimapRelationship {
  id: string;
  sourceId: string;
  targetId: string;
}

type MinimapClass = UMLDiagramMinimapClass;
type MinimapRelationship = UMLDiagramMinimapRelationship;

function minimapBoxH(c: MinimapClass): number {
  const nh = c.isAbstract || c.isInterface ? STEREO_H : NAME_H;
  return nh + 1 + c.attributes.length * ATTR_ROW + ATTR_PAD + ADD_BTN_H + 1 + METH_H;
}

export interface UMLDiagramMinimapProps {
  classes: MinimapClass[];
  relationships?: MinimapRelationship[];
  offsetX: number;
  offsetY: number;
  vx: number;
  vy: number;
  vscale: number;
  containerRef: React.RefObject<HTMLElement | null>;
  onViewportChange: (vx: number, vy: number) => void;
}

export const UMLDiagramMinimap: React.FC<UMLDiagramMinimapProps> = ({
  classes,
  relationships = [],
  offsetX,
  offsetY,
  vx,
  vy,
  vscale,
  containerRef,
  onViewportChange,
}) => {
  const mapRef = useRef<HTMLButtonElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      setContainerSize({ width: el.clientWidth, height: el.clientHeight });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef]);

  const classById = useMemo(() => new Map(classes.map(c => [c.id, c])), [classes]);

  // Viewport center in content (display) coordinates — the minimap always tracks
  // the current viewport center, same approach as the main canvas's overview map.
  const flowCX = containerSize.width > 0 ? (-vx + containerSize.width / 2) / vscale : 0;
  const flowCY = containerSize.height > 0 ? (-vy + containerSize.height / 2) / vscale : 0;
  const visW = containerSize.width / vscale;
  const visH = containerSize.height / vscale;

  // Scale so the current viewport fills ~80% of the minimap — clamped so extreme zooms stay sane.
  const mmScale = Math.max(MIN_MM_SCALE, Math.min(MAX_MM_SCALE, Math.min(
    (MAP_W * VIEWPORT_FILL_RATIO) / Math.max(visW, 50),
    (MAP_H * VIEWPORT_FILL_RATIO) / Math.max(visH, 50),
  )));

  const toX = useCallback((dx: number) => (dx - flowCX) * mmScale + MAP_W / 2, [flowCX, mmScale]);
  const toY = useCallback((dy: number) => (dy - flowCY) * mmScale + MAP_H / 2, [flowCY, mmScale]);

  const panToContentPoint = useCallback(
    (contentX: number, contentY: number) => {
      if (containerSize.width <= 0) return;
      const newVx = containerSize.width / 2 - contentX * vscale;
      const newVy = containerSize.height / 2 - contentY * vscale;
      onViewportChange(newVx, newVy);
    },
    [containerSize, vscale, onViewportChange],
  );

  // Snapshot the current map-to-content mapping at gesture start so a drag stays
  // predictable — otherwise panning would shift the map itself (flowCX/flowCY move
  // with vx/vy), and the content under the cursor would slide away mid-drag.
  const gestureRef = useRef<{ flowCX: number; flowCY: number; mmScale: number } | null>(null);

  const handlePointer = useCallback(
    (clientX: number, clientY: number) => {
      const mapEl = mapRef.current;
      const snap = gestureRef.current;
      if (!mapEl || !snap) return;
      const rect = mapEl.getBoundingClientRect();
      const mx = clientX - rect.left;
      const my = clientY - rect.top;
      const contentX = snap.flowCX + (mx - MAP_W / 2) / snap.mmScale;
      const contentY = snap.flowCY + (my - MAP_H / 2) / snap.mmScale;
      panToContentPoint(contentX, contentY);
    },
    [panToContentPoint],
  );

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    gestureRef.current = { flowCX, flowCY, mmScale };
    handlePointer(e.clientX, e.clientY);
    const onMove = (ev: MouseEvent) => handlePointer(ev.clientX, ev.clientY);
    const onUp = () => {
      gestureRef.current = null;
      globalThis.removeEventListener('mousemove', onMove);
      globalThis.removeEventListener('mouseup', onUp);
    };
    globalThis.addEventListener('mousemove', onMove);
    globalThis.addEventListener('mouseup', onUp);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    let dx = 0;
    let dy = 0;
    if (e.key === 'ArrowLeft') dx = 32;
    if (e.key === 'ArrowRight') dx = -32;
    if (e.key === 'ArrowUp') dy = 32;
    if (e.key === 'ArrowDown') dy = -32;
    if (!dx && !dy) return;
    e.preventDefault();
    onViewportChange(vx + dx, vy + dy);
  };

  if (classes.length === 0) return null;

  const viewportRect = containerSize.width > 0 && containerSize.height > 0
    ? {
        x: toX(flowCX - visW / 2),
        y: toY(flowCY - visH / 2),
        w: visW * mmScale,
        h: visH * mmScale,
      }
    : null;

  // Off-screen indicators: small dots at the map border pointing toward classes
  // that fall outside the minimap's current view.
  const indicators: { id: string; x: number; y: number }[] = [];
  classes.forEach(c => {
    const cx = toX(c.x + offsetX + BW / 2);
    const cy = toY(c.y + offsetY + minimapBoxH(c) / 2);
    const ind = edgeIndicatorPos(cx, cy, MAP_W, MAP_H, INDICATOR_MARGIN);
    if (ind) indicators.push({ id: c.id, ...ind });
  });

  return (
    <button
      ref={mapRef}
      type="button"
      aria-label="Diagram overview — click or drag to pan"
      onMouseDown={onMouseDown}
      onKeyDown={onKeyDown}
      style={{
        position: 'absolute',
        left: 10,
        bottom: 10,
        width: MAP_W,
        height: MAP_H,
        display: 'block',
        margin: 0,
        padding: 0,
        background: 'rgba(255,255,255,0.96)',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
        overflow: 'hidden',
        zIndex: 5,
        cursor: 'crosshair',
        pointerEvents: 'auto',
      }}
    >
      <svg width={MAP_W} height={MAP_H} style={{ display: 'block' }} aria-hidden="true">
        {/* Relationships — drawn under the class boxes, like the canvas's edges */}
        {relationships.map(rel => {
          const src = classById.get(rel.sourceId);
          const tgt = classById.get(rel.targetId);
          if (!src || !tgt) return null;
          return (
            <line
              key={rel.id}
              x1={toX(src.x + offsetX + BW / 2)} y1={toY(src.y + offsetY + minimapBoxH(src) / 2)}
              x2={toX(tgt.x + offsetX + BW / 2)} y2={toY(tgt.y + offsetY + minimapBoxH(tgt) / 2)}
              stroke="#94a3b8"
              strokeWidth={1}
            />
          );
        })}

        {/* Classes */}
        {classes.map(c => {
          const x = toX(c.x + offsetX);
          const y = toY(c.y + offsetY);
          const w = BW * mmScale;
          const h = minimapBoxH(c) * mmScale;
          if (x + w < 0 || x > MAP_W || y + h < 0 || y > MAP_H) return null;
          return (
            <rect
              key={c.id}
              x={x}
              y={y}
              width={Math.max(2, w)}
              height={Math.max(2, h)}
              fill="#e0f2fe"
              stroke="#0c436e"
              strokeWidth={0.75}
              rx={1}
            />
          );
        })}

        {/* Current viewport rectangle */}
        {viewportRect && (
          <rect
            x={viewportRect.x}
            y={viewportRect.y}
            width={viewportRect.w}
            height={viewportRect.h}
            fill="rgba(4, 148, 132, 0.12)"
            stroke="#049484"
            strokeWidth={1.25}
            rx={2}
            pointerEvents="none"
          />
        )}

        {/* Off-screen class indicators */}
        {indicators.map(ind => (
          <circle
            key={ind.id}
            cx={ind.x}
            cy={ind.y}
            r={3.5}
            fill="#049484"
            stroke="#ffffff"
            strokeWidth={1}
          />
        ))}
      </svg>
    </button>
  );
};
