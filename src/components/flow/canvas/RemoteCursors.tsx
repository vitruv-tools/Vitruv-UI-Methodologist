import React from 'react';
import type { RemoteCursor } from '../../../collaboration/cursorPresence';

interface RemoteCursorsProps {
  cursors: readonly RemoteCursor[];
  /** The canvas's pan and zoom, to place canvas coordinates on the screen. */
  viewport: { x: number; y: number; zoom: number };
}

/** The other users' cursors, each with a circle of the user's initials above it. */
export function RemoteCursors({ cursors, viewport }: Readonly<RemoteCursorsProps>) {
  if (cursors.length === 0) return null;
  return (
    <div
      data-testid="remote-cursors"
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 5 }}
    >
      {cursors.map((cursor) => (
        <div
          key={cursor.clientId}
          data-testid="remote-cursor"
          data-client-id={cursor.clientId}
          title={cursor.name}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            transform: `translate(${cursor.x * viewport.zoom + viewport.x}px, ${cursor.y * viewport.zoom + viewport.y}px)`,
            transition: 'transform 60ms linear',
            willChange: 'transform',
          }}
        >
          <svg width="18" height="22" viewBox="0 0 18 22" style={{ display: 'block' }} aria-hidden="true">
            <path d="M1 1 L1 17 L5.5 13 L9 21 L12 19.7 L8.6 12 L15 12 Z" fill={cursor.color} stroke="#fff" strokeWidth="1.2" strokeLinejoin="round" />
          </svg>
          <span
            data-testid="remote-cursor-initials"
            style={{
              position: 'absolute',
              left: 8,
              bottom: 20,
              minWidth: 22,
              height: 22,
              padding: '0 3px',
              boxSizing: 'border-box',
              borderRadius: 11,
              background: cursor.color,
              color: '#fff',
              border: '1.5px solid #fff',
              fontSize: 10,
              fontWeight: 700,
              lineHeight: '19px',
              textAlign: 'center',
              whiteSpace: 'nowrap',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }}
          >
            {cursor.initials}
          </span>
        </div>
      ))}
    </div>
  );
}
