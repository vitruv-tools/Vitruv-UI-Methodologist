import { fireEvent, render, screen } from '@testing-library/react';
import { ApproachSelector } from '../../../components/semanticOverlap/ApproachSelector';

describe('ApproachSelector', () => {
  it('shows both approaches and marks the current one', () => {
    render(<ApproachSelector value="paper" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Kessentini et al. 2014 (paper)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Improved' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('reports the chosen approach', () => {
    const onChange = vi.fn();
    render(<ApproachSelector value="paper" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Improved' }));
    expect(onChange).toHaveBeenCalledWith('improved');
  });

  it('is disabled while an analysis runs', () => {
    render(<ApproachSelector value="paper" onChange={vi.fn()} disabled />);
    expect(screen.getByRole('button', { name: 'Improved' })).toBeDisabled();
  });
});
