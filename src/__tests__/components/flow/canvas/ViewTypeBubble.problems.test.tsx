import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ViewTypeBubble } from '../../../../components/flow/canvas/ViewTypeBubble';

const props = {
  id: 'vt-1', label: 'V', scope: 'single' as const, cx: 50, cy: 50,
  onDragStart: vi.fn(), onDrag: vi.fn(), onDragEnd: vi.fn(), onClick: vi.fn(),
};

describe('ViewTypeBubble problem marker', () => {
  it('shows no marker without problems', () => {
    render(<svg><ViewTypeBubble {...props} /></svg>);
    expect(screen.queryByTestId('vt-problem-marker-vt-1')).toBeNull();
  });

  it('shows the number of problems', () => {
    render(<svg><ViewTypeBubble {...props} problemCount={2} /></svg>);
    expect(screen.getByTestId('vt-problem-marker-vt-1').textContent).toContain('2');
  });
});
