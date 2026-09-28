import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Circle } from '../../../hooks/useCircleContainment';
import { ViewType, ViewTypeScope } from '../../../hooks/useViewTypes';
import { Node } from 'reactflow';
import { ViewTypeBubble, OUTER_R } from './ViewTypeBubble';
import { ViewTypeContextMenu } from './ViewTypeContextMenu';
import { ViewTypeDeletionMenu } from './ViewTypeDeletionMenu';
import { ViewTypeArrow } from './ViewTypeArrow';

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
    viewTypes: ViewType[];
    ecoreNodes: Node[];
    onAddViewType: (label: string, scope: ViewTypeScope, linkedNodeIds: string[], angle: number, editable: boolean) => void;
    onDeleteViewType: (id: string) => void;
    onUpdateViewTypeAngle: (id: string, angle: number) => void;
    onUnlinkNode: (viewTypeId: string, nodeId: string) => void;
}

const HANDLE_ANGLE = Math.PI / 4;
const HANDLE_RADIUS = 10;
const MIN_RADIUS = 260;

const computeBestAngle = (existingAngles: number[]): number => {
    if (existingAngles.length === 0) return -Math.PI / 2;

    const normalized = existingAngles
        .map(a => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI))
        .sort((a, b) => a - b);

    let maxGap = 0;
    let bestAngle = 0;

    for (let i = 0; i < normalized.length; i++) {
        const current = normalized[i];
        const next = i === normalized.length - 1
            ? normalized[0] + 2 * Math.PI
            : normalized[i + 1];
        const gap = next - current;
        if (gap > maxGap) {
            maxGap = gap;
            bestAngle = current + gap / 2;
        }
    }

    // Normalize back to [-π, π) like atan2
    if (bestAngle > Math.PI) bestAngle -= 2 * Math.PI;
    return bestAngle;
};

// Preferred add-point slots: top, right, bottom, left.
const CARDINAL_ANGLES = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
const ADD_POINT_OCCUPIED_THRESHOLD = 0.2; // radians — how close a VT must be to "claim" a cardinal slot
const ADD_POINT_RADIUS = 7;
const ADD_POINT_HIT_RADIUS = 14;

const angularDistance = (a: number, b: number): number => {
    const diff = Math.abs(a - b) % (2 * Math.PI);
    return diff > Math.PI ? 2 * Math.PI - diff : diff;
};

// Hover add-points: one per free cardinal slot; once a cardinal slot is occupied
// by a VT bubble, its add-point relocates to the next best gap — same algorithm
// used to place new VT bubbles — so add-points never overlap existing bubbles.
const computeAddPointAngles = (existingAngles: number[]): number[] => {
    const occupied = [...existingAngles];
    const addPoints: number[] = [];

    for (const cardinal of CARDINAL_ANGLES) {
        const isFree = occupied.every(a => angularDistance(a, cardinal) > ADD_POINT_OCCUPIED_THRESHOLD);
        if (isFree) {
            addPoints.push(cardinal);
            occupied.push(cardinal);
        }
    }

    const missing = CARDINAL_ANGLES.length - addPoints.length;
    for (let i = 0; i < missing; i++) {
        const angle = computeBestAngle(occupied);
        addPoints.push(angle);
        occupied.push(angle);
    }

    return addPoints;
};

export const CircleOverlay: React.FC<CircleOverlayProps> = ({
    circle,
    viewport,
    selected,
    onSelect,
    onResize,
    onResizePreview,
    onResizeEnd,
    containerRef,
    viewTypes,
    ecoreNodes,
    onAddViewType,
    onDeleteViewType,
    onUnlinkNode,
    onUpdateViewTypeAngle,
}) => {
    const [previewR, setPreviewR] = useState<number | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const [pendingAngle, setPendingAngle] = useState<number | null>(null);
    const [isHovered, setIsHovered] = useState(false);
    const [deletionMenu, setDeletionMenu] = useState<{
        x: number; y: number; id: string; label: string;
    } | null>(null);

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

    const getBubbleScreenPos = useCallback((angle: number) => ({
        x: screenCx + Math.cos(angle) * screenR,
        y: screenCy + Math.sin(angle) * screenR,
    }), [screenCx, screenCy, screenR]);

    const getNodeScreenPos = useCallback((node: Node) => ({
        x: (node.position.x + (node.width ?? 280) / 2) * viewport.zoom + viewport.x,
        y: (node.position.y + (node.height ?? 180) / 2) * viewport.zoom + viewport.y,
    }), [viewport]);

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
        const dx = e.clientX - (screenCx + left);
        const dy = e.clientY - (screenCy + top);
        const rawFlowR = Math.hypot(dx, dy) / viewport.zoom;
        dragStartR.current ??= circle.r;
        const startR = dragStartR.current;
        const delta = rawFlowR - startR;
        const sign = delta >= 0 ? 1 : -1;
        const smoothDelta = sign * (Math.pow(Math.abs(delta), 1.3) / 40);
        const newFlowR = Math.max(MIN_RADIUS, startR + smoothDelta);
        setPreviewR(newFlowR);
        onResizePreview(newFlowR);
    }, [screenCx, screenCy, viewport.zoom, getContainerOffset, onResizePreview, circle.r]);

    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        if (!isDragging.current) return;
        isDragging.current = false;
        (e.target as Element).releasePointerCapture(e.pointerId);
        if (previewR !== null) onResize(previewR);
        setPreviewR(null);
        onResizeEnd();
    }, [previewR, onResize, onResizeEnd]);

    const handleBubbleDrag = useCallback((id: string, e: React.PointerEvent) => {
        const { left, top } = getContainerOffset();
        const angle = Math.atan2(
            (e.clientY - top) - screenCy,
            (e.clientX - left) - screenCx
        );
        onUpdateViewTypeAngle(id, angle);
    }, [screenCx, screenCy, getContainerOffset, onUpdateViewTypeAngle]);

    const handleBubbleClick = useCallback((id: string, svgX: number, svgY: number, label: string) => {
        const { left, top } = getContainerOffset();
        setDeletionMenu({ x: svgX + left, y: svgY + top, id, label });
    }, [getContainerOffset]);

    const handleAddViewType = useCallback((label: string, scope: ViewTypeScope, linkedNodeIds: string[], editable: boolean) => {
        const angle = pendingAngle ?? computeBestAngle(viewTypes.map(vt => vt.angle));
        onAddViewType(label, scope, linkedNodeIds, angle, editable);
        setPendingAngle(null);
    }, [pendingAngle, viewTypes, onAddViewType]);

    const handleAddPointClick = useCallback((angle: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setPendingAngle(angle);
        setContextMenu({ x: e.clientX, y: e.clientY });
    }, []);

    const addPointAngles = useMemo(
        () => computeAddPointAngles(viewTypes.map(vt => vt.angle)),
        [viewTypes]
    );

    if (circle.r === 0) return null;

    return (
        <>
            <svg
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    zIndex: 5,
                    overflow: 'visible',
                }}
                pointerEvents="none"
            >
                <defs>
                    <filter id="circle-shadow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="2" stdDeviation="5" floodColor="#000000" floodOpacity="0.2" />
                    </filter>
                    <marker
                        id="vt-arrow-closed"
                        viewBox="0 0 10 10"
                        refX="9"
                        refY="5"
                        markerUnits="userSpaceOnUse"
                        markerWidth={8}
                        markerHeight={8}
                        orient="auto-start-reverse"
                    >
                        <path d="M0 0L10 5L0 10Z" fill="var(--v-uml-circle, #0c436e)" />
                    </marker>
                </defs>

                {/* Preview */}
                {previewR !== null && (
                    <circle
                        cx={screenCx} cy={screenCy}
                        r={previewR * viewport.zoom}
                        fill="none" stroke="var(--v-uml-circle, #0c436e)" strokeWidth={2.5}
                        strokeDasharray="8 5" opacity={0.35}
                        pointerEvents="none"
                    />
                )}

                {/* Arrows */}
                {viewTypes.map(vt => {
                    const bubblePos = getBubbleScreenPos(vt.angle);
                    return vt.linkedNodeIds.map(nodeId => {
                        const node = ecoreNodes.find(n => n.id === nodeId);
                        if (!node) return null;
                        const nodePos = getNodeScreenPos(node);
                        return (
                            <ViewTypeArrow
                                key={`${vt.id}::${nodeId}`}
                                id={`${vt.id}::${nodeId}`}
                                bubbleCx={bubblePos.x}
                                bubbleCy={bubblePos.y}
                                bubbleR={OUTER_R}
                                nodeCx={nodePos.x}
                                nodeCy={nodePos.y}
                                nodeW={(node.width ?? 280) * viewport.zoom}
                                nodeH={(node.height ?? 180) * viewport.zoom}
                                editable={vt.editable}
                                onDelete={() => onDeleteViewType(vt.id)}
                            />
                        );
                    });
                })}

                {/* Visible circle — no pointer events */}
                <circle
                    cx={screenCx} cy={screenCy} r={screenR}
                    fill="none" stroke="var(--v-uml-circle, #0c436e)"
                    strokeWidth={selected ? 3.5 : 2.5}
                    filter="url(#circle-shadow)"
                    pointerEvents="none"
                />

                {/* Circle hitbox + hover add-points */}
                <g
                    pointerEvents="all"
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                >
                    <circle
                        cx={screenCx} cy={screenCy} r={screenR}
                        fill="none" stroke="transparent" strokeWidth={20}
                        pointerEvents="stroke"
                        style={{ cursor: 'pointer' }}
                        onClick={(e) => { e.stopPropagation(); onSelect(); }}
                    />

                    {isHovered && !contextMenu && addPointAngles.map((angle) => {
                        const pos = getBubbleScreenPos(angle);
                        return (
                            <g
                                key={`add-point-${angle.toFixed(5)}`}
                                style={{ cursor: 'pointer' }}
                                onClick={(e) => handleAddPointClick(angle, e)}
                            >
                                <circle cx={pos.x} cy={pos.y} r={ADD_POINT_HIT_RADIUS} fill="transparent" />
                                <circle cx={pos.x} cy={pos.y} r={ADD_POINT_RADIUS} fill="#ef4444" stroke="none" />
                            </g>
                        );
                    })}
                </g>

                {/* Bubbles */}
                {viewTypes.map(vt => {
                    const pos = getBubbleScreenPos(vt.angle);
                    return (
                        <ViewTypeBubble
                            key={vt.id}
                            id={vt.id}
                            label={vt.label}
                            scope={vt.scope}
                            cx={pos.x}
                            cy={pos.y}
                            onDragStart={() => { }}
                            onDrag={handleBubbleDrag}
                            onDragEnd={() => { }}
                            onClick={(id) => handleBubbleClick(id, pos.x, pos.y, vt.label)}
                        />
                    );
                })}

                {/* Resize handle */}
                {selected && (
                    <g
                        pointerEvents="all"
                        style={{ cursor: 'nwse-resize' }}
                        onPointerDown={handlePointerDownOnHandle}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                    >
                        <circle cx={handleScreenX} cy={handleScreenY} r={HANDLE_RADIUS + 3} fill="rgba(0,0,0,0.12)" />
                        <circle cx={handleScreenX} cy={handleScreenY} r={HANDLE_RADIUS} fill="white" stroke="var(--v-uml-circle, #0c436e)" strokeWidth={1.5} />
                        <text
                            x={handleScreenX} y={handleScreenY}
                            textAnchor="middle" dominantBaseline="central"
                            fontSize={10}
                            pointerEvents="none"
                            style={{ userSelect: 'none' }}
                        >
                            ⤡
                        </text>
                    </g>
                )}
            </svg>

            {contextMenu && (
                <ViewTypeContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    ecoreNodes={ecoreNodes}
                    onAdd={handleAddViewType}
                    onClose={() => { setContextMenu(null); setPendingAngle(null); }}
                />
            )}

            {deletionMenu && (
                <ViewTypeDeletionMenu
                    x={deletionMenu.x}
                    y={deletionMenu.y}
                    label={deletionMenu.label}
                    onDelete={() => onDeleteViewType(deletionMenu.id)}
                    onClose={() => setDeletionMenu(null)}
                />
            )}
        </>
    );
};