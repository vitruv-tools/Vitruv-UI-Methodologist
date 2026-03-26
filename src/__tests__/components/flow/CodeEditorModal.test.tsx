import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CodeEditorModal } from '../../../components/flow/CodeEditorModal';

jest.mock('@monaco-editor/react', () => ({
  __esModule: true,
  default: ({ value, onChange }: any) => (
    <textarea
      data-testid="monaco-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

jest.mock('../../../components/ui/ConfirmDialog', () => ({
  ConfirmDialog: ({
    isOpen,
    title,
    message,
    confirmText,
    cancelText,
    singleAction,
    onConfirm,
    onCancel,
  }: any) => {
    if (!isOpen) return null;
    return (
      <div data-testid={`confirm-${title}`}>
        <div>{message}</div>
        <button onClick={onConfirm}>{confirmText}</button>
        {!singleAction && <button onClick={onCancel}>{cancelText}</button>}
      </div>
    );
  },
}));

describe('CodeEditorModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onSave: jest.fn().mockResolvedValue(undefined),
    initialCode: 'initial code',
    edgeId: 'edge-123',
    sourceFileName: 'Source.ecore',
    targetFileName: 'Target.ecore',
    vsumId: '1',
    title: 'Reaction Editor',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders header, file names and editor with initial code', () => {
    render(<CodeEditorModal {...defaultProps} />);

    expect(screen.getByText(/Reaction Editor/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Source\.ecore ↔ Target\.ecore/i),
    ).toBeInTheDocument();
    expect(screen.getByTestId('monaco-editor')).toHaveValue('initial code');
    expect(screen.getByText(/Edge ID: edge-123/i)).toBeInTheDocument();
  });

  it('calls onSave when Save is clicked and modal stays open', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();

    render(
      <CodeEditorModal
        {...defaultProps}
        onSave={onSave}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /💾 Save/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('initial code');
    });
    // Modal stays open after save - onClose is NOT called automatically
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows error dialog if save fails', async () => {
    const onSave = jest.fn().mockRejectedValue(new Error('Save failed'));

    render(
      <CodeEditorModal
        {...defaultProps}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /💾 Save/i }));

    expect(await screen.findByTestId('confirm-Unable to save file')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(<CodeEditorModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText(/Reaction Editor/i)).not.toBeInTheDocument();
  });

  it('updates code when editor content changes', () => {
    render(<CodeEditorModal {...defaultProps} />);

    const editor = screen.getByTestId('monaco-editor');
    fireEvent.change(editor, { target: { value: 'new code' } });

    expect(editor).toHaveValue('new code');
  });

  it('shows unsaved changes indicator after editing', async () => {
    render(<CodeEditorModal {...defaultProps} />);

    const editor = screen.getByTestId('monaco-editor');
    fireEvent.change(editor, { target: { value: 'modified code' } });

    expect(screen.getByText(/Unsaved changes/i)).toBeInTheDocument();
  });

  it('hides unsaved changes indicator when code matches initial code', () => {
    render(<CodeEditorModal {...defaultProps} />);

    // Initially no unsaved changes
    expect(screen.queryByText(/Unsaved changes/i)).not.toBeInTheDocument();
  });

  it('shows unsaved changes dialog when closing with unsaved changes', async () => {
    const onClose = jest.fn();
    render(
      <CodeEditorModal
        {...defaultProps}
        onClose={onClose}
      />,
    );

    // Modify the code
    fireEvent.change(screen.getByTestId('monaco-editor'), {
      target: { value: 'modified code' },
    });

    // Click the X close button
    fireEvent.click(screen.getByTitle('Close (Esc)'));

    // Should show confirmation dialog, not close immediately
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('confirm-Unsaved Changes')).toBeInTheDocument();
  });

  it('closes without saving when confirming unsaved changes dialog', async () => {
    const onClose = jest.fn();
    render(
      <CodeEditorModal
        {...defaultProps}
        onClose={onClose}
      />,
    );

    fireEvent.change(screen.getByTestId('monaco-editor'), {
      target: { value: 'modified code' },
    });

    fireEvent.click(screen.getByTitle('Close (Esc)'));

    // Click "Discard" / confirm button in dialog
    const dialog = screen.getByTestId('confirm-Unsaved Changes');
    fireEvent.click(dialog.querySelector('button')!);

    expect(onClose).toHaveBeenCalled();
  });

  it('closes without confirmation when no unsaved changes', () => {
    const onClose = jest.fn();
    render(
      <CodeEditorModal
        {...defaultProps}
        onClose={onClose}
      />,
    );

    // Click close without making changes
    fireEvent.click(screen.getByTitle('Close (Esc)'));

    // Should close immediately without confirmation
    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByTestId('confirm-Unsaved Changes')).not.toBeInTheDocument();
  });

  it('hides unsaved changes indicator after successful save', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(
      <CodeEditorModal
        {...defaultProps}
        onSave={onSave}
      />,
    );

    // Make a change
    fireEvent.change(screen.getByTestId('monaco-editor'), {
      target: { value: 'modified code' },
    });

    expect(screen.getByText(/Unsaved changes/i)).toBeInTheDocument();

    // Save
    fireEvent.click(screen.getByRole('button', { name: /💾 Save/i }));

    await waitFor(() => {
      expect(screen.queryByText(/Unsaved changes/i)).not.toBeInTheDocument();
    });
  });

  it('calls onDelete and onClose when Delete is clicked and confirmed', async () => {
    const onDelete = jest.fn();
    const onClose = jest.fn();

    render(
      <CodeEditorModal
        {...defaultProps}
        onDelete={onDelete}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByTitle('Delete relation'));

    // Confirm the deletion dialog
    const dialog = await screen.findByTestId('confirm-Delete Relation');
    fireEvent.click(dialog.querySelector('button')!);

    expect(onDelete).toHaveBeenCalled();
  });

  it('does not call onDelete when deletion is cancelled', async () => {
    const onDelete = jest.fn();

    render(
      <CodeEditorModal
        {...defaultProps}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByTitle('Delete relation'));

    const dialog = await screen.findByTestId('confirm-Delete Relation');
    const buttons = dialog.querySelectorAll('button');
    // Click cancel (second button)
    fireEvent.click(buttons[1]);

    expect(onDelete).not.toHaveBeenCalled();
  });

  it('resets code and unsaved state when initialCode prop changes', async () => {
    const { rerender } = render(<CodeEditorModal {...defaultProps} />);

    // Modify code
    fireEvent.change(screen.getByTestId('monaco-editor'), {
      target: { value: 'modified code' },
    });
    expect(screen.getByText(/Unsaved changes/i)).toBeInTheDocument();

    // Rerender with new initialCode (simulates reopening editor)
    rerender(<CodeEditorModal {...defaultProps} initialCode="new initial code" />);

    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toHaveValue('new initial code');
      expect(screen.queryByText(/Unsaved changes/i)).not.toBeInTheDocument();
    });
  });
});