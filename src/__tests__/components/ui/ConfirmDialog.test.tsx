import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';

describe('ConfirmDialog', () => {
  it('renders title and message and calls callbacks', () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();

    render(
      <ConfirmDialog
        isOpen
        title="Delete item"
        message="Are you sure?"
        confirmText="Yes"
        cancelText="No"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByText(/Delete item/i)).toBeInTheDocument();
    expect(screen.getByText(/Are you sure\?/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText('No'));
    expect(onCancel).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Yes'));
    expect(onConfirm).toHaveBeenCalled();
  });
  it('stacks on the modal layer by default and above a given z-index when requested', () => {
    const backdrop = () => screen
      .getAllByRole('button', { hidden: true })
      .find(button => button.getAttribute('aria-hidden') === 'true');

    const { rerender } = render(
      <ConfirmDialog isOpen onConfirm={jest.fn()} onCancel={jest.fn()} />,
    );
    expect(backdrop()).toHaveStyle({ zIndex: '10000' });

    rerender(<ConfirmDialog isOpen zIndex={10003} onConfirm={jest.fn()} onCancel={jest.fn()} />);
    expect(backdrop()).toHaveStyle({ zIndex: '10003' });
    // eslint-disable-next-line testing-library/no-node-access
    expect(screen.getByRole('alertdialog').parentElement).toHaveStyle({ zIndex: '10004' });
  });
});

