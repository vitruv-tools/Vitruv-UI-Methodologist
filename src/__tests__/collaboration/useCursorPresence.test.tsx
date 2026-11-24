import { act, renderHook } from '@testing-library/react';
import { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';
import { useLocalCursor, useRemoteCursors } from '../../collaboration/useCursorPresence';

const newAwareness = () => new Awareness(new Y.Doc());

describe('useRemoteCursors', () => {
  it('is empty without awareness', () => {
    const { result } = renderHook(() => useRemoteCursors(null));
    expect(result.current).toEqual([]);
  });

  it('follows the cursors of the others as they come, move and go', () => {
    const awareness = newAwareness();
    const { result } = renderHook(() => useRemoteCursors(awareness));

    act(() => {
      awareness.states.set(7, { user: { name: 'Ahmed Ibrahim', color: '#3cb44b' }, cursor: { x: 1, y: 2 } });
      awareness.emit('change', [{ added: [7], updated: [], removed: [] }, 'test']);
    });
    expect(result.current).toMatchObject([{ clientId: 7, initials: 'AI', x: 1, y: 2 }]);

    act(() => {
      awareness.states.set(7, { user: { name: 'Ahmed Ibrahim', color: '#3cb44b' }, cursor: null });
      awareness.emit('change', [{ added: [], updated: [7], removed: [] }, 'test']);
    });
    expect(result.current).toEqual([]);
  });

  it('stops listening when it unmounts', () => {
    const awareness = newAwareness();
    const { unmount } = renderHook(() => useRemoteCursors(awareness));
    unmount();
    expect(awareness.listenerCount?.('change') ?? 0).toBe(0);
  });
});

describe('useLocalCursor', () => {
  it('does nothing without awareness', () => {
    const { result } = renderHook(() => useLocalCursor(null, 'Ahmed'));
    expect(() => {
      result.current.move({ x: 1, y: 1 });
      result.current.leave();
    }).not.toThrow();
  });

  it('publishes the name, the position and the leaving', () => {
    const awareness = newAwareness();
    const { result } = renderHook(() => useLocalCursor(awareness, 'Ahmed Ibrahim'));
    expect((awareness.getLocalState() as any).user.name).toBe('Ahmed Ibrahim');

    act(() => result.current.move({ x: 5, y: 6 }));
    expect((awareness.getLocalState() as any).cursor).toEqual({ x: 5, y: 6 });

    act(() => result.current.leave());
    expect((awareness.getLocalState() as any).cursor).toBeNull();
  });

  it('takes the cursor away when it unmounts', () => {
    const awareness = newAwareness();
    const { result, unmount } = renderHook(() => useLocalCursor(awareness, 'Ahmed'));
    act(() => result.current.move({ x: 5, y: 6 }));

    unmount();

    expect((awareness.getLocalState() as any).cursor).toBeNull();
  });
});
