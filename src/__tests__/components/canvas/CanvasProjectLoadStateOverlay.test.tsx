import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { CanvasProjectLoadStateOverlay } from '../../../components/canvas/CanvasProjectLoadStateOverlay';

describe('CanvasProjectLoadStateOverlay', () => {
  it('shows project-specific loading text without actions', () => {
    render(
      <CanvasProjectLoadStateOverlay
        state={{ status: 'loading' }}
        projectId={42}
        onBack={jest.fn()}
        onRetry={jest.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Loading project…' })).toBeInTheDocument();
    expect(screen.getByText('Checking access for project 42.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows a back action for non-retryable failures', () => {
    const onBack = jest.fn();
    render(
      <CanvasProjectLoadStateOverlay
        state={{ status: 'forbidden' }}
        onBack={onBack}
        onRetry={jest.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to project list' }));

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  it('shows the supplied error and invokes retry', () => {
    const onRetry = jest.fn();
    render(
      <CanvasProjectLoadStateOverlay
        state={{ status: 'error', message: 'Network unavailable.' }}
        onBack={jest.fn()}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText('Network unavailable.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
