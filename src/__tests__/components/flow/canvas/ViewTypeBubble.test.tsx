import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ViewTypeBubble, OUTER_R } from '../../../../components/flow/canvas/ViewTypeBubble';

// ── Helpers ───────────────────────────────────────────────────────────────────

const defaultProps = (overrides?: any) => ({
    id: 'vt-1',
    label: 'VT1',
    scope: 'single' as const,
    cx: 100,
    cy: 100,
    onDragStart: jest.fn(),
    onDrag: jest.fn(),
    onDragEnd: jest.fn(),
    onClick: jest.fn(),
    ...overrides,
});

const renderBubble = (props?: any) =>
    render(
        <svg>
            <ViewTypeBubble {...defaultProps(props)} />
        </svg>
    );

const getGroup = (container: HTMLElement) =>
    container.querySelector('g')!;

const simulateClick = (element: Element) => {
    fireEvent.pointerDown(element, { pointerId: 1 });
    fireEvent.pointerUp(element, { pointerId: 1 });
};

const simulateDrag = (element: Element, moveEvents = 1) => {
    fireEvent.pointerDown(element, { pointerId: 1 });
    for (let i = 0; i < moveEvents; i++) {
        fireEvent.pointerMove(element, { pointerId: 1, clientX: 110 + i, clientY: 100 });
    }
    fireEvent.pointerUp(element, { pointerId: 1 });
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ViewTypeBubble', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // jsdom does not implement setPointerCapture/releasePointerCapture on SVG elements
        SVGElement.prototype.setPointerCapture = jest.fn();
        SVGElement.prototype.releasePointerCapture = jest.fn();
    });

    afterEach(() => {
        // @ts-expect-error — cleanup mock
        delete SVGElement.prototype.setPointerCapture;
        // @ts-expect-error — cleanup mock
        delete SVGElement.prototype.releasePointerCapture;
    });

    // Rendering

    it('renders the label', () => {
        renderBubble();
        expect(screen.getByText('VT1')).toBeInTheDocument();
    });

    it('renders with custom label', () => {
        renderBubble({ label: 'MyView' });
        expect(screen.getByText('MyView')).toBeInTheDocument();
    });

    it('renders correct number of circles for single scope', () => {
        const { container } = renderBubble({ scope: 'single' });
        const circles = container.querySelectorAll('circle');
        expect(circles).toHaveLength(4);
    });

    it('renders extra ring circles for multi scope', () => {
        const { container } = renderBubble({ scope: 'multi' });
        const circles = container.querySelectorAll('circle');
        expect(circles).toHaveLength(6);
    });

    it('exports OUTER_R as 28', () => {
        expect(OUTER_R).toBe(28);
    });

    it('renders hit area circle with radius OUTER_R + 8', () => {
        const { container } = renderBubble();
        const hitArea = container.querySelector('circle[fill="transparent"]')!;
        expect(hitArea.getAttribute('r')).toBe(String(OUTER_R + 8));
    });

    it('positions circles at the correct cx/cy', () => {
        const { container } = renderBubble({ cx: 200, cy: 150 });
        const circles = container.querySelectorAll('circle');
        circles.forEach(circle => {
            expect(circle.getAttribute('cx')).toBe('200');
            expect(circle.getAttribute('cy')).toBe('150');
        });
    });

    it('uses orange color for single scope', () => {
        const { container } = renderBubble({ scope: 'single' });
        const outerRing = container.querySelector(`circle[r="${OUTER_R}"]`)!;
        expect(outerRing.getAttribute('fill')).toBe('#E8A838');
    });

    it('uses red color for multi scope', () => {
        const { container } = renderBubble({ scope: 'multi' });
        const outerRing = container.querySelector(`circle[r="${OUTER_R}"]`)!;
        expect(outerRing.getAttribute('fill')).toBe('#A81C1C');
    });

    it('renders a linearGradient with the bubble id', () => {
        const { container } = renderBubble({ id: 'vt-42' });
        expect(container.querySelector('#vt-gradient-vt-42')).toBeInTheDocument();
    });

    it('has pointer-events="all" on root group', () => {
        const { container } = renderBubble();
        expect(getGroup(container).getAttribute('pointer-events')).toBe('all');
    });

    it('label has pointerEvents none', () => {
        const { container } = renderBubble();
        const text = container.querySelector('text')!;
        expect(text).toHaveStyle({ pointerEvents: 'none' });
    });

    // Click behavior

    it('calls onClick when pointer down then up without move', () => {
        const onClick = jest.fn();
        const { container } = renderBubble({ onClick });
        simulateClick(getGroup(container));
        expect(onClick).toHaveBeenCalledWith('vt-1');
    });

    it('calls onDragStart on pointer down', () => {
        const onDragStart = jest.fn();
        const { container } = renderBubble({ onDragStart });
        fireEvent.pointerDown(getGroup(container), { pointerId: 1 });
        expect(onDragStart).toHaveBeenCalledWith('vt-1');
    });

    it('does not call onClick after a drag', () => {
        const onClick = jest.fn();
        const { container } = renderBubble({ onClick });
        simulateDrag(getGroup(container));
        expect(onClick).not.toHaveBeenCalled();
    });

    // Drag behavior

    it('calls onDrag during pointer move when dragging', () => {
        const onDrag = jest.fn();
        const { container } = renderBubble({ onDrag });
        const g = getGroup(container);
        fireEvent.pointerDown(g, { pointerId: 1 });
        fireEvent.pointerMove(g, { pointerId: 1, clientX: 120, clientY: 105 });
        expect(onDrag).toHaveBeenCalledWith('vt-1', expect.any(Object));
    });

    it('does not call onDrag during pointer move when not dragging', () => {
        const onDrag = jest.fn();
        const { container } = renderBubble({ onDrag });
        fireEvent.pointerMove(getGroup(container), { pointerId: 1, clientX: 120, clientY: 105 });
        expect(onDrag).not.toHaveBeenCalled();
    });

    it('calls onDragEnd on pointer up after drag', () => {
        const onDragEnd = jest.fn();
        const { container } = renderBubble({ onDragEnd });
        simulateDrag(getGroup(container));
        expect(onDragEnd).toHaveBeenCalledWith('vt-1');
    });

    it('calls onDragEnd even on a simple click (no move)', () => {
        const onDragEnd = jest.fn();
        const { container } = renderBubble({ onDragEnd });
        simulateClick(getGroup(container));
        expect(onDragEnd).toHaveBeenCalledWith('vt-1');
    });

    it('does not call onDrag if pointer up happens without prior pointer down', () => {
        const onDrag = jest.fn();
        const onDragEnd = jest.fn();
        const { container } = renderBubble({ onDrag, onDragEnd });
        fireEvent.pointerUp(getGroup(container), { pointerId: 1 });
        expect(onDrag).not.toHaveBeenCalled();
        expect(onDragEnd).not.toHaveBeenCalled();
    });

    it('stops propagation on pointer down', () => {
        const parentHandler = jest.fn();
        const { container } = render(
            <svg onClick={parentHandler}>
                <ViewTypeBubble {...defaultProps()} />
            </svg>
        );
        fireEvent.pointerDown(getGroup(container), { pointerId: 1 });
        expect(parentHandler).not.toHaveBeenCalled();
    });

    it('stops propagation on pointer move during drag', () => {
        const parentHandler = jest.fn();
        const { container } = render(
            <svg onPointerMove={parentHandler}>
                <ViewTypeBubble {...defaultProps()} />
            </svg>
        );
        const g = getGroup(container);
        fireEvent.pointerDown(g, { pointerId: 1 });
        fireEvent.pointerMove(g, { pointerId: 1, clientX: 110, clientY: 100 });
        expect(parentHandler).not.toHaveBeenCalled();
    });

    // Multiple drags

    it('can be dragged multiple times independently', () => {
        const onClick = jest.fn();
        const onDrag = jest.fn();
        const { container } = renderBubble({ onClick, onDrag });
        const g = getGroup(container);

        simulateDrag(g);
        expect(onClick).toHaveBeenCalledTimes(0);
        expect(onDrag).toHaveBeenCalledTimes(1);

        simulateClick(g);
        expect(onClick).toHaveBeenCalledTimes(1);
    });
});