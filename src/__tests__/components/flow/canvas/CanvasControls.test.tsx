import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CanvasControls } from '../../../../components/flow/canvas/CanvasControls';

describe('CanvasControls', () => {
  const setup = (props: Partial<React.ComponentProps<typeof CanvasControls>> = {}) => {
    const handlers = {
      onZoomIn: jest.fn(),
      onZoomOut: jest.fn(),
      onFitView: jest.fn(),
      onToggleInteractive: jest.fn(),
    };
    render(
      <CanvasControls {...handlers} isInteractive readOnly={false} {...props} />,
    );
    return handlers;
  };

  it('renders the zoom and fit controls', () => {
    setup();

    expect(screen.getByTitle('Zoom in')).toBeInTheDocument();
    expect(screen.getByTitle('Zoom out')).toBeInTheDocument();
    expect(screen.getByTitle('Fit view')).toBeInTheDocument();
  });

  it('wires each control to its handler', () => {
    const handlers = setup();

    fireEvent.click(screen.getByTitle('Zoom in'));
    fireEvent.click(screen.getByTitle('Zoom out'));
    fireEvent.click(screen.getByTitle('Fit view'));

    expect(handlers.onZoomIn).toHaveBeenCalledTimes(1);
    expect(handlers.onZoomOut).toHaveBeenCalledTimes(1);
    expect(handlers.onFitView).toHaveBeenCalledTimes(1);
  });

  it('offers to lock interactions while unlocked', () => {
    const handlers = setup({ isInteractive: true });

    fireEvent.click(screen.getByTitle('Lock interactions'));

    expect(handlers.onToggleInteractive).toHaveBeenCalledTimes(1);
  });

  it('offers to unlock interactions while locked', () => {
    setup({ isInteractive: false });

    expect(screen.getByTitle('Unlock interactions')).toBeInTheDocument();
  });

  it('hides the lock toggle for read-only viewers but keeps zoom', () => {
    setup({ readOnly: true });

    expect(screen.queryByTitle('Lock interactions')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Unlock interactions')).not.toBeInTheDocument();
    expect(screen.getByTitle('Zoom in')).toBeInTheDocument();
  });
});
