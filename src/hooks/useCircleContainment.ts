import { useState, useEffect } from 'react';
import { Node } from 'reactflow';

export interface Circle {
    cx: number;
    cy: number;
    r: number;
}

const NODE_W = 280;
const NODE_H = 180;
const NODE_HALF_DIAGONAL = Math.hypot(NODE_W / 2, NODE_H / 2);
const SPAWN_PADDING = 80;
const MIN_RADIUS = 260;
const DEFAULT_NODE_SIZE = { width: NODE_W, height: NODE_H };


export function computeInitialCircle(nodes: Pick<Node, 'position'>[]): Circle {
    if (nodes.length === 0) return { cx: 0, cy: 0, r: MIN_RADIUS };

    let sumX = 0, sumY = 0;
    nodes.forEach(n => {
        sumX += n.position.x + NODE_W / 2;
        sumY += n.position.y + NODE_H / 2;
    });
    const cx = sumX / nodes.length;
    const cy = sumY / nodes.length;

    let maxDist = 0;
    nodes.forEach(n => {
        const nodeCenterX = n.position.x + NODE_W / 2;
        const nodeCenterY = n.position.y + NODE_H / 2;
        const distToCenter = Math.hypot(nodeCenterX - cx, nodeCenterY - cy);
        maxDist = Math.max(maxDist, distToCenter + NODE_HALF_DIAGONAL);
    });

    return {
        cx,
        cy,
        r: Math.max(MIN_RADIUS, maxDist + SPAWN_PADDING),
    };
}

export function clampToCircle(
    position: { x: number; y: number },
    circle: Circle,
    nodeSize: { width: number; height: number } = DEFAULT_NODE_SIZE
): { x: number; y: number } {
    if (circle.r === 0) return position;

    // Check all 4 corners — find the one farthest outside the circle
    const corners = [
        { x: position.x, y: position.y },
        { x: position.x + nodeSize.width, y: position.y },
        { x: position.x, y: position.y + nodeSize.height },
        { x: position.x + nodeSize.width, y: position.y + nodeSize.height },
    ];

    // Find the corner with maximum distance from circle center
    let maxDist = 0;
    let worstCorner = corners[0];
    for (const corner of corners) {
        const dx = corner.x - circle.cx;
        const dy = corner.y - circle.cy;
        const dist = Math.hypot(dx, dy);
        if (dist > maxDist) {
            maxDist = dist;
            worstCorner = corner;
        }
    }

    // If the farthest corner is inside the circle, no clamping needed
    if (maxDist <= circle.r) return position;

    // Push the node so the worst corner lands exactly on the rim
    // Direction = from circle center toward the worst corner
    const dx = worstCorner.x - circle.cx;
    const dy = worstCorner.y - circle.cy;
    const scale = circle.r / maxDist;

    // The worst corner should be at (cx + dx*scale, cy + dy*scale)
    // So the node top-left = that point minus the corner's offset within the node
    const cornerOffsetX = worstCorner.x - position.x;
    const cornerOffsetY = worstCorner.y - position.y;

    return {
        x: circle.cx + dx * scale - cornerOffsetX,
        y: circle.cy + dy * scale - cornerOffsetY,
    };
}


export function clampAllNodesToCircle(
    nodes: Node[],
    circle: Circle
): Map<string, { x: number; y: number }> {
    const result = new Map<string, { x: number; y: number }>();
    nodes.forEach(n => {
        const clamped = clampToCircle(n.position, circle);
        if (clamped.x !== n.position.x || clamped.y !== n.position.y) {
            result.set(n.id, clamped);
        }
    });
    return result;
}

/**
 * Hook: manages circle as proper React state so changes trigger re-renders.
 * Recomputes center+radius only when ecoreFile node COUNT increases.
 */
export function useCircleContainment(nodes: Node[]): [Circle, React.Dispatch<React.SetStateAction<Circle>>] {
    const ecoreNodes = nodes.filter(n => n.type === 'ecoreFile');

    const [circle, setCircle] = useState<Circle>(() => computeInitialCircle(ecoreNodes));
    const [prevCount, setPrevCount] = useState(ecoreNodes.length);

    useEffect(() => {
        if (ecoreNodes.length > prevCount) {
            setCircle(computeInitialCircle(ecoreNodes));
        }
        setPrevCount(ecoreNodes.length);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ecoreNodes.length]);

    return [circle, setCircle];
}