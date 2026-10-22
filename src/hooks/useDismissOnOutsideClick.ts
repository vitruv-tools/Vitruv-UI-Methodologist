import { RefObject, useEffect } from 'react';

/** Close a popover/menu when the user clicks outside the container ref. */
export function useDismissOnOutsideClick(
  containerRef: RefObject<HTMLElement | null>,
  isActive: boolean,
  onDismiss: () => void,
): void {
  useEffect(() => {
    if (!isActive) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isActive, onDismiss, containerRef]);
}
