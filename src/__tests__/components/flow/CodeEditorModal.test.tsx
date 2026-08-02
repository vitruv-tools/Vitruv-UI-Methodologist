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

    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

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

    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    expect(await screen.findByTestId('confirm-Unable to save file')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(<CodeEditorModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText(/Reaction Editor/i)).not.toBeInTheDocument();
  });

  it('hides edit controls in read-only mode', () => {
    render(<CodeEditorModal {...defaultProps} readOnly />);
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete Relation' })).not.toBeInTheDocument();
    expect(screen.getByText(/changes are not allowed/i)).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

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


describe('CodeEditorModal – additional tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // mock localStorage for auth.user (needed by connectToLsp)
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => {
      if (key === 'auth.user') return JSON.stringify({ id: 'user-1' });
      return null;
    });
    // suppress WebSocket in unit tests
    (globalThis as any).WebSocket = jest.fn().mockImplementation(() => ({
      readyState: 3, // CLOSED
      send: jest.fn(),
      close: jest.fn(),
      onopen: null,
      onmessage: null,
      onerror: null,
      onclose: null,
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns null when isOpen is false', () => {
    const { container } = render(<CodeEditorModal {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows unsaved changes dialog when closing with edits', async () => {
    render(<CodeEditorModal {...defaultProps} />);

    const editor = screen.getByTestId('monaco-editor');
    fireEvent.change(editor, { target: { value: 'modified code' } });

    // Click the × close button
    fireEvent.click(screen.getByTitle(/Close/i));

    expect(
      await screen.findByTestId('confirm-Unsaved Changes'),
    ).toBeInTheDocument();
  });

  it('closes without saving when "Close without saving" is confirmed', async () => {
    render(<CodeEditorModal {...defaultProps} />);

    const editor = screen.getByTestId('monaco-editor');
    fireEvent.change(editor, { target: { value: 'modified code' } });
    fireEvent.click(screen.getByTitle(/Close/i));

    await screen.findByTestId('confirm-Unsaved Changes');
    fireEvent.click(screen.getByRole('button', { name: /Close without saving/i }));

    await waitFor(() => {
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it('keeps editor open when "Keep editing" is clicked', async () => {
    render(<CodeEditorModal {...defaultProps} />);

    const editor = screen.getByTestId('monaco-editor');
    fireEvent.change(editor, { target: { value: 'modified code' } });
    fireEvent.click(screen.getByTitle(/Close/i));

    await screen.findByTestId('confirm-Unsaved Changes');
    fireEvent.click(screen.getByRole('button', { name: /Keep editing/i }));

    await waitFor(() => {
      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });
    expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
  });

  it('shows save error dialog when onSave rejects', async () => {
    const onSave = jest.fn().mockRejectedValue(new Error('Disk full'));
    render(<CodeEditorModal {...defaultProps} onSave={onSave} />);

    fireEvent.click(screen.getByTitle(/Save \(Ctrl\+S\)/i));

    expect(
      await screen.findByTestId('confirm-Unable to save file'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Disk full/i)).toBeInTheDocument();
  });

  it('closes save error dialog on OK', async () => {
    const onSave = jest.fn().mockRejectedValue(new Error('Disk full'));
    render(<CodeEditorModal {...defaultProps} onSave={onSave} />);

    fireEvent.click(screen.getByTitle(/Save \(Ctrl\+S\)/i));
    await screen.findByTestId('confirm-Unable to save file');
    fireEvent.click(screen.getByRole('button', { name: /OK/i }));

    await waitFor(() => {
      expect(screen.queryByTestId('confirm-Unable to save file')).not.toBeInTheDocument();
    });
  });

  it('shows delete relation dialog on Delete Relation click', async () => {
    const onDelete = jest.fn();
    render(<CodeEditorModal {...defaultProps} onDelete={onDelete} />);

    fireEvent.click(screen.getByTitle(/Delete relation/i));

    expect(
      await screen.findByTestId('confirm-Delete Relation'),
    ).toBeInTheDocument();
  });

  it('calls onDelete and onClose when deletion confirmed', async () => {
    const onDelete = jest.fn();
    render(<CodeEditorModal {...defaultProps} onDelete={onDelete} />);

    fireEvent.click(screen.getByTitle(/Delete relation/i));
    await screen.findByTestId('confirm-Delete Relation');
    fireEvent.click(screen.getByRole('button', { name: /Delete$/i }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it('shows clear dialog on Clear button click', async () => {
    render(<CodeEditorModal {...defaultProps} />);

    fireEvent.click(screen.getByTitle(/Clear all code/i));

    expect(
      await screen.findByTestId('confirm-Clear Code'),
    ).toBeInTheDocument();
  });

  it('shows "Unsaved changes" indicator in status bar when code is edited', () => {
    render(<CodeEditorModal {...defaultProps} />);

    const editor = screen.getByTestId('monaco-editor');
    fireEvent.change(editor, { target: { value: 'new content' } });

    expect(screen.getByText(/Unsaved changes/i)).toBeInTheDocument();
  });

  it('shows LSP Offline status when not connected', () => {
    render(<CodeEditorModal {...defaultProps} />);
    expect(screen.getByText(/LSP Offline/i)).toBeInTheDocument();
  });

  it('shows "✓ Saved" feedback after successful save', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(<CodeEditorModal {...defaultProps} onSave={onSave} />);

    fireEvent.click(screen.getByTitle(/Save \(Ctrl\+S\)/i));

    expect(await screen.findByText(/^Saved$/i)).toBeInTheDocument();
  });

  it('displays line and character count in status bar', () => {
    render(<CodeEditorModal {...defaultProps} initialCode={'line1\nline2'} />);
    expect(screen.getByText(/2 lines/i)).toBeInTheDocument();
    expect(screen.getByText(/characters/i)).toBeInTheDocument();
  });

  it('displays edge ID in status bar', () => {
    render(<CodeEditorModal {...defaultProps} edgeId="my-edge-99" />);
    expect(screen.getByText(/my-edge-99/i)).toBeInTheDocument();
  });

  it('calls onInitialize when isOpen is true', () => {
    const onInitialize = jest.fn().mockReturnValue(undefined);
    render(<CodeEditorModal {...defaultProps} onInitialize={onInitialize} />);
    expect(onInitialize).toHaveBeenCalledWith(defaultProps.initialCode);
  });
});