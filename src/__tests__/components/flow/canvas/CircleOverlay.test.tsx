import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CircleOverlay } from '../../../../components/flow/canvas/CircleOverlay';
import { Circle } from '../../../../hooks/useCircleContainment';
import { ViewType } from '../../../../hooks/useViewTypes';
import { Node } from 'reactflow';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../../../components/flow/canvas/ViewTypeBubble', () => ({
    OUTER_R: 28,
    ViewTypeBubble: ({ id, label, cx, cy, onClick, onDrag }: any) => (
        <g data-testid={`bubble-${id}`}>
            <circle
                data-testid={`bubble-circle-${id}`}
                cx={cx}
                cy={cy}
                r={28}
                onClick={() => onClick(id)}
                onPointerMove={(e: any) => onDrag(id, e)}
            />
            <text data-testid={`bubble-label-${id}`}>{label}</text>
        </g>
    ),
}));

jest.mock('../../../../components/flow/canvas/ViewTypeContextMenu', () => ({
    ViewTypeContextMenu: ({ onAdd, onClose }: any) => (
        <div data-testid="context-menu">
            <button
                data-testid="context-menu-add"
                onClick={() => onAdd('VT1', 'single', ['node-1'], false)}
            >
                Add
            </button>
            <button data-testid="context-menu-close" onClick={onClose}>
                Close
            </button>
        </div>
    ),
}));

jest.mock('../../../../components/flow/canvas/ViewTypeDeletionMenu', () => ({
    ViewTypeDeletionMenu: ({ label, onDelete, onClose }: any) => (
        <div data-testid="deletion-menu">
            <span data-testid="deletion-menu-label">{label}</span>
            <button data-testid="deletion-menu-confirm" onClick={onDelete}>
                Delete
            </button>
            <button data-testid="deletion-menu-close" onClick={onClose}>
                Cancel
            </button>
        </div>
    ),
}));

jest.mock('../../../../components/flow/canvas/ViewTypeArrow', () => ({
    ViewTypeArrow: ({ id, onDelete }: any) => (
        <line data-testid={`arrow-${id}`} onClick={onDelete} />
    ),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeCircle = (overrides?: Partial<Circle>): Circle => ({
    cx: 0,
    cy: 0,
    r: 300,
    ...overrides,
});

const makeViewport = (overrides?: any) => ({
    x: 0,
    y: 0,
    zoom: 1,
    ...overrides,
});

const makeViewType = (overrides?: Partial<ViewType>): ViewType => ({
    id: 'vt-1',
    label: 'VT1',
    scope: 'single',
    angle: 0,
    linkedNodeIds: ['node-1'],
    editable: false,
    ...overrides,
});

const makeEcoreNode = (overrides?: Partial<Node>): Node => ({
    id: 'node-1',
    type: 'ecoreFile',
    position: { x: 100, y: 100 },
    data: { fileName: 'test.ecore' },
    width: 280,
    height: 180,
    ...overrides,
} as Node);

const makeContainerRef = () => ({
    current: {
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    } as HTMLDivElement,
});

const defaultProps = () => ({
    circle: makeCircle(),
    viewport: makeViewport(),
    selected: false,
    onSelect: jest.fn(),
    onResize: jest.fn(),
    onResizePreview: jest.fn(),
    onResizeEnd: jest.fn(),
    containerRef: makeContainerRef(),
    viewTypes: [],
    ecoreNodes: [],
    onAddViewType: jest.fn(),
    onDeleteViewType: jest.fn(),
    onUpdateViewTypeAngle: jest.fn(),
    onUnlinkNode: jest.fn(),
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CircleOverlay', () => {
    beforeEach(() => jest.clearAllMocks());

    // Rendering

    it('renders nothing when circle.r is 0', () => {
        const { container } = render(
            <svg>
                <CircleOverlay {...defaultProps()} circle={makeCircle({ r: 0 })} />
            </svg>
        );
        expect(container.querySelector('circle')).toBeNull();
    });

    it('renders the SVG overlay when circle.r > 0', () => {
        const { container } = render(<CircleOverlay {...defaultProps()} />);
        expect(container.querySelector('svg')).toBeInTheDocument();
        const ring = [...container.querySelectorAll('circle')].find(
            el => el.getAttribute('stroke') === 'var(--v-uml-circle, #0c436e)',
        );
        expect(ring).toBeTruthy();
    });

    it('renders a bubble for each viewType', () => {
        const props = {
            ...defaultProps(),
            viewTypes: [
                makeViewType({ id: 'vt-1', label: 'VT1' }),
                makeViewType({ id: 'vt-2', label: 'VT2', angle: Math.PI }),
            ],
        };
        render(<CircleOverlay {...props} />);
        expect(screen.getByTestId('bubble-vt-1')).toBeInTheDocument();
        expect(screen.getByTestId('bubble-vt-2')).toBeInTheDocument();
    });

    it('renders an arrow for each linkedNodeId that has a matching ecoreNode', () => {
        const props = {
            ...defaultProps(),
            viewTypes: [makeViewType({ linkedNodeIds: ['node-1'] })],
            ecoreNodes: [makeEcoreNode()],
        };
        render(<CircleOverlay {...props} />);
        expect(screen.getByTestId('arrow-vt-1::node-1')).toBeInTheDocument();
    });

    it('does not render an arrow when linkedNode is not in ecoreNodes', () => {
        const props = {
            ...defaultProps(),
            viewTypes: [makeViewType({ linkedNodeIds: ['node-missing'] })],
            ecoreNodes: [],
        };
        render(<CircleOverlay {...props} />);
        expect(screen.queryByTestId(/^arrow-/)).toBeNull();
    });

    it('renders resize handle when selected', () => {
        render(<CircleOverlay {...defaultProps()} selected={true} />);
        // The ⤡ text is inside the resize handle group
        expect(screen.getByText('⤡')).toBeInTheDocument();
    });

    it('does not render resize handle when not selected', () => {
        render(<CircleOverlay {...defaultProps()} selected={false} />);
        expect(screen.queryByText('⤡')).toBeNull();
    });

    // Hover add-points + context menu

    const hoverCircle = (container: HTMLElement) => {
        // The hitbox is the transparent stroke circle — find it by stroke attr
        const hitbox = container.querySelectorAll('circle')[1]; // visible + hitbox
        fireEvent.mouseEnter(hitbox.parentElement as Element);
        return hitbox;
    };

    it('does not show add-points before hovering the circle', () => {
        const { container } = render(<CircleOverlay {...defaultProps()} />);
        // add-points render as extra <g> children inside the hitbox group; none should exist yet
        expect(container.querySelectorAll('circle')).toHaveLength(2); // visible + hitbox only
    });

    it('shows add-points on hover and hides them on mouse leave', () => {
        const { container } = render(<CircleOverlay {...defaultProps()} />);
        const hitbox = hoverCircle(container);
        // 2 circles per add-point (hit area + visible dot) × 4 cardinal slots
        expect(container.querySelectorAll('circle')).toHaveLength(2 + 4 * 2);

        fireEvent.mouseLeave(hitbox.parentElement as Element);
        expect(container.querySelectorAll('circle')).toHaveLength(2);
    });

    it('opens the context menu when an add-point is clicked', () => {
        const { container } = render(<CircleOverlay {...defaultProps()} />);
        hoverCircle(container);
        const addPointDot = container.querySelectorAll('circle')[3]; // first add-point's visible dot
        fireEvent.click(addPointDot);
        expect(screen.getByTestId('context-menu')).toBeInTheDocument();
    });

    it('closes context menu when onClose is called', () => {
        const { container } = render(<CircleOverlay {...defaultProps()} />);
        hoverCircle(container);
        const addPointDot = container.querySelectorAll('circle')[3];
        fireEvent.click(addPointDot);
        fireEvent.click(screen.getByTestId('context-menu-close'));
        expect(screen.queryByTestId('context-menu')).toBeNull();
    });

    it('calls onAddViewType with the clicked add-point angle when context menu adds a view type', () => {
        const onAddViewType = jest.fn();
        const { container } = render(
            <CircleOverlay {...defaultProps()} onAddViewType={onAddViewType} />
        );
        hoverCircle(container);
        const addPointDot = container.querySelectorAll('circle')[3];
        fireEvent.click(addPointDot);
        fireEvent.click(screen.getByTestId('context-menu-add'));
        expect(onAddViewType).toHaveBeenCalledWith(
            'VT1', 'single', ['node-1'],
            expect.any(Number), // angle
            false,              // editable
        );
    });

    // Deletion menu

    it('shows deletion menu when a bubble is clicked', () => {
        const props = {
            ...defaultProps(),
            viewTypes: [makeViewType()],
        };
        render(<CircleOverlay {...props} />);
        fireEvent.click(screen.getByTestId('bubble-circle-vt-1'));
        expect(screen.getByTestId('deletion-menu')).toBeInTheDocument();
        expect(screen.getByTestId('deletion-menu-label')).toHaveTextContent('VT1');
    });

    it('calls onDeleteViewType when deletion is confirmed', () => {
        const onDeleteViewType = jest.fn();
        const props = {
            ...defaultProps(),
            viewTypes: [makeViewType()],
            onDeleteViewType,
        };
        render(<CircleOverlay {...props} />);
        fireEvent.click(screen.getByTestId('bubble-circle-vt-1'));
        fireEvent.click(screen.getByTestId('deletion-menu-confirm'));
        expect(onDeleteViewType).toHaveBeenCalledWith('vt-1');
    });

    it('closes deletion menu when cancel is clicked', () => {
        const props = {
            ...defaultProps(),
            viewTypes: [makeViewType()],
        };
        render(<CircleOverlay {...props} />);
        fireEvent.click(screen.getByTestId('bubble-circle-vt-1'));
        fireEvent.click(screen.getByTestId('deletion-menu-close'));
        expect(screen.queryByTestId('deletion-menu')).toBeNull();
    });

    // Selection

    it('calls onSelect when circle hitbox is clicked', () => {
        const onSelect = jest.fn();
        const { container } = render(
            <CircleOverlay {...defaultProps()} onSelect={onSelect} />
        );
        const hitbox = container.querySelectorAll('circle')[1];
        fireEvent.click(hitbox);
        expect(onSelect).toHaveBeenCalled();
    });

    // Arrow deletion

    it('calls onDeleteViewType when an arrow is clicked', () => {
        const onDeleteViewType = jest.fn();
        const props = {
            ...defaultProps(),
            viewTypes: [makeViewType({ linkedNodeIds: ['node-1'] })],
            ecoreNodes: [makeEcoreNode()],
            onDeleteViewType,
        };
        render(<CircleOverlay {...props} />);
        fireEvent.click(screen.getByTestId('arrow-vt-1::node-1'));
        expect(onDeleteViewType).toHaveBeenCalledWith('vt-1');
    });

    // Angle computation

    it('offers an add-point at -π/2 (top) when no existing viewTypes, and spawns the VT there', () => {
        const onAddViewType = jest.fn();
        const { container } = render(
            <CircleOverlay {...defaultProps()} onAddViewType={onAddViewType} viewTypes={[]} />
        );
        hoverCircle(container);
        const topAddPointDot = container.querySelectorAll('circle')[3]; // first cardinal slot: top
        fireEvent.click(topAddPointDot);
        fireEvent.click(screen.getByTestId('context-menu-add'));
        const angle = onAddViewType.mock.calls[0][3];
        expect(angle).toBeCloseTo(-Math.PI / 2);
    });

    it('relocates the top add-point into the largest gap once the top slot is occupied', () => {
        const onAddViewType = jest.fn();
        const props = {
            ...defaultProps(),
            viewTypes: [makeViewType({ angle: -Math.PI / 2 })], // top is now occupied
            onAddViewType,
        };
        const { container } = render(<CircleOverlay {...props} />);
        hoverCircle(container);
        // Cardinal order is top/right/bottom/left; top is occupied so right/bottom/left
        // stay as add-points (reserved so the relocated point can't land on them too),
        // and the 4th (relocated) add-point is computed via the same gap algorithm used
        // for new VT bubbles — here the largest tied gap is between right (0) and
        // bottom (π/2), so it lands at their midpoint, π/4. Rendered last.
        const relocatedAddPointDot = container.querySelectorAll('circle')[9];
        fireEvent.click(relocatedAddPointDot);
        fireEvent.click(screen.getByTestId('context-menu-add'));
        const angle = onAddViewType.mock.calls[0][3];
        expect(angle).toBeCloseTo(Math.PI / 4, 1);
    });
});