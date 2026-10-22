import { render, screen, fireEvent } from '@testing-library/react';
import { HoverTooltip } from '../../../components/ui/HoverTooltip';

describe('HoverTooltip', () => {
  it('shows tooltip label and description on hover', () => {
    render(
      <HoverTooltip label="Save" description="Save changes to this project">
        <button type="button">Icon</button>
      </HoverTooltip>,
    );

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Icon' }));

    expect(screen.getByRole('tooltip')).toHaveTextContent('Save');
    expect(screen.getByRole('tooltip')).toHaveTextContent('Save changes to this project');
  });
});
