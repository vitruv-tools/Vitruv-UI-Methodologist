import React from 'react';
import { render, screen } from '@testing-library/react';
import { ActionButton } from '../../../components/ui/ActionButton';

describe('ActionButton', () => {
  it('renders children and respects disabled state', () => {
    render(<ActionButton disabled>Save</ActionButton>);
    const btn = screen.getByRole('button', { name: 'Save' });
    expect(btn).toBeDisabled();
  });

  it('renders primary and danger variants', () => {
    const { rerender } = render(<ActionButton variant="primary">Go</ActionButton>);
    expect(screen.getByRole('button', { name: 'Go' })).toBeInTheDocument();
    rerender(<ActionButton variant="danger">Delete</ActionButton>);
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });
});
