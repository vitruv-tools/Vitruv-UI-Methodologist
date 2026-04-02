import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ViewTypeDeletionMenu } from '../../../../components/flow/canvas/ViewTypeDeletionMenu';

// ── Helpers ───────────────────────────────────────────────────────────────────

const defaultProps = (overrides?: any) => ({
    x: 100,
    y: 200,
    label: 'VT1',
    onDelete: jest.fn(),
    onClose: jest.fn(),
    ...overrides,
});

const renderMenu = (props?: any) =>
    render(<ViewTypeDeletionMenu {...defaultProps(props)} />);

const getBackdrop = () =>
    document.body.querySelector('div[style*="inset: 0"]') as HTMLElement;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ViewTypeDeletionMenu', () => {
    beforeEach(() => jest.clearAllMocks());

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
        expect(document.body.querySelector('div[style*="inset: 0"]')).toBeInTheDocument();
    });

    // Delete behavior

    it('calls onDelete when Delete view type is clicked', () => {
        const onDelete = jest.fn();
        renderMenu({ onDelete });
        fireEvent.click(screen.getByRole('button', { name: /Delete view type/i }));
        expect(onDelete).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Delete view type is clicked', () => {
        const onClose = jest.fn();
        renderMenu({ onClose });
        fireEvent.click(screen.getByRole('button', { name: /Delete view type/i }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls both onDelete and onClose when Delete view type is clicked', () => {
        const onDelete = jest.fn();
        const onClose = jest.fn();
        renderMenu({ onDelete, onClose });
        fireEvent.click(screen.getByRole('button', { name: /Delete view type/i }));
        expect(onDelete).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
    });

    // Backdrop / close behavior

    it('calls onClose when backdrop is clicked', () => {
        const onClose = jest.fn();
        renderMenu({ onClose });
        fireEvent.click(getBackdrop());
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onDelete when backdrop is clicked', () => {
        const onDelete = jest.fn();
        renderMenu({ onDelete });
        fireEvent.click(getBackdrop());
        expect(onDelete).not.toHaveBeenCalled();
    });

    it('does not close when clicking inside the menu panel', () => {
        const onClose = jest.fn();
        renderMenu({ onClose });
        fireEvent.click(screen.getByText('VT1'));
        expect(onClose).not.toHaveBeenCalled();
    });

    it('does not call onDelete when clicking inside the menu panel without the button', () => {
        const onDelete = jest.fn();
        renderMenu({ onDelete });
        fireEvent.click(screen.getByText('VT1'));
        expect(onDelete).not.toHaveBeenCalled();
    });

    // Positioning

    it('renders menu panel at the correct position', () => {
        renderMenu({ x: 250, y: 350 });
        const panel = document.body.querySelector(
            'div[style*="left: 250px"], div[style*="left:250px"]'
        ) as HTMLElement;
        expect(panel).toBeInTheDocument();
    });

    // Mouse enter/leave on delete button

    it('changes background on mouse enter of delete button', () => {
        renderMenu();
        const btn = screen.getByRole('button', { name: /Delete view type/i });
        fireEvent.mouseEnter(btn);
        expect(btn.style.background).toBe('rgb(254, 242, 242)');
    });

    it('resets background on mouse leave of delete button', () => {
        renderMenu();
        const btn = screen.getByRole('button', { name: /Delete view type/i });
        fireEvent.mouseEnter(btn);
        fireEvent.mouseLeave(btn);
        expect(btn.style.background).toBe('none');
    });
});