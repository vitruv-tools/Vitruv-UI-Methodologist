import { act, renderHook } from '@testing-library/react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { UmlDiagramClass } from '../../components/canvas/umlDiagramTypes';
import {
  useUmlDiagramReactions,
  type UseUmlDiagramReactionsOptions,
} from '../../hooks/useUmlDiagramReactions';
import type { ReactionConfig, ReactionsModel } from '../../types/reactions';
import type { UMLRelationship } from '../../utils/ecoreToUml';
import {
  fetchReactionCode,
  persistReactionCode,
} from '../../utils/reactionFile';

jest.mock('../../utils/reactionFile', () => ({
  fetchReactionCode: jest.fn(),
  persistReactionCode: jest.fn(),
}));

const mockedFetchReactionCode = (
  fetchReactionCode as jest.MockedFunction<typeof fetchReactionCode>
);
const mockedPersistReactionCode = (
  persistReactionCode as jest.MockedFunction<typeof persistReactionCode>
);

const SOURCE_CLASS: UmlDiagramClass = {
  id: 'Source',
  name: 'Source',
  isAbstract: false,
  isInterface: false,
  attributes: [],
  operations: [],
  x: 40,
  y: 60,
};

const TARGET_CLASS: UmlDiagramClass = {
  id: 'addl-22-Target',
  name: 'Target',
  isAbstract: false,
  isInterface: false,
  attributes: [],
  operations: [],
  x: 400,
  y: 60,
};

const REACTION_MODELS: ReactionsModel[] = [
  {
    id: 10,
    name: 'Primary',
    ecoreContent: '<ecore:EPackage nsURI="https://models.test/primary"/>',
  },
  {
    id: 22,
    name: 'Additional',
    ecoreContent: '<ecore:EPackage nsURI="https://models.test/additional"/>',
  },
];

function makeOptions(
  overrides: Partial<UseUmlDiagramReactionsOptions> = {},
): UseUmlDiagramReactionsOptions {
  return {
    classes: [SOURCE_CLASS, TARGET_CLASS],
    relationships: [],
    primaryEcore:
      '<ecore:EPackage nsURI="https://models.test/live-primary"/>',
    primaryModelName: 'Primary',
    primaryModelId: 10,
    reactionModels: REACTION_MODELS,
    interactive: true,
    reactionsMode: 'reactions',
    selectedRelationshipId: null,
    offsetX: 10,
    offsetY: 20,
    clientToDiagram: jest.fn((clientX: number, clientY: number) => ({
      x: clientX / 2,
      y: clientY / 2,
    })),
    onRecordChange: jest.fn(),
    onAppendRenderedRelationship: jest.fn(),
    onUpdateRenderedRelationship: jest.fn(),
    onRemoveRenderedRelationship: jest.fn(),
    onSelectRelationship: jest.fn(),
    onSelectClass: jest.fn(),
    onResetConnectionMode: jest.fn(),
    ...overrides,
  };
}

function renderReactions(
  overrides: Partial<UseUmlDiagramReactionsOptions> = {},
) {
  const options = makeOptions(overrides);
  return {
    options,
    ...renderHook(
      (hookOptions: UseUmlDiagramReactionsOptions) => (
        useUmlDiagramReactions(hookOptions)
      ),
      { initialProps: options },
    ),
  };
}

function getAppendedRelationship(
  options: UseUmlDiagramReactionsOptions,
): UMLRelationship {
  const appendMock = options.onAppendRenderedRelationship as jest.Mock;
  return appendMock.mock.calls[0][0] as UMLRelationship;
}

function createReaction(
  result: ReturnType<typeof renderReactions>['result'],
) {
  act(() => {
    result.current.addReactionConnection(
      SOURCE_CLASS.id,
      TARGET_CLASS.id,
    );
  });
  return result.current.reactionEdges[0];
}

describe('useUmlDiagramReactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(1234);
    mockedFetchReactionCode.mockImplementation(
      async (_code, _reactionFileId, buildDefault) => buildDefault(),
    );
    mockedPersistReactionCode.mockResolvedValue(77);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates a synchronized reaction and reopens an existing duplicate', () => {
    const { result, rerender, options } = renderReactions();

    const reaction = createReaction(result);

    expect(reaction).toEqual({
      id: 'reaction-1234',
      sourceModelId: 10,
      sourceClassId: 'Source',
      sourceClassName: 'Source',
      targetModelId: 22,
      targetClassId: 'addl-22-Target',
      targetClassName: 'Target',
      config: {
        bidirectional: false,
        reactionName: 'Source_Target',
        model1Url: 'https://models.test/live-primary',
        model2Url: 'https://models.test/additional',
        model1Alias: 'Primary',
        model2Alias: 'Additional',
        model1RootType: 'Source',
        model2RootType: 'Target',
        model1RootVal: 'Source',
      },
    });
    expect(options.onRecordChange).toHaveBeenCalledTimes(1);
    expect(options.onAppendRenderedRelationship).toHaveBeenCalledWith({
      id: 'reaction-1234',
      sourceId: 'Source',
      targetId: 'addl-22-Target',
      type: 'association',
      label: 'Source_Target',
    });
    expect(options.onSelectRelationship).toHaveBeenCalledWith(
      'reaction-1234',
    );
    expect(options.onSelectClass).toHaveBeenCalledWith(null);
    expect(result.current.editingReaction).toBe(reaction);

    rerender({
      ...options,
      relationships: [getAppendedRelationship(options)],
      selectedRelationshipId: reaction.id,
    });
    act(() => {
      result.current.closeReactionConfiguration();
      result.current.addReactionConnection(
        SOURCE_CLASS.id,
        TARGET_CLASS.id,
      );
    });

    expect(result.current.reactionEdges).toHaveLength(1);
    expect(result.current.editingReactionId).toBe(reaction.id);
    expect(options.onRecordChange).toHaveBeenCalledTimes(1);
    expect(options.onAppendRenderedRelationship).toHaveBeenCalledTimes(1);
  });

  it('synchronizes configuration updates and reaction deletion', () => {
    const { result, rerender, options } = renderReactions();
    const reaction = createReaction(result);
    const relationship = getAppendedRelationship(options);
    rerender({
      ...options,
      relationships: [relationship],
      selectedRelationshipId: reaction.id,
    });
    const updatedConfig: ReactionConfig = {
      ...reaction.config,
      reactionName: 'UpdatedReaction',
      bidirectional: true,
    };

    act(() => {
      result.current.updateReactionConfig(reaction.id, updatedConfig);
    });
    expect(result.current.reactionEdges[0].config).toBe(updatedConfig);
    expect(options.onUpdateRenderedRelationship).toHaveBeenCalledWith(
      reaction.id,
      { label: 'UpdatedReaction' },
    );

    act(() => {
      result.current.deleteReaction(reaction.id);
    });
    expect(result.current.reactionEdges).toEqual([]);
    expect(result.current.editingReaction).toBeNull();
    expect(options.onRemoveRenderedRelationship).toHaveBeenCalledWith(
      reaction.id,
    );
    expect(options.onSelectRelationship).toHaveBeenLastCalledWith(null);
    expect(options.onRecordChange).toHaveBeenCalledTimes(2);
  });

  it('loads fallback reaction code, saves it, and updates the editor file ID', async () => {
    const { result, options } = renderReactions();
    const reaction = createReaction(result);

    await act(async () => {
      await result.current.openReactionEditor(reaction.id);
    });

    expect(mockedFetchReactionCode).toHaveBeenCalledWith(
      undefined,
      undefined,
      expect.any(Function),
    );
    expect(result.current.reactionEditorState).toMatchObject({
      isOpen: true,
      edgeId: reaction.id,
      sourceFileName: 'Primary',
      targetFileName: 'Additional',
      reactionFileId: null,
    });
    expect(result.current.reactionEditorState?.initialCode).toContain(
      'reactions: Source_Target',
    );
    expect(options.onSelectRelationship).toHaveBeenLastCalledWith(
      reaction.id,
    );

    await act(async () => {
      await result.current.saveReactionCode('updated reaction source');
    });

    expect(mockedPersistReactionCode).toHaveBeenCalledWith(
      'updated reaction source',
      null,
    );
    expect(result.current.reactionEdges[0]).toMatchObject({
      code: 'updated reaction source',
      reactionFileId: 77,
    });
    expect(result.current.reactionEditorState?.reactionFileId).toBe(77);

    act(() => {
      result.current.closeReactionEditor();
    });
    expect(result.current.reactionEditorState).toBeNull();
  });

  it('logs and propagates reaction code save failures', async () => {
    const saveError = new Error('save failed');
    mockedPersistReactionCode.mockRejectedValueOnce(saveError);
    const consoleError = jest.spyOn(console, 'error').mockImplementation(
      () => {},
    );
    const { result } = renderReactions();
    const reaction = createReaction(result);
    await act(async () => {
      await result.current.openReactionEditor(reaction.id);
    });

    await expect(
      result.current.saveReactionCode('broken source'),
    ).rejects.toBe(saveError);
    expect(consoleError).toHaveBeenCalledWith(
      'Failed to save reaction file',
      saveError,
    );
  });

  it('resets reaction interaction when leaving mode and cancels with Escape', () => {
    const { result, rerender, options } = renderReactions();
    const reaction = createReaction(result);
    expect(result.current.editingReactionId).toBe(reaction.id);

    rerender({
      ...options,
      reactionsMode: 'uml',
    });
    expect(result.current.editingReactionId).toBeNull();

    rerender({
      ...options,
      reactionsMode: 'reactions',
    });
    expect(options.onResetConnectionMode).toHaveBeenCalledTimes(2);
    act(() => {
      result.current.handleReactionRelationshipClick(
        reaction.id,
        1,
      );
    });
    let handled = false;
    act(() => {
      handled = result.current.cancelReactionInteraction();
    });
    expect(handled).toBe(true);
    expect(result.current.editingReactionId).toBeNull();
    expect(result.current.cancelReactionInteraction()).toBe(false);
  });

  it('prunes reactions whose classes are no longer visible', () => {
    const { result, rerender, options } = renderReactions();
    const reaction = createReaction(result);
    const relationship = getAppendedRelationship(options);

    rerender({
      ...options,
      classes: [SOURCE_CLASS],
      relationships: [relationship],
      selectedRelationshipId: reaction.id,
    });

    expect(result.current.reactionEdges).toEqual([]);
    expect(result.current.editingReactionId).toBeNull();
    expect(options.onRemoveRenderedRelationship).toHaveBeenCalledWith(
      reaction.id,
    );
    expect(options.onSelectRelationship).toHaveBeenLastCalledWith(null);
  });

  it('completes port dragging on a target port and cleans up listeners', () => {
    const { result } = renderReactions();
    const targetPort = document.createElement('button');
    targetPort.setAttribute('data-reaction-port', '');
    targetPort.dataset.classId = TARGET_CLASS.id;
    const originalElementFromPoint = document.elementFromPoint;
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: jest.fn(() => targetPort),
    });
    const removeEventListener = jest.spyOn(
      globalThis,
      'removeEventListener',
    );
    const event = {
      clientX: 100,
      clientY: 120,
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    } as unknown as ReactMouseEvent;

    act(() => {
      result.current.handleReactionPortMouseDown(
        event,
        SOURCE_CLASS.id,
        'right',
      );
    });
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
    expect(result.current.isReactionDragActive()).toBe(true);
    expect(result.current.reactionDrag).toMatchObject({
      sourceClassId: SOURCE_CLASS.id,
      sourceSide: 'right',
      cursorX: 50,
      cursorY: 60,
    });

    act(() => {
      globalThis.dispatchEvent(new MouseEvent('mousemove', {
        clientX: 160,
        clientY: 200,
      }));
    });
    expect(result.current.reactionDrag).toMatchObject({
      cursorX: 80,
      cursorY: 100,
    });

    act(() => {
      globalThis.dispatchEvent(new MouseEvent('mouseup', {
        clientX: 160,
        clientY: 200,
      }));
    });
    expect(result.current.isReactionDragActive()).toBe(false);
    expect(result.current.reactionDrag).toBeNull();
    expect(result.current.reactionEdges).toHaveLength(1);
    expect(removeEventListener).toHaveBeenCalledWith(
      'mousemove',
      expect.any(Function),
    );
    expect(removeEventListener).toHaveBeenCalledWith(
      'mouseup',
      expect.any(Function),
    );

    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: originalElementFromPoint,
    });
  });

  it('removes active drag listeners when cancelled and when unmounted', () => {
    const { result, unmount } = renderReactions();
    const removeEventListener = jest.spyOn(
      globalThis,
      'removeEventListener',
    );
    const event = {
      clientX: 100,
      clientY: 120,
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    } as unknown as ReactMouseEvent;

    act(() => {
      result.current.handleReactionPortMouseDown(
        event,
        SOURCE_CLASS.id,
        'left',
      );
      result.current.cancelReactionInteraction();
    });
    expect(result.current.reactionDrag).toBeNull();
    expect(removeEventListener).toHaveBeenCalledWith(
      'mousemove',
      expect.any(Function),
    );
    expect(removeEventListener).toHaveBeenCalledWith(
      'mouseup',
      expect.any(Function),
    );

    act(() => {
      result.current.handleReactionPortMouseDown(
        event,
        SOURCE_CLASS.id,
        'right',
      );
    });
    removeEventListener.mockClear();
    unmount();
    expect(removeEventListener).toHaveBeenCalledWith(
      'mousemove',
      expect.any(Function),
    );
    expect(removeEventListener).toHaveBeenCalledWith(
      'mouseup',
      expect.any(Function),
    );
  });
});
