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

  it('calls onSave and then onClose when Save is clicked', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();

    render(
      <CodeEditorModal
        {...defaultProps}
        onSave={onSave}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Save/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('initial code');
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('shows error dialog if save fails', async () => {
    const onSave = jest.fn().mockRejectedValue(new Error('Save failed'));

    render(
      <CodeEditorModal
        {...defaultProps}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Save/i }));

    expect(await screen.findByTestId('confirm-Unable to save file')).toBeInTheDocument();
  });
});

