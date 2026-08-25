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

function tryEdge(
    t: number,
    fixed: number,
    perp: number,
    halfPerp: number,
    makePoint: (perp: number) => { x: number; y: number }
): { x: number; y: number } | null {
    if (t <= 0 || Math.abs(perp - fixed) > halfPerp) return null;
    return makePoint(perp);
}

interface RectEdgePointParams {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    rx: number;
    ry: number;
    rw: number;
    rh: number;
}

function rectEdgePoint({ x1, y1, x2, y2, rx, ry, rw, rh }: RectEdgePointParams): { x: number; y: number } {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const halfW = rw / 2;
    const halfH = rh / 2;
    const candidates: Array<{ x: number; y: number }> = [];

    if (dx !== 0) {
        const yAt = (ex: number) => y1 + ((ex - x1) / dx) * dy;
        const cR = tryEdge((rx + halfW - x1) / dx, ry, yAt(rx + halfW), halfH, y => ({ x: rx + halfW, y }));
        const cL = tryEdge((rx - halfW - x1) / dx, ry, yAt(rx - halfW), halfH, y => ({ x: rx - halfW, y }));
        if (cR) candidates.push(cR);
        if (cL) candidates.push(cL);
    }

    if (dy !== 0) {
        const xAt = (ey: number) => x1 + ((ey - y1) / dy) * dx;
        const cB = tryEdge((ry + halfH - y1) / dy, rx, xAt(ry + halfH), halfW, x => ({ x, y: ry + halfH }));
        const cT = tryEdge((ry - halfH - y1) / dy, rx, xAt(ry - halfH), halfW, x => ({ x, y: ry - halfH }));
        if (cB) candidates.push(cB);
        if (cT) candidates.push(cT);
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

const BACKDROP_STYLE: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 999,
    background: 'transparent',
    border: 'none',
    cursor: 'default',
    padding: 0,
};

const MENU_STYLE: React.CSSProperties = {
    position: 'fixed',
    zIndex: 1000,
    background: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
    padding: '8px',
    minWidth: 150,
};

const MENU_LABEL_STYLE: React.CSSProperties = {
    fontSize: 12,
    color: '#6b7280',
    padding: '4px 8px',
};

const DELETE_BUTTON_STYLE: React.CSSProperties = {
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
};

export const ViewTypeArrow: React.FC<ViewTypeArrowProps> = ({
    id,
    bubbleCx, bubbleCy, bubbleR,
    nodeCx, nodeCy, nodeW, nodeH,
    editable,
    onDelete,
}) => {
    const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

    const rawStart = circleEdgePoint(bubbleCx, bubbleCy, bubbleR, nodeCx, nodeCy);
    const rawEnd = rectEdgePoint({
        x1: bubbleCx, y1: bubbleCy,
        x2: nodeCx, y2: nodeCy,
        rx: nodeCx, ry: nodeCy, rw: nodeW, rh: nodeH,
    });

    const start = shorten(rawEnd.x, rawEnd.y, rawStart.x, rawStart.y, ARROW_SIZE);
    const end = editable
        ? shorten(rawStart.x, rawStart.y, rawEnd.x, rawEnd.y, ARROW_SIZE)
        : rawEnd;

    const startArrow = arrowheadPoints(end.x, end.y, rawStart.x, rawStart.y, ARROW_SIZE);
    const endArrow = arrowheadPoints(start.x, start.y, rawEnd.x, rawEnd.y, ARROW_SIZE);

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setMenu({ x: e.clientX, y: e.clientY });
    };

    const closeMenu = () => setMenu(null);

    const handleBackdropKey = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') closeMenu();
    };

    return (
        <>
            <line
                x1={rawStart.x} y1={rawStart.y}
                x2={rawEnd.x} y2={rawEnd.y}
                stroke="transparent"
                strokeWidth={14}
                style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                onClick={handleClick}
            />
            <line
                x1={start.x} y1={start.y}
                x2={end.x} y2={end.y}
                stroke="var(--v-uml-circle, #0c436e)"
                strokeWidth={1.5}
                style={{ pointerEvents: 'none' }}
            />
            <polygon
                points={startArrow}
                fill="var(--v-uml-circle, #0c436e)"
                style={{ pointerEvents: 'none' }}
            />
            {editable && (
                <polygon
                    points={endArrow}
                    fill="var(--v-uml-circle, #0c436e)"
                    style={{ pointerEvents: 'none' }}
                />
            )}

            {menu && ReactDOM.createPortal(
                <>
                    <button
                        type="button"
                        aria-label="Close menu"
                        style={BACKDROP_STYLE}
                        onClick={closeMenu}
                        onKeyDown={handleBackdropKey}
                    />
                    <dialog
                        open
                        style={{ ...MENU_STYLE, left: menu.x, top: menu.y }}
                    >
                        <div style={MENU_LABEL_STYLE}>
                            ViewType connection
                        </div>
                        <button
                            type="button"
                            style={DELETE_BUTTON_STYLE}
                            onClick={() => { onDelete(id); closeMenu(); }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                        >
                            Delete connection
                        </button>
                    </dialog>
                </>,
                document.body
            )}
        </>
    );
};