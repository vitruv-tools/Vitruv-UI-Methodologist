import React, { useState } from 'react';
import ReactDOM from 'react-dom';

interface ViewTypeArrowProps {
    id: string;
    bubbleCx: number;
    bubbleCy: number;
    bubbleR: number;
    nodeCx: number;
    nodeCy: number;
    nodeW: number;
    nodeH: number;
    editable: boolean;
    onDelete: (id: string) => void;
}

function circleEdgePoint(
    cx: number, cy: number, r: number,
    tx: number, ty: number
): { x: number; y: number } {
    const dx = tx - cx;
    const dy = ty - cy;
    const dist = Math.hypot(dx, dy) || 1;
    return { x: cx + (dx / dist) * r, y: cy + (dy / dist) * r };
}

function rectEdgePoint(
    x1: number, y1: number,
    x2: number, y2: number,
    rx: number, ry: number,
    rw: number, rh: number
): { x: number; y: number } {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const halfW = rw / 2;
    const halfH = rh / 2;
    const candidates: Array<{ x: number; y: number }> = [];

    if (dx !== 0) {
        const t = (rx + halfW - x1) / dx;
        const y = y1 + t * dy;
        if (t > 0 && Math.abs(y - ry) <= halfH) candidates.push({ x: rx + halfW, y });
    }
    if (dx !== 0) {
        const t = (rx - halfW - x1) / dx;
        const y = y1 + t * dy;
        if (t > 0 && Math.abs(y - ry) <= halfH) candidates.push({ x: rx - halfW, y });
    }
    if (dy !== 0) {
        const t = (ry + halfH - y1) / dy;
        const x = x1 + t * dx;
        if (t > 0 && Math.abs(x - rx) <= halfW) candidates.push({ x, y: ry + halfH });
    }
    if (dy !== 0) {
        const t = (ry - halfH - y1) / dy;
        const x = x1 + t * dx;
        if (t > 0 && Math.abs(x - rx) <= halfW) candidates.push({ x, y: ry - halfH });
    }

    if (candidates.length === 0) return { x: rx, y: ry };
    return candidates.reduce(
        (best, c) =>
            Math.hypot(c.x - x1, c.y - y1) < Math.hypot(best.x - x1, best.y - y1) ? c : best,
        candidates[0]
    );
}

function arrowheadPoints(
    fromX: number, fromY: number,
    tipX: number, tipY: number,
    size: number
): string {
    const dx = tipX - fromX;
    const dy = tipY - fromY;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist;
    const uy = dy / dist;
    const px = -uy;
    const py = ux;

    const base1X = tipX - ux * size + px * (size / 2);
    const base1Y = tipY - uy * size + py * (size / 2);
    const base2X = tipX - ux * size - px * (size / 2);
    const base2Y = tipY - uy * size - py * (size / 2);

    return `${tipX},${tipY} ${base1X},${base1Y} ${base2X},${base2Y}`;
}

function shorten(
    fx: number, fy: number,
    tx: number, ty: number,
    amount: number
): { x: number; y: number } {
    const dx = tx - fx;
    const dy = ty - fy;
    const dist = Math.hypot(dx, dy) || 1;
    return { x: tx - (dx / dist) * amount, y: ty - (dy / dist) * amount };
}

const ARROW_SIZE = 8;

export const ViewTypeArrow: React.FC<ViewTypeArrowProps> = ({
    id,
    bubbleCx, bubbleCy, bubbleR,
    nodeCx, nodeCy, nodeW, nodeH,
    editable,
    onDelete,
}) => {
    const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

    const rawStart = circleEdgePoint(bubbleCx, bubbleCy, bubbleR, nodeCx, nodeCy);
    const rawEnd = rectEdgePoint(bubbleCx, bubbleCy, nodeCx, nodeCy, nodeCx, nodeCy, nodeW, nodeH);

    // Bubble side always shortened (always has arrowhead)
    const start = shorten(rawEnd.x, rawEnd.y, rawStart.x, rawStart.y, ARROW_SIZE);
    // Node side only shortened if editable (has arrowhead)
    const end = editable
        ? shorten(rawStart.x, rawStart.y, rawEnd.x, rawEnd.y, ARROW_SIZE)
        : rawEnd;

    const startArrow = arrowheadPoints(end.x, end.y, rawStart.x, rawStart.y, ARROW_SIZE);
    const endArrow = arrowheadPoints(start.x, start.y, rawEnd.x, rawEnd.y, ARROW_SIZE);

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setMenu({ x: e.clientX, y: e.clientY });
    };

    return (
        <>
            {/* Wide invisible hitbox */}
            <line
                x1={rawStart.x} y1={rawStart.y}
                x2={rawEnd.x} y2={rawEnd.y}
                stroke="transparent"
                strokeWidth={14}
                style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                onClick={handleClick}
            />
            {/* Shaft */}
            <line
                x1={start.x} y1={start.y}
                x2={end.x} y2={end.y}
                stroke="#000000"
                strokeWidth={1.5}
                style={{ pointerEvents: 'none' }}
            />
            {/* Arrowhead at bubble end — always */}
            <polygon
                points={startArrow}
                fill="#000000"
                style={{ pointerEvents: 'none' }}
            />
            {/* Arrowhead at node end — only if editable */}
            {editable && (
                <polygon
                    points={endArrow}
                    fill="#000000"
                    style={{ pointerEvents: 'none' }}
                />
            )}

            {menu && ReactDOM.createPortal(
                <>
                    <div
                        style={{ position: 'fixed', inset: 0, zIndex: 999 }}
                        onClick={() => setMenu(null)}
                    />
                    <div
                        style={{
                            position: 'fixed',
                            left: menu.x,
                            top: menu.y,
                            zIndex: 1000,
                            background: 'white',
                            border: '1px solid #e5e7eb',
                            borderRadius: 10,
                            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                            padding: '8px',
                            minWidth: 150,
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ fontSize: 12, color: '#6b7280', padding: '4px 8px' }}>
                            ViewType connection
                        </div>
                        <button
                            onClick={() => { onDelete(id); setMenu(null); }}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: '#dc2626',
                                fontSize: 13,
                                fontWeight: 500,
                                padding: '6px 8px',
                                borderRadius: 6,
                                cursor: 'pointer',
                                textAlign: 'left',
                                width: '100%',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                        >
                            Delete connection
                        </button>
                    </div>
                </>,
                document.body
            )}
        </>
    );
};