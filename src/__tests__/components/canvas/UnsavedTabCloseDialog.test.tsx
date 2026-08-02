import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { UnsavedTabCloseDialog } from '../../../components/canvas/UnsavedTabCloseDialog';

jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (node: React.ReactNode) => node,
}));

describe('UnsavedTabCloseDialog', () => {
  it('returns null when closed', () => {
    const { container } = render(
      <UnsavedTabCloseDialog
        isOpen={false}
        onSave={jest.fn()}
        onCloseWithoutSaving={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows project name in the message when provided', () => {
    render(
      <UnsavedTabCloseDialog
        isOpen
        projectName="My Project"
        onSave={jest.fn()}
        onCloseWithoutSaving={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.getByText(/"My Project" has unsaved changes/i)).toBeInTheDocument();
  });

  it('invokes callbacks for save, discard, and cancel', () => {
    const onSave = jest.fn();
    const onCloseWithoutSaving = jest.fn();
    const onCancel = jest.fn();
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
