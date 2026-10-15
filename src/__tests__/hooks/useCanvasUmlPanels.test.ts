import { act, renderHook } from '@testing-library/react';
import type { Node } from 'reactflow';
import { useCanvasUmlPanels } from '../../hooks/useCanvasUmlPanels';
import type { CanvasUmlPanelState } from '../../types/canvasTab';

type HookOptions = Parameters<typeof useCanvasUmlPanels>[0];

const clientHeightDescriptor = Object.getOwnPropertyDescriptor(
  document.documentElement,
  'clientHeight',
);

const createPanel = (
  overrides: Partial<CanvasUmlPanelState> = {},
): CanvasUmlPanelState => ({
  id: 'panel-1',
  title: 'Library',
  fileName: 'library.ecore',
  ecoreContent: '<original />',
  metaModelId: 10,
  metaModelSourceId: 20,
  ecoreFileId: 30,
  layoutScopeId: 'vsum-7',
  layoutStorageKey: 'metamodel-20-library.ecore',
  top: 66,
  right: 16,
  width: 200,
  height: 706,
  ...overrides,
});

const createOptions = (
  overrides: Partial<HookOptions> = {},
): HookOptions => ({
  activeProjectId: 7,
  openTabCount: 0,
  isViewOnly: false,
  getCanvasNodes: () => [],
  fetchEcoreFile: jest.fn().mockResolvedValue('<fetched />'),
  updateEcoreFileData: jest.fn(),
  persistProjectEcore: jest.fn().mockResolvedValue(undefined),
  onLoadError: jest.fn(),
  ...overrides,
});

beforeAll(() => {
  Object.defineProperty(document.documentElement, 'clientHeight', {
    configurable: true,
    value: 1000,
  });
});

afterAll(() => {
  if (clientHeightDescriptor) {
    Object.defineProperty(document.documentElement, 'clientHeight', clientHeightDescriptor);
  } else {
    Reflect.deleteProperty(document.documentElement, 'clientHeight');
  }
});

beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(1234);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useCanvasUmlPanels', () => {
  it('opens and focuses a panel with supplied Ecore metadata', async () => {
    const fetchEcoreFile = jest.fn().mockResolvedValue('<unused />');
    const options = createOptions({
      activeProjectId: 77,
      openTabCount: 2,
      fetchEcoreFile,
    });
    const { result } = renderHook(() => useCanvasUmlPanels(options));

    await act(async () => {
      await result.current.handleEcoreFileExpand(
        'library.ecore',
        '<ecore />',
        {
          metaModelId: 10,
          metaModelSourceId: 20,
          ecoreFileId: 30,
        },
      );
    });

    expect(fetchEcoreFile).not.toHaveBeenCalled();
    expect(result.current.umlPanels).toEqual([
      {
        id: 'panel-1234',
        title: 'library',
        fileName: 'library.ecore',
        ecoreContent: '<ecore />',
        metaModelId: 10,
        metaModelSourceId: 20,
        ecoreFileId: 30,
        layoutScopeId: 'vsum-77',
        layoutStorageKey: 'metamodel-20-library.ecore',
        top: 108,
        right: 16,
        width: 200,
        height: 664,
      },
    ]);
    expect(result.current.topPanelId).toBe('panel-1234');
  });

  it('falls back to Ecore metadata and content from canvas nodes', async () => {
    const canvasNode: Node = {
      id: 'node-1',
      type: 'ecoreFile',
      position: { x: 0, y: 0 },
      data: {
        fileName: 'fallback.ecore',
        fileContent: '<canvas-content />',
        metaModelId: 11,
        metaModelSourceId: 21,
        ecoreFileId: 31,
      },
    };
    const fetchEcoreFile = jest.fn().mockResolvedValue('<unused />');
    const options = createOptions({
      getCanvasNodes: () => [canvasNode],
      fetchEcoreFile,
    });
    const { result } = renderHook(() => useCanvasUmlPanels(options));

    await act(async () => {
      await result.current.handleEcoreFileExpand('fallback.ecore', '');
    });

    expect(fetchEcoreFile).not.toHaveBeenCalled();
    expect(result.current.umlPanels[0]).toEqual(expect.objectContaining({
      fileName: 'fallback.ecore',
      ecoreContent: '<canvas-content />',
      metaModelId: 11,
      metaModelSourceId: 21,
      ecoreFileId: 31,
      layoutStorageKey: 'metamodel-21-fallback.ecore',
    }));
  });

  it('fetches missing Ecore content and synchronizes the canvas copy', async () => {
    const fetchEcoreFile = jest.fn().mockResolvedValue('<fetched-content />');
    const updateEcoreFileData = jest.fn();
    const options = createOptions({
      fetchEcoreFile,
      updateEcoreFileData,
    });
    const { result } = renderHook(() => useCanvasUmlPanels(options));

    await act(async () => {
      await result.current.handleEcoreFileExpand(
        'fetched.ecore',
        '',
        { metaModelId: 12, ecoreFileId: 32 },
      );
    });

    expect(fetchEcoreFile).toHaveBeenCalledWith(32);
    expect(updateEcoreFileData).toHaveBeenCalledWith(
      'fetched.ecore',
      '<fetched-content />',
      32,
    );
    expect(result.current.umlPanels[0].ecoreContent).toBe('<fetched-content />');
  });

  it('notifies when Ecore loading fails', async () => {
    const onLoadError = jest.fn();
    const options = createOptions({
      fetchEcoreFile: jest.fn().mockRejectedValue(new Error('Network error')),
      onLoadError,
    });
    const { result } = renderHook(() => useCanvasUmlPanels(options));

    await act(async () => {
      await result.current.handleEcoreFileExpand(
        'failed.ecore',
        '',
        { metaModelId: 13, ecoreFileId: 33 },
      );
    });

    expect(onLoadError).toHaveBeenCalledWith(
      'Could not load UML diagram for this meta-model.',
    );
    expect(result.current.umlPanels).toEqual([]);
  });

  it('notifies when no UML content is available', async () => {
    const onLoadError = jest.fn();
    const fetchEcoreFile = jest.fn();
    const options = createOptions({ fetchEcoreFile, onLoadError });
    const { result } = renderHook(() => useCanvasUmlPanels(options));

    await act(async () => {
      await result.current.handleEcoreFileExpand('blank.ecore', '   ');
    });

    expect(fetchEcoreFile).not.toHaveBeenCalled();
    expect(onLoadError).toHaveBeenCalledWith(
      'No UML content available for this meta-model.',
    );
    expect(result.current.umlPanels).toEqual([]);
  });

  it('focuses panels and preserves close behavior', () => {
    const options = createOptions();
    const { result } = renderHook(() => useCanvasUmlPanels(options));
    const firstPanel = createPanel();
    const secondPanel = createPanel({
      id: 'panel-2',
      title: 'Second',
      fileName: 'second.ecore',
    });

    act(() => {
      result.current.restorePanels([firstPanel, secondPanel], firstPanel.id);
      result.current.focusPanel(secondPanel.id);
    });
    expect(result.current.topPanelId).toBe(secondPanel.id);

    act(() => {
      result.current.closePanel(firstPanel.id);
    });
    expect(result.current.umlPanels).toEqual([secondPanel]);
    expect(result.current.topPanelId).toBe(secondPanel.id);

    act(() => {
      result.current.closePanel(secondPanel.id);
    });
    expect(result.current.umlPanels).toEqual([]);
    expect(result.current.topPanelId).toBeNull();
  });

  it('does not build save context for view-only users', () => {
    const options = createOptions({ isViewOnly: true });
    const { result } = renderHook(() => useCanvasUmlPanels(options));

    expect(result.current.buildUmlSaveContext(createPanel())).toBeUndefined();
  });

  it('stores a project edit on the source meta-model', async () => {
    const persistProjectEcore = jest.fn().mockResolvedValue(undefined);
    const options = createOptions({ persistProjectEcore });
    const { result } = renderHook(() => useCanvasUmlPanels(options));
    const saveContext = result.current.buildUmlSaveContext(createPanel());

    await saveContext?.persistWorkspaceEcore?.('<edited />');

    expect(persistProjectEcore).toHaveBeenCalledWith(20, '<edited />');
  });

  it('does not build save context without a meta-model id', () => {
    const options = createOptions();
    const { result } = renderHook(() => useCanvasUmlPanels(options));

    expect(result.current.buildUmlSaveContext(createPanel({
      metaModelId: undefined,
      metaModelSourceId: undefined,
    }))).toBeUndefined();
  });

  it('updates panel and canvas content after a workspace save', () => {
    const updateEcoreFileData = jest.fn();
    const options = createOptions({ updateEcoreFileData });
    const { result } = renderHook(() => useCanvasUmlPanels(options));
    const panel = createPanel();

    act(() => {
      result.current.restorePanels([panel], panel.id);
    });
    const saveContext = result.current.buildUmlSaveContext(panel);

    expect(saveContext).toEqual(expect.objectContaining({
      metaModelId: '20',
      ecoreFileId: 30,
      modelName: 'Library',
      saveTarget: 'workspace',
    }));

    act(() => {
      saveContext?.onSaved?.({
        ecoreContent: '<saved-content />',
        ecoreFileId: 30,
      });
    });

    expect(result.current.umlPanels[0].ecoreContent).toBe('<saved-content />');
    expect(updateEcoreFileData).toHaveBeenCalledWith(
      'library.ecore',
      '<saved-content />',
      30,
    );
    expect(result.current.umlPanels[0].ecoreFileId).toBe(30);
  });

  it('passes canvas metadata into the project save and keeps a replacement file id', () => {
    const updateEcoreFileData = jest.fn();
    const getCanvasNodes = () => [{
      id: 'ecore-1',
      type: 'ecoreFile',
      position: { x: 0, y: 0 },
      data: {
        fileName: 'library.ecore',
        ecoreFileId: 30,
        description: 'A library',
        domain: 'Software',
        keywords: 'uml, ecore',
      },
    }] as Node[];
    const options = createOptions({ updateEcoreFileData, getCanvasNodes });
    const { result } = renderHook(() => useCanvasUmlPanels(options));
    const panel = createPanel();

    act(() => {
      result.current.restorePanels([panel], panel.id);
    });

    expect(result.current.buildUmlSaveContext(panel)?.metaModelMetadata).toEqual({
      description: 'A library',
      domain: 'Software',
      keyword: ['uml', 'ecore'],
    });

    act(() => {
      result.current.buildUmlSaveContext(panel)?.onSaved?.({
        ecoreContent: '<saved-content />',
        ecoreFileId: 44,
      });
    });

    expect(result.current.umlPanels[0].ecoreFileId).toBe(44);
    expect(updateEcoreFileData).toHaveBeenCalledWith(
      'library.ecore',
      '<saved-content />',
      44,
    );
  });

  it('restores, removes, and clears panel state for page workflows', () => {
    const options = createOptions();
    const { result } = renderHook(() => useCanvasUmlPanels(options));
    const panels = [
      createPanel({ id: 'model-id', metaModelId: 10, metaModelSourceId: 99 }),
      createPanel({ id: 'source-id', metaModelId: 99, metaModelSourceId: 20 }),
      createPanel({ id: 'source-as-model-id', metaModelId: 20, metaModelSourceId: 99 }),
      createPanel({ id: 'remaining', metaModelId: 40, metaModelSourceId: 50 }),
    ];

    act(() => {
      result.current.restorePanels(panels, 'source-id');
    });
    expect(result.current.umlPanels).toEqual(panels);
    expect(result.current.topPanelId).toBe('source-id');

    act(() => {
      result.current.removePanelsForDeletedModel(10, 20);
    });
    expect(result.current.umlPanels).toEqual([panels[3]]);
    expect(result.current.topPanelId).toBe('source-id');

    act(() => {
      result.current.clearPanels();
    });
    expect(result.current.umlPanels).toEqual([]);
    expect(result.current.topPanelId).toBeNull();
  });
});
