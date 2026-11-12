import { act, renderHook } from '@testing-library/react';
import { useCanvasProjectRename } from '../../hooks/useCanvasProjectRename';

type HookOptions = Parameters<typeof useCanvasProjectRename>[0];

const createOptions = (
  overrides: Partial<HookOptions> = {},
): HookOptions => ({
  projectId: 7,
  projectName: 'Current project',
  isViewOnly: false,
  renameProject: vi.fn().mockResolvedValue(undefined),
  onRenamed: vi.fn(),
  ...overrides,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useCanvasProjectRename', () => {
  it('seeds the input and enters edit mode', () => {
    const options = createOptions();
    const { result } = renderHook(() => useCanvasProjectRename(options));

    act(() => {
      result.current.startRename();
    });

    expect(result.current.editingName).toBe(true);
    expect(result.current.nameInput).toBe('Current project');
    expect(result.current.savingName).toBe(false);
  });

  it('updates the input and cancels editing', () => {
    const options = createOptions();
    const { result } = renderHook(() => useCanvasProjectRename(options));

    act(() => {
      result.current.startRename();
      result.current.setNameInput('Draft project');
    });
    expect(result.current.nameInput).toBe('Draft project');

    act(() => {
      result.current.cancelRename();
    });

    expect(result.current.editingName).toBe(false);
    expect(result.current.nameInput).toBe('Draft project');
  });

  it('closes blank submissions without renaming', async () => {
    const renameProject = vi.fn().mockResolvedValue(undefined);
    const options = createOptions({ renameProject });
    const { result } = renderHook(() => useCanvasProjectRename(options));

    act(() => {
      result.current.startRename();
      result.current.setNameInput('   ');
    });
    await act(async () => {
      await result.current.confirmRename();
    });

    expect(renameProject).not.toHaveBeenCalled();
    expect(result.current.editingName).toBe(false);
    expect(result.current.savingName).toBe(false);
  });

  it('closes unchanged submissions without renaming', async () => {
    const renameProject = vi.fn().mockResolvedValue(undefined);
    const options = createOptions({ renameProject });
    const { result } = renderHook(() => useCanvasProjectRename(options));

    act(() => {
      result.current.startRename();
    });
    await act(async () => {
      await result.current.confirmRename();
    });

    expect(renameProject).not.toHaveBeenCalled();
    expect(result.current.editingName).toBe(false);
    expect(result.current.savingName).toBe(false);
  });

  it('closes submissions without a project ID and does not rename', async () => {
    const renameProject = vi.fn().mockResolvedValue(undefined);
    const options = createOptions({
      projectId: undefined,
      renameProject,
    });
    const { result } = renderHook(() => useCanvasProjectRename(options));

    act(() => {
      result.current.startRename();
      result.current.setNameInput('Renamed project');
    });
    await act(async () => {
      await result.current.confirmRename();
    });

    expect(renameProject).not.toHaveBeenCalled();
    expect(result.current.editingName).toBe(false);
    expect(result.current.savingName).toBe(false);
  });

  it('prevents view-only confirmation without renaming', async () => {
    const renameProject = vi.fn().mockResolvedValue(undefined);
    const options = createOptions({
      isViewOnly: true,
      renameProject,
    });
    const { result } = renderHook(() => useCanvasProjectRename(options));

    act(() => {
      result.current.startRename();
      result.current.setNameInput('Renamed project');
    });
    await act(async () => {
      await result.current.confirmRename();
    });

    expect(renameProject).not.toHaveBeenCalled();
    expect(result.current.editingName).toBe(true);
    expect(result.current.savingName).toBe(false);
  });

  it('renames with the trimmed input and notifies success', async () => {
    const renameProject = vi.fn().mockResolvedValue({ status: 200 });
    const onRenamed = vi.fn();
    const options = createOptions({ renameProject, onRenamed });
    const { result } = renderHook(() => useCanvasProjectRename(options));

    act(() => {
      result.current.startRename();
      result.current.setNameInput('  Renamed project  ');
    });
    await act(async () => {
      await result.current.confirmRename();
    });

    expect(renameProject).toHaveBeenCalledWith(7, 'Renamed project');
    expect(onRenamed).toHaveBeenCalledWith('Renamed project');
    expect(result.current.editingName).toBe(false);
    expect(result.current.savingName).toBe(false);
  });

  it('logs rename failure without notifying success and resets state', async () => {
    const error = new Error('Rename rejected');
    const renameProject = vi.fn().mockRejectedValue(error);
    const onRenamed = vi.fn();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const options = createOptions({ renameProject, onRenamed });
    const { result } = renderHook(() => useCanvasProjectRename(options));

    act(() => {
      result.current.startRename();
      result.current.setNameInput('Renamed project');
    });
    await act(async () => {
      await result.current.confirmRename();
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('Rename failed:', error);
    expect(onRenamed).not.toHaveBeenCalled();
    expect(result.current.editingName).toBe(false);
    expect(result.current.savingName).toBe(false);
  });

  it('keeps saving state active while rename is pending', async () => {
    let resolveRename: ((value: unknown) => void) | undefined;
    const renameProject = vi.fn(() => new Promise<unknown>(resolve => {
      resolveRename = resolve;
    }));
    const onRenamed = vi.fn();
    const options = createOptions({ renameProject, onRenamed });
    const { result } = renderHook(() => useCanvasProjectRename(options));

    act(() => {
      result.current.startRename();
      result.current.setNameInput('Renamed project');
    });

    let confirmation: Promise<void> | undefined;
    act(() => {
      confirmation = result.current.confirmRename();
    });

    expect(result.current.savingName).toBe(true);
    expect(result.current.editingName).toBe(true);
    expect(onRenamed).not.toHaveBeenCalled();

    await act(async () => {
      resolveRename?.(undefined);
      await confirmation;
    });

    expect(onRenamed).toHaveBeenCalledWith('Renamed project');
    expect(result.current.savingName).toBe(false);
    expect(result.current.editingName).toBe(false);
  });
});
