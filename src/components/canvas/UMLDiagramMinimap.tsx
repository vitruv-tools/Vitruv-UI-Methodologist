import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { computeUmlFocusRect } from '../../utils/umlClassLayout';

const BW = 190;
const NAME_H = 36;
const STEREO_H = 54;
const ATTR_ROW = 22;
const ATTR_PAD = 10;
const ADD_BTN_H = 22;
const METH_H = 26;

const MAP_W = 132;
const MAP_H = 92;

export interface UMLDiagramMinimapClass {
  id: string;
  x: number;
  y: number;
  isAbstract: boolean;
  isInterface: boolean;
  attributes: ReadonlyArray<unknown>;
}

type MinimapClass = UMLDiagramMinimapClass;

function minimapBoxH(c: MinimapClass): number {
  const nh = c.isAbstract || c.isInterface ? STEREO_H : NAME_H;
  return nh + 1 + c.attributes.length * ATTR_ROW + ATTR_PAD + ADD_BTN_H + 1 + METH_H;
}

export interface UMLDiagramMinimapProps {
  classes: MinimapClass[];
  offsetX: number;
  offsetY: number;
  vx: number;
  vy: number;
  vscale: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onViewportChange: (vx: number, vy: number) => void;
}

export const UMLDiagramMinimap: React.FC<UMLDiagramMinimapProps> = ({
  classes,
  offsetX,
  offsetY,
  vx,
  vy,
  vscale,
  containerRef,
  onViewportChange,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
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

  const bounds = useMemo(() => {
    if (classes.length === 0) {
      return { x0: 0, y0: 0, w: 1, h: 1 };
    }
    const focus = computeUmlFocusRect(classes, {
      boxWidth: BW,
      boxHeight: c => minimapBoxH(c),
      padding: 12,
      focusRatio: 0.92,
    });
    return {
      x0: focus.minX + offsetX,
      y0: focus.minY + offsetY,
      w: Math.max(focus.maxX - focus.minX, 1),
      h: Math.max(focus.maxY - focus.minY, 1),
    };
  }, [classes, offsetX, offsetY]);

  const mapScale = useMemo(
    () => Math.min(MAP_W / bounds.w, MAP_H / bounds.h),
    [bounds.w, bounds.h],
  );

  const toMap = useCallback(
    (cx: number, cy: number) => ({
      x: (cx - bounds.x0) * mapScale,
      y: (cy - bounds.y0) * mapScale,
    }),
    [bounds.x0, bounds.y0, mapScale],
  );

  const viewportRect = useMemo(() => {
    if (containerSize.width <= 0 || containerSize.height <= 0) return null;
    const viewL = -vx / vscale;
    const viewT = -vy / vscale;
    const viewW = containerSize.width / vscale;
    const viewH = containerSize.height / vscale;
    const tl = toMap(viewL, viewT);
    const br = toMap(viewL + viewW, viewT + viewH);
    return {
      x: Math.max(0, tl.x),
      y: Math.max(0, tl.y),
      w: Math.min(MAP_W, Math.max(4, br.x - tl.x)),
      h: Math.min(MAP_H, Math.max(4, br.y - tl.y)),
    };
  }, [containerSize, vx, vy, vscale, toMap]);

  const panToContentPoint = useCallback(
    (contentX: number, contentY: number) => {
      if (containerSize.width <= 0) return;
      const newVx = containerSize.width / 2 - contentX * vscale;
      const newVy = containerSize.height / 2 - contentY * vscale;
      onViewportChange(newVx, newVy);
    },
    [containerSize, vscale, onViewportChange],
  );

  const handlePointer = useCallback(
    (clientX: number, clientY: number) => {
      const mapEl = mapRef.current;
      if (!mapEl) return;
      const rect = mapEl.getBoundingClientRect();
      const mx = clientX - rect.left;
      const my = clientY - rect.top;
      const contentX = bounds.x0 + mx / mapScale;
      const contentY = bounds.y0 + my / mapScale;
      panToContentPoint(contentX, contentY);
    },
    [bounds, mapScale, panToContentPoint],
  );

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handlePointer(e.clientX, e.clientY);
    const onMove = (ev: MouseEvent) => handlePointer(ev.clientX, ev.clientY);
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  if (classes.length === 0) return null;

  return (
    <div
      ref={mapRef}
      role="presentation"
      onMouseDown={onMouseDown}
      style={{
        position: 'absolute',
        left: 10,
        bottom: 10,
        width: MAP_W,
        height: MAP_H,
        background: 'rgba(255,255,255,0.96)',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
        overflow: 'hidden',
        zIndex: 5,
        cursor: 'crosshair',
        pointerEvents: 'auto',
      }}
      title="Diagram overview — click or drag to pan"
    >
      <svg width={MAP_W} height={MAP_H} style={{ display: 'block' }}>
        {classes.map(c => {
          const left = c.x + offsetX;
          const top = c.y + offsetY;
          const h = minimapBoxH(c);
          const p = toMap(left, top);
          const pw = BW * mapScale;
          const ph = h * mapScale;
          return (
            <rect
              key={c.id}
              x={p.x}
              y={p.y}
              width={Math.max(2, pw)}
              height={Math.max(2, ph)}
              fill="#e0f2fe"
              stroke="#0c436e"
              strokeWidth={0.75}
              rx={1}
            />
          );
        })}
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
      </svg>
    </div>
  );
};
