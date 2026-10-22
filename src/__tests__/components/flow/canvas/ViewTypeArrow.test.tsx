import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ViewTypeArrow } from '../../../../components/flow/canvas/ViewTypeArrow';

// ── Helpers ───────────────────────────────────────────────────────────────────

const defaultProps = (overrides?: any) => ({
    id: 'vt-1::node-1',
    bubbleCx: 0,
    bubbleCy: 0,
    bubbleR: 28,
    nodeCx: 300,
    nodeCy: 0,
    nodeW: 280,
    nodeH: 180,
    editable: false,
    onDelete: jest.fn(),
    ...overrides,
});

const renderArrow = (props?: any) =>
    render(
        <svg>
            <ViewTypeArrow {...defaultProps(props)} />
        </svg>
    );

const getHitbox = (container: HTMLElement) =>
    container.querySelector('line[stroke="transparent"]')!;

const getShaft = (container: HTMLElement) =>
    container.querySelector('line[stroke="var(--v-uml-circle, #0c436e)"]')!;

const getPolygons = (container: HTMLElement) =>
    container.querySelectorAll('polygon');

const openMenu = (container: HTMLElement) =>
    fireEvent.click(getHitbox(container), { clientX: 150, clientY: 50 });

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ViewTypeArrow', () => {
    beforeEach(() => jest.clearAllMocks());

    // Rendering

    it('renders a transparent hitbox line', () => {
        const { container } = renderArrow();
        expect(getHitbox(container)).toBeInTheDocument();
        expect(getHitbox(container).getAttribute('stroke')).toBe('transparent');
        expect(getHitbox(container).getAttribute('stroke-width')).toBe('14');
    });

    it('renders a visible shaft line', () => {
        const { container } = renderArrow();
        expect(getShaft(container)).toBeInTheDocument();
        expect(getShaft(container).getAttribute('stroke')).toBe('var(--v-uml-circle, #0c436e)');
    });

    it('renders exactly one arrowhead polygon when not editable', () => {
        const { container } = renderArrow({ editable: false });
        expect(getPolygons(container)).toHaveLength(1);
    });

    it('renders two arrowhead polygons when editable', () => {
        const { container } = renderArrow({ editable: true });
        expect(getPolygons(container)).toHaveLength(2);
    });

    it('shaft end point differs between editable and non-editable', () => {
        const { container: c1 } = renderArrow({ editable: false });
        const { container: c2 } = renderArrow({ editable: true });
        const shaft1 = getShaft(c1);
        const shaft2 = getShaft(c2);
        expect(shaft1.getAttribute('x2')).not.toBe(shaft2.getAttribute('x2'));
    });

    // Geometry — circleEdgePoint

    it('hitbox starts near the bubble rim (not center)', () => {
        const { container } = renderArrow({ bubbleCx: 0, bubbleCy: 0, bubbleR: 28, nodeCx: 300, nodeCy: 0 });
        const x1 = parseFloat(getHitbox(container).getAttribute('x1')!);
        expect(Math.abs(x1)).toBeLessThan(300);
        expect(Math.abs(x1)).toBeGreaterThan(0);
    });

    it('hitbox ends near the node rect edge', () => {
        const { container } = renderArrow({ bubbleCx: 0, bubbleCy: 0, nodeCx: 300, nodeCy: 0, nodeW: 280, nodeH: 180 });
        const x2 = parseFloat(getHitbox(container).getAttribute('x2')!);
        expect(x2).toBeCloseTo(160, 0);
    });

    // Context menu

    it('does not show context menu initially', () => {
        renderArrow();
        expect(screen.queryByText('ViewType connection')).toBeNull();
    });

    it('shows context menu when hitbox is clicked', () => {
        const { container } = renderArrow();
        openMenu(container);
        expect(screen.getByText('ViewType connection')).toBeInTheDocument();
        expect(screen.getByText('Delete connection')).toBeInTheDocument();
    });

    it('stops propagation when hitbox is clicked', () => {
        const parentHandler = jest.fn();
        const { container } = render(
            <svg onClick={parentHandler}>
                <ViewTypeArrow {...defaultProps()} />
            </svg>
        );
        fireEvent.click(getHitbox(container), { clientX: 150, clientY: 50 });
        expect(parentHandler).not.toHaveBeenCalled();
    });

    it('calls onDelete with id when Delete connection is clicked', () => {
        const onDelete = jest.fn();
        const { container } = renderArrow({ onDelete });
        openMenu(container);
        fireEvent.click(screen.getByText('Delete connection'));
        expect(onDelete).toHaveBeenCalledWith('vt-1::node-1');
    });

    it('closes context menu after deletion', () => {
        const { container } = renderArrow();
        openMenu(container);
        fireEvent.click(screen.getByText('Delete connection'));
        expect(screen.queryByText('ViewType connection')).toBeNull();
    });

    it('closes context menu when backdrop is clicked', () => {
        const { container } = renderArrow();
        openMenu(container);
        const backdrop = document.body.querySelector('button[aria-label="Close menu"]') as HTMLElement;
        fireEvent.click(backdrop);
        expect(screen.queryByText('ViewType connection')).toBeNull();
    });

    it('does not close menu when clicking inside the menu panel', () => {
        const { container } = renderArrow();
        openMenu(container);
        fireEvent.click(screen.getByText('ViewType connection'));
        expect(screen.getByText('ViewType connection')).toBeInTheDocument();
    });

    it('does not call onDelete when menu is closed via backdrop', () => {
        const onDelete = jest.fn();
        const { container } = renderArrow({ onDelete });
        openMenu(container);
        const backdrop = document.body.querySelector('button[aria-label="Close menu"]') as HTMLElement;
        fireEvent.click(backdrop);
        expect(onDelete).not.toHaveBeenCalled();
    });

    // Polygon geometry sanity checks

    it('arrowhead polygon has three points', () => {
        const { container } = renderArrow({ editable: false });
        const polygon = getPolygons(container)[0];
        const points = polygon.getAttribute('points')!.trim().split(/\s+/);
        expect(points).toHaveLength(3);
    });

    it('both arrowhead polygons have three points when editable', () => {
        const { container } = renderArrow({ editable: true });
        getPolygons(container).forEach(polygon => {
            const points = polygon.getAttribute('points')!.trim().split(/\s+/);
            expect(points).toHaveLength(3);
        });
    });

    it('polygons are filled black', () => {
        const { container } = renderArrow({ editable: true });
        getPolygons(container).forEach(polygon => {
            expect(polygon.getAttribute('fill')).toBe('var(--v-uml-circle, #0c436e)');
        });
    });

    it('renders correctly with bubble directly above node', () => {
        const { container } = renderArrow({
            bubbleCx: 150, bubbleCy: 0,
            nodeCx: 150, nodeCy: 300,
            nodeW: 280, nodeH: 180,
        });
        expect(getShaft(container)).toBeInTheDocument();
    });

    it('renders correctly with bubble to the left of node', () => {
        const { container } = renderArrow({
            bubbleCx: 0, bubbleCy: 150,
            nodeCx: 400, nodeCy: 150,
            nodeW: 280, nodeH: 180,
        });
        expect(getShaft(container)).toBeInTheDocument();
    });
});