import { renderHook, act } from '@testing-library/react';
import { useUmlEditHistory } from '../../hooks/useUmlEditHistory';

const snap = (id: string) => ({
  classes: [{ id, name: id, isAbstract: false, isInterface: false, attributes: [], x: 0, y: 0 }],
  relationships: [],
});

describe('useUmlEditHistory', () => {
  it('supports undo and redo', () => {
    const { result } = renderHook(() => useUmlEditHistory());

    act(() => {
      result.current.recordBeforeChange(snap('A'));
    });
    expect(result.current.canUndo).toBe(true);

    let restored: ReturnType<typeof result.current.undo> = null;
    act(() => {
      restored = result.current.undo(snap('B'));
    });
    expect(restored?.classes[0].id).toBe('A');
    expect(result.current.canRedo).toBe(true);

    act(() => {
      restored = result.current.redo(snap('A'));
    });
    expect(restored?.classes[0].id).toBe('B');
  });

  it('clears history', () => {
    const { result } = renderHook(() => useUmlEditHistory());
    act(() => {
      result.current.recordBeforeChange(snap('A'));
      result.current.clearHistory();
    });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });
});
