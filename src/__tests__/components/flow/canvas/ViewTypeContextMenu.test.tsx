import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ViewTypeContextMenu } from '../../../../components/flow/canvas/ViewTypeContextMenu';
import { Node } from 'reactflow';

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeNode = (overrides?: Partial<Node>): Node => ({
    id: 'node-1',
    type: 'ecoreFile',
    position: { x: 0, y: 0 },
    data: { fileName: 'test.ecore' },
    ...overrides,
} as Node);

const defaultProps = (overrides?: any) => ({
    x: 100,
    y: 200,
    ecoreNodes: [makeNode()],
    onAdd: jest.fn(),
    onClose: jest.fn(),
    ...overrides,
});

const renderMenu = (props?: any) => render(<ViewTypeContextMenu {...defaultProps(props)} />);

const fillLabel = (value: string) =>
    fireEvent.change(screen.getByPlaceholderText(/Label/i), { target: { value } });

const clickNode = (name: string) =>
    fireEvent.click(screen.getByText(name));

const clickAdd = () =>
    fireEvent.click(screen.getByRole('button', { name: /^Add$/ }));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ViewTypeContextMenu', () => {
    beforeEach(() => jest.clearAllMocks());

    // Rendering

    it('renders the Add View Type heading', () => {
        renderMenu();
        expect(screen.getByRole('heading', { name: 'Add View Type' })).toBeInTheDocument();
    });

    it('renders label input, scope buttons, editable checkbox and Add button', () => {
        renderMenu();
        expect(screen.getByPlaceholderText(/Label/i)).toBeInTheDocument();
        expect(screen.getByText('● Single')).toBeInTheDocument();
        expect(screen.getByText('◎ Multi')).toBeInTheDocument();
        expect(screen.getByRole('checkbox')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^Add$/ })).toBeInTheDocument();
    });

    it('renders ecore node file names', () => {
        renderMenu({
            ecoreNodes: [
                makeNode({ id: 'n1', data: { fileName: 'A.ecore' } }),
                makeNode({ id: 'n2', data: { fileName: 'B.ecore' } }),
            ],
        });
        expect(screen.getByText('A.ecore')).toBeInTheDocument();
        expect(screen.getByText('B.ecore')).toBeInTheDocument();
    });

    it('shows empty state when no ecore nodes', () => {
        renderMenu({ ecoreNodes: [] });
        expect(screen.getByText(/No metamodel nodes on canvas/i)).toBeInTheDocument();
    });

    it('falls back to node.id when fileName is missing', () => {
        renderMenu({
            ecoreNodes: [makeNode({ id: 'node-xyz', data: {} })],
        });
        expect(screen.getByText('node-xyz')).toBeInTheDocument();
    });

    // Add button disabled state

    it('Add button is disabled initially', () => {
        renderMenu();
        expect(screen.getByRole('button', { name: /^Add$/ })).toBeDisabled();
    });

    it('Add button is disabled when label is set but no node selected', () => {
        renderMenu();
        fillLabel('VT1');
        expect(screen.getByRole('button', { name: /^Add$/ })).toBeDisabled();
    });

    it('Add button is disabled when node is selected but no label', () => {
        renderMenu();
        clickNode('test.ecore');
        expect(screen.getByRole('button', { name: /^Add$/ })).toBeDisabled();
    });

    it('Add button is enabled when label and node are both set', () => {
        renderMenu();
        fillLabel('VT1');
        clickNode('test.ecore');
        expect(screen.getByRole('button', { name: /^Add$/ })).not.toBeDisabled();
    });

    // onAdd behavior

    it('calls onAdd with correct args when Add is clicked', () => {
        const onAdd = jest.fn();
        renderMenu({ onAdd });
        fillLabel('VT1');
        clickNode('test.ecore');
        clickAdd();
        expect(onAdd).toHaveBeenCalledWith('VT1', 'single', ['node-1'], false);
    });

    it('calls onAdd with editable=true when checkbox is checked', () => {
        const onAdd = jest.fn();
        renderMenu({ onAdd });
        fillLabel('VT1');
        clickNode('test.ecore');
        fireEvent.click(screen.getByRole('checkbox'));
        clickAdd();
        expect(onAdd).toHaveBeenCalledWith('VT1', 'single', ['node-1'], true);
    });

    it('trims whitespace from label before calling onAdd', () => {
        const onAdd = jest.fn();
        renderMenu({ onAdd });
        fillLabel('  VT1  ');
        clickNode('test.ecore');
        clickAdd();
        expect(onAdd).toHaveBeenCalledWith('VT1', 'single', ['node-1'], false);
    });

    it('calls onClose after successful add', () => {
        const onClose = jest.fn();
        renderMenu({ onClose });
        fillLabel('VT1');
        clickNode('test.ecore');
        clickAdd();
        expect(onClose).toHaveBeenCalled();
    });

    it('does not call onAdd when Add is clicked with empty label', () => {
        const onAdd = jest.fn();
        renderMenu({ onAdd });
        clickNode('test.ecore');
        clickAdd();
        expect(onAdd).not.toHaveBeenCalled();
    });

    it('submits on Enter key in label input', () => {
        const onAdd = jest.fn();
        renderMenu({ onAdd });
        fillLabel('VT1');
        clickNode('test.ecore');
        fireEvent.keyDown(screen.getByPlaceholderText(/Label/i), { key: 'Enter' });
        expect(onAdd).toHaveBeenCalledWith('VT1', 'single', ['node-1'], false);
    });

    it('does not submit on Enter when form is incomplete', () => {
        const onAdd = jest.fn();
        renderMenu({ onAdd });
        fillLabel('VT1');
        // no node selected
        fireEvent.keyDown(screen.getByPlaceholderText(/Label/i), { key: 'Enter' });
        expect(onAdd).not.toHaveBeenCalled();
    });

    // Scope

    it('defaults to single scope', () => {
        renderMenu();
        const singleBtn = screen.getByText('● Single');
        expect(singleBtn).toHaveStyle({ fontWeight: 700 });
    });

    it('switches to multi scope when Multi is clicked', () => {
        renderMenu();
        fireEvent.click(screen.getByText('◎ Multi'));
        expect(screen.getByText('Select metamodels:')).toBeInTheDocument();
    });

    it('shows "Select metamodel:" for single scope', () => {
        renderMenu();
        expect(screen.getByText('Select metamodel:')).toBeInTheDocument();
    });

    it('shows "Select metamodels:" for multi scope', () => {
        renderMenu();
        fireEvent.click(screen.getByText('◎ Multi'));
        expect(screen.getByText('Select metamodels:')).toBeInTheDocument();
    });

    it('single scope only allows one node selected at a time', () => {
        const onAdd = jest.fn();
        renderMenu({
            onAdd,
            ecoreNodes: [
                makeNode({ id: 'n1', data: { fileName: 'A.ecore' } }),
                makeNode({ id: 'n2', data: { fileName: 'B.ecore' } }),
            ],
        });
        fillLabel('VT1');
        clickNode('A.ecore');
        clickNode('B.ecore');
        clickAdd();
        expect(onAdd).toHaveBeenCalledWith('VT1', 'single', ['n2'], false);
    });

    it('multi scope allows multiple nodes selected', () => {
        const onAdd = jest.fn();
        renderMenu({
            onAdd,
            ecoreNodes: [
                makeNode({ id: 'n1', data: { fileName: 'A.ecore' } }),
                makeNode({ id: 'n2', data: { fileName: 'B.ecore' } }),
            ],
        });
        fireEvent.click(screen.getByText('◎ Multi'));
        fillLabel('VT1');
        clickNode('A.ecore');
        clickNode('B.ecore');
        clickAdd();
        expect(onAdd).toHaveBeenCalledWith('VT1', 'multi', ['n1', 'n2'], false);
    });

    it('deselects a node in multi scope when clicked again', () => {
        const onAdd = jest.fn();
        renderMenu({
            onAdd,
            ecoreNodes: [
                makeNode({ id: 'n1', data: { fileName: 'A.ecore' } }),
                makeNode({ id: 'n2', data: { fileName: 'B.ecore' } }),
            ],
        });
        fireEvent.click(screen.getByText('◎ Multi'));
        fillLabel('VT1');
        clickNode('A.ecore');
        clickNode('B.ecore');
        clickNode('A.ecore');
        clickAdd();
        expect(onAdd).toHaveBeenCalledWith('VT1', 'multi', ['n2'], false);
    });

    it('resets node selection when scope changes', () => {
        const onAdd = jest.fn();
        renderMenu({ onAdd });
        fillLabel('VT1');
        clickNode('test.ecore');
        fireEvent.click(screen.getByText('◎ Multi'));
        fireEvent.click(screen.getByText('● Single'));
        clickAdd();
        expect(onAdd).not.toHaveBeenCalled();
    });

    // onClose

    it('calls onClose when backdrop is clicked', () => {
        const onClose = jest.fn();
        render(<ViewTypeContextMenu {...defaultProps({ onClose })} />);
        const backdrop = document.body.querySelector('button[aria-label="Close menu"]') as HTMLElement;
        fireEvent.click(backdrop);
        expect(onClose).toHaveBeenCalled();
    });

    it('does not close when clicking inside the menu panel', () => {
        const onClose = jest.fn();
        renderMenu({ onClose });
        fireEvent.click(screen.getByRole('heading', { name: 'Add View Type' }));
        expect(onClose).not.toHaveBeenCalled();
    });

    // Editable checkbox

    it('editable checkbox is unchecked by default', () => {
        renderMenu();
        expect(screen.getByRole('checkbox')).not.toBeChecked();
    });

    it('editable checkbox can be toggled', () => {
        renderMenu();
        const checkbox = screen.getByRole('checkbox');
        fireEvent.click(checkbox);
        expect(checkbox).toBeChecked();
        fireEvent.click(checkbox);
        expect(checkbox).not.toBeChecked();
    });
});