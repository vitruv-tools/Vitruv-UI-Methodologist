import { computeInitialCircle, clampToCircle, clampAllNodesToCircle } from '../../hooks/useCircleContainment';

const nodeSize = { width: 280, height: 180 };

describe('computeInitialCircle', () => {
    it('returns minimum radius for empty nodes', () => {
        const c = computeInitialCircle([]);
        expect(c.r).toBe(260);
    });

    it('centers on single node center', () => {
        const nodes = [{ position: { x: 0, y: 0 } }] as any[];
        const c = computeInitialCircle(nodes);
        expect(c.cx).toBeCloseTo(140, 0);
        expect(c.cy).toBeCloseTo(90, 0);
    });

    it('encompasses all node corners for multi-node layout', () => {
        const nodes = [
            { position: { x: 0, y: 0 } },
            { position: { x: 500, y: 400 } },
        ] as any[];
        const c = computeInitialCircle(nodes);
        nodes.forEach(n => {
            const corners = [
                { x: n.position.x, y: n.position.y },
                { x: n.position.x + 280, y: n.position.y },
                { x: n.position.x, y: n.position.y + 180 },
                { x: n.position.x + 280, y: n.position.y + 180 },
            ];
            corners.forEach(corner => {
                const dist = Math.sqrt((corner.x - c.cx) ** 2 + (corner.y - c.cy) ** 2);
                expect(dist).toBeLessThanOrEqual(c.r + 1);
            });
        });
    });
});

describe('clampToCircle', () => {
    const circle = { cx: 0, cy: 0, r: 300 };

    it('does not move a node whose corners are all inside the circle', () => {
        const pos = { x: -140, y: -90 };
        const result = clampToCircle(pos, circle, nodeSize);
        expect(result.x).toBeCloseTo(pos.x, 1);
        expect(result.y).toBeCloseTo(pos.y, 1);
    });

    it('node stays within circle after clamping (dragged right)', () => {
        const result = clampToCircle({ x: 9999, y: 0 }, circle, nodeSize);
        expect(result.x).toBeLessThan(9999);
        const centerX = result.x + nodeSize.width / 2;
        const centerY = result.y + nodeSize.height / 2;
        const centerDist = Math.sqrt((centerX - circle.cx) ** 2 + (centerY - circle.cy) ** 2);
        expect(centerDist).toBeLessThanOrEqual(circle.r);
    });

    it('node stays within circle after clamping (dragged upward)', () => {
        const result = clampToCircle({ x: 0, y: -9999 }, circle, nodeSize);
        expect(result.y).toBeGreaterThan(-9999);
        const centerX = result.x + nodeSize.width / 2;
        const centerY = result.y + nodeSize.height / 2;
        const centerDist = Math.sqrt((centerX - circle.cx) ** 2 + (centerY - circle.cy) ** 2);
        expect(centerDist).toBeLessThanOrEqual(circle.r);
    });

    it('node stays within circle after clamping (dragged diagonal)', () => {
        const result = clampToCircle({ x: 9999, y: 9999 }, circle, nodeSize);
        expect(result.x).toBeLessThan(9999);
        expect(result.y).toBeLessThan(9999);
        const centerX = result.x + nodeSize.width / 2;
        const centerY = result.y + nodeSize.height / 2;
        const centerDist = Math.sqrt((centerX - circle.cx) ** 2 + (centerY - circle.cy) ** 2);
        expect(centerDist).toBeLessThanOrEqual(circle.r);
    });
});

describe('clampAllNodesToCircle', () => {
    it('returns positions only for nodes outside the circle', () => {
        const circle = { cx: 0, cy: 0, r: 300 };
        const nodes = [
            { id: 'n1', type: 'ecoreFile', position: { x: 9999, y: 0 }, data: {} },
            { id: 'n2', type: 'ecoreFile', position: { x: -140, y: -90 }, data: {} },
        ] as any[];
        const result = clampAllNodesToCircle(nodes, circle);
        expect(result.has('n1')).toBe(true);
        expect(result.has('n2')).toBe(false);
    });

    it('returns empty map when all nodes are inside', () => {
        const circle = { cx: 0, cy: 0, r: 300 };
        const nodes = [
            { id: 'n1', type: 'ecoreFile', position: { x: -140, y: -90 }, data: {} },
        ] as any[];
        const result = clampAllNodesToCircle(nodes, circle);
        expect(result.size).toBe(0);
    });
});