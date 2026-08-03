import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  CanvasPopupNotification,
  CanvasPopupNotificationType,
} from '../../../components/canvas/CanvasPopupNotification';

describe('CanvasPopupNotification', () => {
  it.each<{
    type: CanvasPopupNotificationType;
    background: string;
    border: string;
    color: string;
  }>([
    {
      type: 'success',
      background: '#f0fdf4',
      border: '1px solid #86efac',
      color: '#15803d',
    },
    {
      type: 'error',
      background: '#fef2f2',
      border: '1px solid #fca5a5',
      color: '#dc2626',
    },
    {
      type: 'info',
      background: '#eff6ff',
      border: '1px solid #bfdbfe',
      color: '#1d4ed8',
    },
  ])('renders the $type visual theme', ({ type, background, border, color }) => {
    render(<CanvasPopupNotification message={`${type} message`} type={type} />);

    expect(screen.getByText(`${type} message`)).toHaveStyle({
      background,
      border,
      color,
    });
  });

  it('preserves multiline messages within a scrollable notification', () => {
    render(<CanvasPopupNotification message={'First line\nSecond line'} type="info" />);

    expect(screen.getByText(/First line/)).toHaveStyle({
      maxHeight: '60vh',
      overflowY: 'auto',
      whiteSpace: 'pre-wrap',
      overflowWrap: 'anywhere',
    });
  });
});
