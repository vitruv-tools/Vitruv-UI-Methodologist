import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { UnsavedTabCloseDialog } from '../../../components/canvas/UnsavedTabCloseDialog';

vi.mock('react-dom', async () => {
  const actual = await vi.importActual<any>('react-dom');
  const mocked = {
    ...actual,
    createPortal: (node: React.ReactNode) => node,
  };
  return { ...mocked, default: mocked };
});

describe('UnsavedTabCloseDialog', () => {
  it('returns null when closed', () => {
    const { container } = render(
      <UnsavedTabCloseDialog
        isOpen={false}
        onSave={vi.fn()}
        onCloseWithoutSaving={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows project name in the message when provided', () => {
    render(
      <UnsavedTabCloseDialog
        isOpen
        projectName="My Project"
        onSave={vi.fn()}
        onCloseWithoutSaving={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText(/"My Project" has unsaved changes/i)).toBeInTheDocument();
  });

  it('invokes callbacks for save, discard, and cancel', () => {
    const onSave = vi.fn();
    const onCloseWithoutSaving = vi.fn();
    const onCancel = vi.fn();
    render(
      <UnsavedTabCloseDialog
        isOpen
        onSave={onSave}
        onCloseWithoutSaving={onCloseWithoutSaving}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    fireEvent.click(screen.getByRole('button', { name: /close without saving/i }));
    fireEvent.click(document.querySelector('button[aria-hidden="true"]')!);

    expect(onSave).toHaveBeenCalled();
    expect(onCloseWithoutSaving).toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });
});
