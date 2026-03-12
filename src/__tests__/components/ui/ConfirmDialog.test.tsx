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
});

