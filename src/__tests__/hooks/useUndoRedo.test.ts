import { renderHook, act } from '@testing-library/react';
import { useUndoRedo } from '../../hooks/useUndoRedo';

const initialState = {
    nodes: [],
    edges: [],
    idCounter: 0,
};

const stateWithNode = {
    nodes: [{ id: '1', position: { x: 0, y: 0 }, data: { label: 'Node 1' } }],
    edges: [],
    idCounter: 1,
};

const stateWithTwoNodes = {
    nodes: [
        { id: '1', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
        { id: '2', position: { x: 100, y: 0 }, data: { label: 'Node 2' } },
    ],
    edges: [],
    idCounter: 2,
};

describe('useUndoRedo', () => {

    describe('initial state', () => {
        it('should return the initial state', () => {
            const { result } = renderHook(() => useUndoRedo(initialState));
            expect(result.current.currentState).toEqual(initialState);
        });

        it('should not be able to undo or redo initially', () => {
            const { result } = renderHook(() => useUndoRedo(initialState));
            expect(result.current.canUndo).toBe(false);
            expect(result.current.canRedo).toBe(false);
        });
    });

    describe('saveState', () => {
        it('should update the current state after saving', () => {
            const { result } = renderHook(() => useUndoRedo(initialState));

            act(() => {
                result.current.saveState(stateWithNode, 'Added node');
            });

            expect(result.current.currentState).toEqual(stateWithNode);
        });

        it('should enable undo after saving a second state', () => {
            const { result } = renderHook(() => useUndoRedo(initialState));

            act(() => {
                result.current.saveState(stateWithNode, 'Added node');
            });
            act(() => {
                result.current.saveState(stateWithTwoNodes, 'Added second node');
            });

            expect(result.current.canUndo).toBe(true);
        });

        it('should strip functions from node data before saving', () => {
            const { result } = renderHook(() => useUndoRedo(initialState));
            const stateWithFunction = {
                nodes: [{ id: '1', position: { x: 0, y: 0 }, data: { label: 'Node', onClick: () => { } } }],
                edges: [],
                idCounter: 1,
            };

            // Should not throw
            expect(() => {
                act(() => {
                    result.current.saveState(stateWithFunction, 'State with function');
                });
            }).not.toThrow();
        });
    });

    describe('undo', () => {
        it('should return null if undo is not possible', () => {
            const { result } = renderHook(() => useUndoRedo(initialState));

            let undoResult: any;
            act(() => {
                undoResult = result.current.undo();
            });

            expect(undoResult).toBeNull();
        });

        it('should restore the previous state after undo', () => {
            const { result } = renderHook(() => useUndoRedo(initialState));

            act(() => { result.current.saveState(stateWithNode, 'Added node'); });
            act(() => { result.current.saveState(stateWithTwoNodes, 'Added second node'); });
            act(() => { result.current.undo(); });

            expect(result.current.currentState).toEqual(stateWithNode);
        });

        it('should enable redo after undoing', () => {
            const { result } = renderHook(() => useUndoRedo(initialState));

            act(() => { result.current.saveState(stateWithNode, 'Added node'); });
            act(() => { result.current.saveState(stateWithTwoNodes, 'Added second node'); });
            act(() => { result.current.undo(); });

            expect(result.current.canRedo).toBe(true);
        });
    });

    describe('redo', () => {
        it('should return null if redo is not possible', () => {
            const { result } = renderHook(() => useUndoRedo(initialState));

            let redoResult: any;
            act(() => {
                redoResult = result.current.redo();
            });

            expect(redoResult).toBeNull();
        });

        it('should restore the next state after redo', () => {
            const { result } = renderHook(() => useUndoRedo(initialState));

            act(() => { result.current.saveState(stateWithNode, 'Added node'); });
            act(() => { result.current.saveState(stateWithTwoNodes, 'Added second node'); });
            act(() => { result.current.undo(); });
            act(() => { result.current.redo(); });

            expect(result.current.currentState).toEqual(stateWithTwoNodes);
        });

        it('should clear redo history after saving a new state', () => {
            const { result } = renderHook(() => useUndoRedo(initialState));

            act(() => { result.current.saveState(stateWithNode, 'Added node'); });
            act(() => { result.current.saveState(stateWithTwoNodes, 'Added second node'); });
            act(() => { result.current.undo(); });

            // Save new state instead of redoing
            act(() => { result.current.saveState(stateWithNode, 'New branch'); });

            expect(result.current.canRedo).toBe(false);
        });
    });

    describe('clearHistory', () => {
        it('should disable undo and redo after clearing', () => {
            const { result } = renderHook(() => useUndoRedo(initialState));

            act(() => { result.current.saveState(stateWithNode, 'Added node'); });
            act(() => { result.current.saveState(stateWithTwoNodes, 'Added second node'); });
            act(() => { result.current.clearHistory(); });

            expect(result.current.canUndo).toBe(false);
            expect(result.current.canRedo).toBe(false);
        });
    });

    describe('getHistoryInfo', () => {
        it('should return correct history info', () => {
            const { result } = renderHook(() => useUndoRedo(initialState));

            act(() => { result.current.saveState(stateWithNode, 'Added node'); });
            act(() => { result.current.saveState(stateWithTwoNodes, 'Added second node'); });

            const info = result.current.getHistoryInfo();
            expect(info.historyLength).toBe(2);
            expect(info.lastAction).toBe('Added second node');
        });
    });

});