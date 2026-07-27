import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  CanvasUserAvatar,
  CanvasUserAvatarButton,
} from '../../../components/canvas/CanvasUserAvatar';

describe('CanvasUserAvatar', () => {
  it('renders initials, title, and the default size', () => {
    render(<CanvasUserAvatar initials="AI" bg="#2563eb" title="Ahmed Ibrahim" />);

    const avatar = screen.getByText('AI');

    expect(avatar).toHaveAttribute('title', 'Ahmed Ibrahim');
    expect(avatar).toHaveStyle({
      width: '30px',
      height: '30px',
      cursor: 'default',
    });
  });

  it('renders a supplied size and ring styling', () => {
    render(
      <CanvasUserAvatar
        initials="AI"
        bg="#2563eb"
        size={36}
        ring="#049484"
      />,
    );

    const avatar = screen.getByText('AI');

    expect(avatar).toHaveStyle({
      width: '36px',
      height: '36px',
      boxShadow: '0 0 0 2px #fff, 0 0 0 4.5px #049484',
    });
  });

  it('uses the supplied title as its accessible name and invokes its callback', () => {
    const onClick = jest.fn();
    render(
      <CanvasUserAvatarButton
        initials="AI"
        bg="#2563eb"
        title="My account"
        onClick={onClick}
      />,
    );

    const button = screen.getByRole('button', { name: 'My account' });

    expect(button).toHaveAttribute('title', 'My account');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not render the static avatar as a button', () => {
    render(<CanvasUserAvatar initials="AI" bg="#2563eb" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
