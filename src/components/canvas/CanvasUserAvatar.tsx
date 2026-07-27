import React from 'react';

interface AvatarProps {
  initials: string;
  bg: string;
  size?: number;
  ring?: string;
  title?: string;
}

interface AvatarButtonProps extends AvatarProps {
  onClick: () => void;
  title: string;
}

function getAvatarStyle(bg: string, size: number, ring?: string): React.CSSProperties {
  return {
    width: size,
    height: size,
    borderRadius: '50%',
    background: bg,
    color: '#fff',
    fontSize: Math.round(size * 0.36),
    fontWeight: 700,
    letterSpacing: '0.01em',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    userSelect: 'none',
    boxShadow: ring
      ? `0 0 0 2px #fff, 0 0 0 4.5px ${ring}`
      : '0 0 0 2px #fff',
  };
}

export const CanvasUserAvatar: React.FC<AvatarProps> = ({ initials, bg, size = 30, ring, title }) => (
  <div title={title} style={{ ...getAvatarStyle(bg, size, ring), cursor: 'default' }}>
    {initials}
  </div>
);

export const CanvasUserAvatarButton: React.FC<AvatarButtonProps> = ({
  initials,
  bg,
  size = 30,
  ring,
  title,
  onClick,
}) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    onClick={onClick}
    style={{
      ...getAvatarStyle(bg, size, ring),
      border: 'none',
      padding: 0,
      cursor: 'pointer',
    }}
  >
    {initials}
  </button>
);
