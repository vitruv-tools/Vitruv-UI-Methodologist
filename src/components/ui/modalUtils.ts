import { useEffect } from 'react';
import type React from 'react';

/** Base z-index for full-screen modals — above app chrome (header, sidebars, pills). */
export const MODAL_Z_INDEX = 10000;

export const modalBackdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  border: 'none',
  padding: 0,
  margin: 0,
  width: '100%',
  height: '100%',
  cursor: 'default',
};

export const modalDialogShellStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'transparent',
  border: 'none',
  padding: 0,
  margin: 0,
  width: '100%',
  height: '100%',
  maxWidth: '100%',
  maxHeight: '100%',
  display: 'grid',
  placeItems: 'center',
  zIndex: MODAL_Z_INDEX,
};

/** Prevent background scroll and interaction while a modal is open. */
export function useModalBodyLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [active]);
}

const APP_PORTAL_ROOT_ID = 'vitruv-app-portal';

/** Dedicated mount node for fullscreen overlays (avoids ad-hoc document.body portals). */
export function getAppPortalRoot(): HTMLElement {
  let root = document.getElementById(APP_PORTAL_ROOT_ID);
  if (!root) {
    root = document.createElement('div');
    root.id = APP_PORTAL_ROOT_ID;
    document.body.appendChild(root);
  }
  return root;
}
