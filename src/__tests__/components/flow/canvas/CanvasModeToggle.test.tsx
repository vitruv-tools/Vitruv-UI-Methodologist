import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CanvasModeToggle } from '../../../../components/flow/canvas/CanvasModeToggle';

describe('CanvasModeToggle', () => {
  const setup = (props: Partial<React.ComponentProps<typeof CanvasModeToggle>> = {}) => {
    const onSelectMode = jest.fn();
    render(
      <CanvasModeToggle
        activeCanvasMode="modeling"
        onSelectMode={onSelectMode}
        readOnly={false}
        {...props}
      />,
    );
    return { onSelectMode };
  };

  it('offers all four modes when editing is allowed', () => {
    setup();

    expect(screen.getByRole('button', { name: /modeling/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /constraints/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /views/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /metrics/i })).toBeInTheDocument();
  });

  it('hides Constraints for read-only viewers', () => {
    setup({ readOnly: true });

    expect(screen.queryByRole('button', { name: /constraints/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /modeling/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /views/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /metrics/i })).toBeInTheDocument();
  });

  it('reports the selected mode', () => {
    const { onSelectMode } = setup();

    fireEvent.click(screen.getByRole('button', { name: /views/i }));

    expect(onSelectMode).toHaveBeenCalledWith('views');
  });

  it('reports Metrics as the selected mode', () => {
    const { onSelectMode } = setup();

    fireEvent.click(screen.getByRole('button', { name: /metrics/i }));

    expect(onSelectMode).toHaveBeenCalledWith('metrics');
  });

  it('reports a re-click of the already active mode', () => {
    const { onSelectMode } = setup({ activeCanvasMode: 'views' });

    fireEvent.click(screen.getByRole('button', { name: /views/i }));

    expect(onSelectMode).toHaveBeenCalledWith('views');
  });

  it('renders the slot beneath the toggle', () => {
    setup({ projectTabsBelowModeToggle: <div data-testid="project-tabs" /> });

    expect(screen.getByTestId('project-tabs')).toBeInTheDocument();
  });
});
