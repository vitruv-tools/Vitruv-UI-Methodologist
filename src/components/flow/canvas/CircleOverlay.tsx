import React, { useCallback, useRef, useState } from 'react';
import { Circle } from '../../../hooks/useCircleContainment';

interface Viewport {
    x: number;
    y: number;
    zoom: number;
}

interface CircleOverlayProps {
    circle: Circle;
    viewport: Viewport;
    selected: boolean;
    onSelect: () => void;
    onResize: (newR: number) => void;
    onResizePreview: (newR: number) => void;
    onResizeEnd: () => void;
    containerRef: React.RefObject<HTMLDivElement | null>;
}

const HANDLE_ANGLE = Math.PI / 4;
const HANDLE_RADIUS = 10;
const MIN_RADIUS = 260;

export const CircleOverlay: React.FC<CircleOverlayProps> = ({
    circle,
    viewport,
    selected,
    onSelect,
    onResize,
    onResizePreview,
    onResizeEnd,
    containerRef,
}) => {
    // ALL hooks before any early return
    const [previewR, setPreviewR] = useState<number | null>(null);
    const isDragging = useRef(false);
    const dragStartR = useRef<number | null>(null);

    const getContainerOffset = useCallback(() => {
        if (!containerRef.current) return { left: 0, top: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        return { left: rect.left, top: rect.top };
    }, [containerRef]);

    const screenCx = circle.cx * viewport.zoom + viewport.x;
    const screenCy = circle.cy * viewport.zoom + viewport.y;
    const displayR = previewR ?? circle.r;
    const screenR = displayR * viewport.zoom;

    const handleScreenX = screenCx + Math.cos(HANDLE_ANGLE) * screenR;
    const handleScreenY = screenCy + Math.sin(HANDLE_ANGLE) * screenR;

    const handlePointerDownOnHandle = useCallback((e: React.PointerEvent) => {
        e.stopPropagation();
        isDragging.current = true;
        dragStartR.current = null;
        setPreviewR(circle.r);
        (e.target as Element).setPointerCapture(e.pointerId);
    }, [circle.r]);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!isDragging.current) return;
        e.stopPropagation();

        const { left, top } = getContainerOffset();
        const clientCx = screenCx + left;
        const clientCy = screenCy + top;

        const dx = e.clientX - clientCx;
        const dy = e.clientY - clientCy;
        const rawScreenR = Math.hypot(dx, dy);
        const rawFlowR = rawScreenR / viewport.zoom;

        if (dragStartR.current === null) {
            dragStartR.current ??= circle.r;
        }
        const startR = dragStartR.current;
        const delta = rawFlowR - startR;
        const resistance = 40;
        const exponent = 1.3;
        const sign = delta >= 0 ? 1 : -1;
        const smoothDelta = sign * (Math.pow(Math.abs(delta), exponent) / resistance);
        const newFlowR = Math.max(MIN_RADIUS, startR + smoothDelta);

        setPreviewR(newFlowR);
        onResizePreview(newFlowR);
    }, [screenCx, screenCy, viewport.zoom, getContainerOffset, onResizePreview, circle.r]);

    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        if (!isDragging.current) return;
        isDragging.current = false;
        (e.target as Element).releasePointerCapture(e.pointerId);
        if (previewR !== null) {
            onResize(previewR);
        }
        setPreviewR(null);
        onResizeEnd();
    }, [previewR, onResize, onResizeEnd]);

    // Early return AFTER all hooks
    if (circle.r === 0) return null;

    return (
        <svg
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 5,
                overflow: 'visible',
            }}
        >
            <defs>
                <filter id="circle-shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="2" stdDeviation="5" floodColor="#000000" floodOpacity="0.2" />
                </filter>
            </defs>

            {previewR !== null && (
                <circle
                    cx={screenCx}
                    cy={screenCy}
                    r={previewR * viewport.zoom}
                    fill="none"
                    stroke="#000000"
                    strokeWidth={2}
                    strokeDasharray="8 5"
                    opacity={0.35}
                />
            )}

            <circle
                cx={screenCx}
                cy={screenCy}
                r={screenR}
                fill="none"
                stroke="transparent"
                strokeWidth={20}
                style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); onSelect(); }}
            />

            <circle
                cx={screenCx}
                cy={screenCy}
                r={screenR}
                fill="none"
                stroke="#000000"
                strokeWidth={selected ? 3 : 2.5}
                filter="url(#circle-shadow)"
                style={{ pointerEvents: 'none' }}
            />

            {selected && (
                <g
                    style={{ pointerEvents: 'all', cursor: 'nwse-resize' }}
                    onPointerDown={handlePointerDownOnHandle}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                >
                    <circle cx={handleScreenX} cy={handleScreenY} r={HANDLE_RADIUS + 3} fill="rgba(0,0,0,0.12)" />
                    <circle cx={handleScreenX} cy={handleScreenY} r={HANDLE_RADIUS} fill="white" stroke="#000000" strokeWidth={1.5} />
                    <text
                        x={handleScreenX}
                        y={handleScreenY}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={10}
                        style={{ userSelect: 'none', pointerEvents: 'none' }}
                    >
                        ⤡
                    </text>
                </g>
            )}
        </svg>
    );
};