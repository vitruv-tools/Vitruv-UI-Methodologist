import React, { useRef } from 'react';
import { ViewTypeScope } from '../../../hooks/useViewTypes';

interface ViewTypeBubbleProps {
    id: string;
    label: string;
    scope: ViewTypeScope;
    cx: number;
    cy: number;
    onDragStart: (id: string) => void;
    onDrag: (id: string, e: React.PointerEvent) => void;
    onDragEnd: (id: string) => void;
    onClick: (id: string) => void;
}

export const OUTER_R = 28;

const SCOPE_COLOR: Record<ViewTypeScope, string> = {
    single: '#E8A838',
    multi: '#A81C1C',
};

const RING_WIDTH = 2.5;
const GAP = 3;

export const ViewTypeBubble: React.FC<ViewTypeBubbleProps> = ({
    id, label, scope, cx, cy,
    onDragStart, onDrag, onDragEnd, onClick,
}) => {
    const isDragging = useRef(false);
    const didDrag = useRef(false);
    const groupRef = useRef<SVGGElement>(null);
    const color = SCOPE_COLOR[scope];

    const handlePointerDown = (e: React.PointerEvent) => {
        e.stopPropagation();
        isDragging.current = true;
        didDrag.current = false;
        groupRef.current?.setPointerCapture(e.pointerId);
        onDragStart(id);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging.current) return;
        e.stopPropagation();
        didDrag.current = true;
        onDrag(id, e);
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (!isDragging.current) return;
        isDragging.current = false;
        groupRef.current?.releasePointerCapture(e.pointerId);
        onDragEnd(id);
        if (!didDrag.current) onClick(id);
    };

    const innerFillR = scope === 'single'
        ? OUTER_R - RING_WIDTH
        : OUTER_R - RING_WIDTH - GAP - RING_WIDTH;

    const gradientId = `vt-gradient-${id}`;
    const lightFill = scope === 'single' ? '#FEFCE8' : '#FCE8E8';

    return (
        <g
            ref={groupRef}
            pointerEvents="all"
            style={{ cursor: isDragging.current ? 'grabbing' : 'grab' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
        >
            <defs>
                <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#FFFFFF" />
                    <stop offset="100%" stopColor={lightFill} />
                </linearGradient>
            </defs>

            {/* Invisible hit area larger than the visible bubble for easier grabbing */}
            <circle cx={cx} cy={cy} r={OUTER_R + 8} fill="transparent" />

            {/* White backing */}
            <circle cx={cx} cy={cy} r={innerFillR} fill="white" />

            {/* Outer colored ring */}
            <circle cx={cx} cy={cy} r={OUTER_R} fill={color} />

            {scope === 'multi' && (
                <circle cx={cx} cy={cy} r={OUTER_R - RING_WIDTH} fill="white" />
            )}
            {scope === 'multi' && (
                <circle cx={cx} cy={cy} r={OUTER_R - RING_WIDTH - GAP} fill={color} />
            )}

            {/* Gradient fill in center */}
            <circle cx={cx} cy={cy} r={innerFillR} fill={`url(#${gradientId})`} />

            {/* Label */}
            <text
                x={cx} y={cy}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={11}
                fontWeight={600}
                fill="#1a1a1a"
                style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
                {label}
            </text>
        </g>
    );
};