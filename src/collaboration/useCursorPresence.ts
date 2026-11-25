import { useEffect, useRef, useState } from 'react';
import type { Awareness } from 'y-protocols/awareness';
import { CursorPresence, readRemoteCursors, type CursorPoint, type RemoteCursor } from './cursorPresence';

/** The cursors of the other users, kept up to date while `awareness` changes. */
export function useRemoteCursors(awareness: Awareness | null | undefined): RemoteCursor[] {
  const [cursors, setCursors] = useState<RemoteCursor[]>([]);
  useEffect(() => {
    if (!awareness) {
      setCursors([]);
      return undefined;
    }
    const update = () => setCursors(readRemoteCursors(awareness));
    update();
    awareness.on('change', update);
    return () => {
      awareness.off('change', update);
    };
  }, [awareness]);
  return cursors;
}

export interface LocalCursor {
  /** Reports the mouse position in canvas coordinates. */
  move(point: CursorPoint): void;
  /** The mouse left the canvas. */
  leave(): void;
}

/**
 * Publishes the local user's cursor through `awareness` for as long as the component is there.
 * Does nothing without awareness (no collaboration server). The cursor is taken away when the
 * component unmounts or the awareness changes.
 */
export function useLocalCursor(awareness: Awareness | null | undefined, name: string): LocalCursor {
  const presence = useRef<CursorPresence | null>(null);
  useEffect(() => {
    if (!awareness) {
      return undefined;
    }
    const created = new CursorPresence(awareness, { name });
    presence.current = created;
    return () => {
      created.destroy();
      if (presence.current === created) {
        presence.current = null;
      }
    };
  }, [awareness, name]);
  const [local] = useState<LocalCursor>(() => ({
    move: (point) => presence.current?.move(point),
    leave: () => presence.current?.leave(),
  }));
  return local;
}
