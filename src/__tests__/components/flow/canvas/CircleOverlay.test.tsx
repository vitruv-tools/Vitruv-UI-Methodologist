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

    // Context menu

    it('shows context menu on right-click of circle hitbox', () => {
        const { container } = render(<CircleOverlay {...defaultProps()} />);
        // The hitbox is the transparent stroke circle — find it by stroke attr
        const hitbox = container.querySelectorAll('circle')[1]; // visible + hitbox
        fireEvent.contextMenu(hitbox);
        expect(screen.getByTestId('context-menu')).toBeInTheDocument();
    });

    it('closes context menu when onClose is called', () => {
        const { container } = render(<CircleOverlay {...defaultProps()} />);
        const hitbox = container.querySelectorAll('circle')[1];
        fireEvent.contextMenu(hitbox);
        fireEvent.click(screen.getByTestId('context-menu-close'));
        expect(screen.queryByTestId('context-menu')).toBeNull();
    });

    it('calls onAddViewType with computed angle when context menu adds a view type', () => {
        const onAddViewType = jest.fn();
        const { container } = render(
            <CircleOverlay {...defaultProps()} onAddViewType={onAddViewType} />
        );
        const hitbox = container.querySelectorAll('circle')[1];
        fireEvent.contextMenu(hitbox);
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

    it('places first bubble at -π/2 (top) when no existing viewTypes', () => {
        const onAddViewType = jest.fn();
        const { container } = render(
            <CircleOverlay {...defaultProps()} onAddViewType={onAddViewType} viewTypes={[]} />
        );
        const hitbox = container.querySelectorAll('circle')[1];
        fireEvent.contextMenu(hitbox);
        fireEvent.click(screen.getByTestId('context-menu-add'));
        const angle = onAddViewType.mock.calls[0][3];
        expect(angle).toBeCloseTo(-Math.PI / 2);
    });

    it('places second bubble in the largest gap between existing bubbles', () => {
        const onAddViewType = jest.fn();
        const props = {
            ...defaultProps(),
            viewTypes: [makeViewType({ angle: -Math.PI / 2 })], // top
            onAddViewType,
        };
        const { container } = render(<CircleOverlay {...props} />);
        const hitbox = container.querySelectorAll('circle')[1];
        fireEvent.contextMenu(hitbox);
        fireEvent.click(screen.getByTestId('context-menu-add'));
        const angle = onAddViewType.mock.calls[0][3];
        // Largest gap is the lower half → best angle ≈ π/2 (bottom)
        expect(angle).toBeCloseTo(Math.PI / 2, 1);
    });
});