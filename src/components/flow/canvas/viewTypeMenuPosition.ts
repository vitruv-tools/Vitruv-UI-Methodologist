import { useLayoutEffect, useRef, useState } from 'react';

const MARGIN = 8;

/** Keeps a fixed menu inside the window, above the point where it was opened. */
export function useAnchoredMenuPosition<T extends HTMLElement>(x: number, y: number, watch?: unknown) {
  const ref = useRef<T>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const menu = ref.current;
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
    const maxLeft = Math.max(MARGIN, window.innerWidth - rect.width - MARGIN);
    const maxTop = Math.max(MARGIN, window.innerHeight - rect.height - MARGIN);
    setPos({
      left: Math.min(Math.max(MARGIN, x), maxLeft),
      top: Math.min(Math.max(MARGIN, y), maxTop),
    });
  }, [x, y, watch]);

  return { ref, style: { left: pos.left, top: pos.top } as const };
}
