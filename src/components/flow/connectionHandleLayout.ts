import { CSSProperties } from 'react';

export type HandlePosition = 'top' | 'bottom' | 'left' | 'right';

export function tipFromHandleRect(
  rect: DOMRect,
  handle: HandlePosition,
): { x: number; y: number } {
  switch (handle) {
    case 'top':
      return { x: rect.left + rect.width / 2, y: rect.top };
    case 'bottom':
      return { x: rect.left + rect.width / 2, y: rect.bottom };
    case 'left':
      return { x: rect.left, y: rect.top + rect.height / 2 };
    case 'right':
      return { x: rect.right, y: rect.top + rect.height / 2 };
  }
}

export function connectionHandlePositionStyle(
  position: HandlePosition,
  offset: number,
  hoverOffset: string,
  isHovered: boolean,
): CSSProperties {
  const base: CSSProperties = {
    position: 'absolute',
    cursor: 'crosshair',
    transition: 'all 0.2s ease',
    zIndex: 1000,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const scale = isHovered ? 'scale(1.3)' : 'scale(1)';

  const layouts: Record<HandlePosition, CSSProperties> = {
    top: {
      bottom: '100%',
      left: `calc(50% + ${offset}px)`,
      marginBottom: hoverOffset,
      transform: `translateX(-50%) ${scale}`,
    },
    bottom: {
      top: '100%',
      left: `calc(50% + ${offset}px)`,
      marginTop: hoverOffset,
      transform: `translateX(-50%) ${scale}`,
    },
    left: {
      right: '100%',
      top: `calc(50% + ${offset}px)`,
      marginRight: hoverOffset,
      transform: `translateY(-50%) ${scale}`,
    },
    right: {
      left: '100%',
      top: `calc(50% + ${offset}px)`,
      marginLeft: hoverOffset,
      transform: `translateY(-50%) ${scale}`,
    },
  };

  return { ...base, ...layouts[position] };
}
