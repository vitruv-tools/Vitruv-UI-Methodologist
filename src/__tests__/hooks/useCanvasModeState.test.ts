import { act, renderHook } from '@testing-library/react';
import type { Node } from 'reactflow';
import { useCanvasModeState } from '../../hooks/useCanvasModeState';
import {
  readStoredCanvasMode,
  writeStoredCanvasMode,
} from '../../utils/canvasModeStorage';

jest.mock('../../utils/canvasModeStorage', () => ({
  readStoredCanvasMode: jest.fn(),
  writeStoredCanvasMode: jest.fn(),
}));

const mockReadStoredCanvasMode = readStoredCanvasMode as jest.MockedFunction<typeof readStoredCanvasMode>;
const mockWriteStoredCanvasMode = writeStoredCanvasMode as jest.MockedFunction<typeof writeStoredCanvasMode>;

const canvasNodes: Node[] = [
  {
    id: 'node-1',
    position: { x: 10, y: 20 },
    data: { label: 'Node 1' },
  },
];

describe('useCanvasModeState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReadStoredCanvasMode.mockReturnValue('modeling');
  });

  it('uses the initial stored mode', () => {
    mockReadStoredCanvasMode.mockReturnValue('constraints');

    const { result } = renderHook(() => useCanvasModeState({
      projectId: 7,
      isViewOnly: false,
      getCanvasNodes: () => [],
    }));

    expect(result.current.canvasMode).toBe('constraints');
    expect(result.current.canvasModeRef.current).toBe('constraints');
    expect(mockReadStoredCanvasMode).toHaveBeenCalledWith(7);
  });

  it('snapshots nodes and persists when switching to constraints', () => {
    const getCanvasNodes = jest.fn(() => canvasNodes);
    const { result } = renderHook(() => useCanvasModeState({
      projectId: 7,
      isViewOnly: false,
      getCanvasNodes,
    }));

    act(() => {
      result.current.handleCanvasModeChange('constraints');
    });

    expect(getCanvasNodes).toHaveBeenCalledTimes(1);
    expect(result.current.constraintsNodes).toEqual(canvasNodes);
    expect(result.current.canvasMode).toBe('constraints');
    expect(mockWriteStoredCanvasMode).toHaveBeenCalledWith(7, 'constraints');
  });

  it('clears highlight and filter state when switching back to modeling', () => {
    const { result } = renderHook(() => useCanvasModeState({
      projectId: 7,
      isViewOnly: false,
      getCanvasNodes: () => canvasNodes,
    }));

    act(() => {
      result.current.handleCanvasModeChange('constraints');
      result.current.setConstraintHighlightNodeId('highlighted-node');
      result.current.setConstraintFilterNodeId('filtered-node');
    });
    act(() => {
      result.current.handleCanvasModeChange('modeling');
    });

    expect(result.current.canvasMode).toBe('modeling');
    expect(result.current.constraintHighlightNodeId).toBeNull();
    expect(result.current.constraintFilterNodeId).toBeNull();
    expect(mockWriteStoredCanvasMode).toHaveBeenCalledWith(7, 'modeling');
  });

  it('prevents view-only users from switching to constraints', () => {
    const getCanvasNodes = jest.fn(() => canvasNodes);
    const { result } = renderHook(() => useCanvasModeState({
      projectId: 7,
      isViewOnly: true,
      getCanvasNodes,
    }));
    mockWriteStoredCanvasMode.mockClear();

    act(() => {
      result.current.handleCanvasModeChange('constraints');
    });

    expect(result.current.canvasMode).toBe('modeling');
    expect(result.current.canvasModeRef.current).toBe('modeling');
    expect(getCanvasNodes).not.toHaveBeenCalled();
    expect(mockWriteStoredCanvasMode).not.toHaveBeenCalled();
  });

  it('coerces stored constraints mode for a view-only project', () => {
    mockReadStoredCanvasMode.mockReturnValue('constraints');

    const { result } = renderHook(() => useCanvasModeState({
      projectId: 7,
      isViewOnly: true,
      getCanvasNodes: () => [],
    }));

    expect(result.current.canvasMode).toBe('modeling');
    expect(result.current.canvasModeRef.current).toBe('modeling');
    expect(mockWriteStoredCanvasMode).toHaveBeenCalledWith(7, 'modeling');
  });

  it('loads the stored mode when the project changes', () => {
    mockReadStoredCanvasMode.mockImplementation(projectId => (
      projectId === 8 ? 'constraints' : 'modeling'
    ));
    const getCanvasNodes = () => canvasNodes;
    const { result, rerender } = renderHook(
      ({ projectId }) => useCanvasModeState({
        projectId,
        isViewOnly: false,
        getCanvasNodes,
      }),
      { initialProps: { projectId: 7 } },
    );

    rerender({ projectId: 8 });

    expect(mockReadStoredCanvasMode).toHaveBeenCalledWith(8);
    expect(result.current.canvasMode).toBe('constraints');
    expect(result.current.canvasModeRef.current).toBe('constraints');
  });

  it('keeps canvasModeRef synchronized with mode changes', () => {
    mockReadStoredCanvasMode.mockReturnValue('views');
    const { result } = renderHook(() => useCanvasModeState({
      projectId: 7,
      isViewOnly: false,
      getCanvasNodes: () => canvasNodes,
    }));

    expect(result.current.canvasModeRef.current).toBe('views');

    act(() => {
      result.current.handleCanvasModeChange('constraints');
    });
    expect(result.current.canvasModeRef.current).toBe('constraints');

    act(() => {
      result.current.handleCanvasModeChange('modeling');
    });
    expect(result.current.canvasModeRef.current).toBe('modeling');
  });
});
