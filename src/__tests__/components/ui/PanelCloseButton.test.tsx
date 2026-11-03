import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { PanelCloseButton } from '../../../components/ui/PanelCloseButton';

describe('PanelCloseButton', () => {
  it('closes the panel and is named for assistive technology', () => {
    const onClick = vi.fn();
    render(<PanelCloseButton label="Close semantic overlap" onClick={onClick} />);
    const button = screen.getByRole('button', { name: 'Close semantic overlap' });
    expect(button).toHaveAttribute('title', 'Close');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('highlights on hover and resets afterwards', () => {
    render(<PanelCloseButton label="Close" onClick={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Close' });
    fireEvent.mouseEnter(button);
    expect(button.style.background).toBe('rgb(4, 148, 132)');
    fireEvent.mouseLeave(button);
    expect(button.style.background).toBe('var(--v-surface-muted)');
  });
});
