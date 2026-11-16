import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ViewTypeDeletionMenu } from '../../../../components/flow/canvas/ViewTypeDeletionMenu';

// ── Helpers ───────────────────────────────────────────────────────────────────

const defaultProps = (overrides?: any) => ({
    x: 100,
    y: 200,
    label: 'VT1',
    onDelete: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
});

const renderMenu = (props?: any) =>
    render(<ViewTypeDeletionMenu {...defaultProps(props)} />);

const getBackdrop = () =>
    document.body.querySelector('button[aria-label="Close menu"]') as HTMLElement;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ViewTypeDeletionMenu', () => {
    beforeEach(() => vi.clearAllMocks());

    // Rendering

    it('renders the label', () => {
        renderMenu();
        expect(screen.getByText('VT1')).toBeInTheDocument();
    });

    it('renders the Delete view type button', () => {
        renderMenu();
        expect(screen.getByRole('button', { name: /Delete view type/i })).toBeInTheDocument();
    });

    it('renders with a custom label', () => {
        renderMenu({ label: 'MyViewType' });
        expect(screen.getByText('MyViewType')).toBeInTheDocument();
    });

    it('renders via portal into document.body', () => {
        renderMenu();
        expect(document.body.querySelector('button[aria-label="Close menu"]')).toBeInTheDocument();
    });

    // Delete behavior

    it('calls onDelete when Delete view type is clicked', () => {
        const onDelete = vi.fn();
        renderMenu({ onDelete });
        fireEvent.click(screen.getByRole('button', { name: /Delete view type/i }));
        expect(onDelete).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Delete view type is clicked', () => {
        const onClose = vi.fn();
        renderMenu({ onClose });
        fireEvent.click(screen.getByRole('button', { name: /Delete view type/i }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls both onDelete and onClose when Delete view type is clicked', () => {
        const onDelete = vi.fn();
        const onClose = vi.fn();
        renderMenu({ onDelete, onClose });
        fireEvent.click(screen.getByRole('button', { name: /Delete view type/i }));
        expect(onDelete).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
    });

    // Backdrop / close behavior

    it('calls onClose when backdrop is clicked', () => {
        const onClose = vi.fn();
        renderMenu({ onClose });
        fireEvent.click(getBackdrop());
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('closes when the X button is clicked', () => {
        const onClose = vi.fn();
        const onDelete = vi.fn();
        renderMenu({ onClose, onDelete });
        fireEvent.click(screen.getByRole('button', { name: 'Close' }));
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onDelete).not.toHaveBeenCalled();
    });

    it('does not call onDelete when backdrop is clicked', () => {
        const onDelete = vi.fn();
        renderMenu({ onDelete });
        fireEvent.click(getBackdrop());
        expect(onDelete).not.toHaveBeenCalled();
    });

    it('does not close when clicking inside the menu panel', () => {
        const onClose = vi.fn();
        renderMenu({ onClose });
        fireEvent.click(screen.getByText('VT1'));
        expect(onClose).not.toHaveBeenCalled();
    });

    it('does not call onDelete when clicking inside the menu panel without the button', () => {
        const onDelete = vi.fn();
        renderMenu({ onDelete });
        fireEvent.click(screen.getByText('VT1'));
        expect(onDelete).not.toHaveBeenCalled();
    });

    it('calls onEditQuery and closes when Edit query is clicked', () => {
        const onEditQuery = vi.fn();
        const onClose = vi.fn();
        const onDelete = vi.fn();
        renderMenu({ onEditQuery, onClose, onDelete });
        fireEvent.click(screen.getByRole('button', { name: /Edit query/i }));
        expect(onEditQuery).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onDelete).not.toHaveBeenCalled();
    });

    it('hides Edit query when the view cannot be edited', () => {
        renderMenu();
        expect(screen.queryByRole('button', { name: /Edit query/i })).not.toBeInTheDocument();
    });

    // Positioning

    it('renders menu panel at the correct position', () => {
        renderMenu({ x: 250, y: 350 });
        const panel = document.body.querySelector(
            'dialog[style*="left: 250px"], dialog[style*="left:250px"]'
        ) as HTMLElement;
        expect(panel).toBeInTheDocument();
    });

    it('uses theme colors for Edit query and Delete', () => {
        renderMenu({ onEditQuery: vi.fn() });
        expect(screen.getByRole('button', { name: /Edit query/i })).toHaveClass('view-type-menu__action');
        expect(screen.getByRole('button', { name: /Delete view type/i })).toHaveClass(
            'view-type-menu__action',
            'view-type-menu__action--danger',
        );
        expect(document.body.querySelector('dialog')).toHaveClass('view-type-menu');
    });
});