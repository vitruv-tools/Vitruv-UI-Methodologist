import { act, renderHook } from '@testing-library/react';
import {
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import {
  useUmlDiagramInteraction,
  type UseUmlDiagramInteractionOptions,
} from '../../hooks/useUmlDiagramInteraction';
import type { UMLRelationship } from '../../utils/ecoreToUml';

const ASSOCIATION: UMLRelationship = {
  id: 'relationship-1',
  sourceId: 'class-a',
  targetId: 'class-b',
  type: 'association',
};

type InteractionStateOptions = Omit<
  UseUmlDiagramInteractionOptions,
  | 'relationships'
  | 'selectedClassId'
  | 'setSelectedClassId'
  | 'selectedRelationshipId'
  | 'setSelectedRelationshipId'
  | 'connectMode'
  | 'setConnectMode'
  | 'connectSourceId'
  | 'setConnectSourceId'
  | 'editActive'
  | 'cancelEdit'
  | 'updateRelationship'
> & {
  initialRelationships: UMLRelationship[];
  initialSelectedClassId: string | null;
  initialSelectedRelationshipId: string | null;
  initialConnectMode: boolean;
  initialConnectSourceId: string | null;
  initialEditActive: boolean;
  cancelEdit: () => void;
  updateRelationship: (
    relationshipId: string,
    patch: Partial<UMLRelationship>,
  ) => void;
};

function useInteractionState(options: InteractionStateOptions) {
  const [relationships, setRelationships] = useState(
    options.initialRelationships,
  );
  const [selectedClassId, setSelectedClassId] = useState(
    options.initialSelectedClassId,
  );
  const [selectedRelationshipId, setSelectedRelationshipId] = useState(
    options.initialSelectedRelationshipId,
  );
  const [connectMode, setConnectMode] = useState(options.initialConnectMode);
  const [connectSourceId, setConnectSourceId] = useState(
    options.initialConnectSourceId,
  );
  const [editActive, setEditActive] = useState(options.initialEditActive);

  const interaction = useUmlDiagramInteraction({
    interactive: options.interactive,
    classCount: options.classCount,
    containerRef: options.containerRef,
    isEmptyCanvasTarget: options.isEmptyCanvasTarget,
    relationships,
    selectedClassId,
    setSelectedClassId,
    selectedRelationshipId,
    setSelectedRelationshipId,
    connectMode,
    setConnectMode,
    connectSourceId,
    setConnectSourceId,
    editActive,
    flushPendingEdit: options.flushPendingEdit,
    cancelEdit: () => {
      options.cancelEdit();
      setEditActive(false);
    },
    addRelationship: options.addRelationship,
    updateRelationship: (relationshipId, patch) => {
      options.updateRelationship(relationshipId, patch);
      setRelationships(current => current.map(relationship => (
        relationship.id === relationshipId
          ? { ...relationship, ...patch }
          : relationship
      )));
    },
    deleteRelationship: options.deleteRelationship,
    deleteClass: options.deleteClass,
    handleUndo: options.handleUndo,
    handleRedo: options.handleRedo,
  });

  return {
    ...interaction,
    relationships,
    selectedClassId,
    selectedRelationshipId,
    connectMode,
    connectSourceId,
    editActive,
  };
}

function makeOptions(
  overrides: Partial<InteractionStateOptions> = {},
): InteractionStateOptions {
  return {
    interactive: true,
    classCount: 2,
    containerRef: { current: null },
    isEmptyCanvasTarget: jest.fn(() => true),
    initialRelationships: [ASSOCIATION],
    initialSelectedClassId: null,
    initialSelectedRelationshipId: null,
    initialConnectMode: false,
    initialConnectSourceId: null,
    initialEditActive: false,
    flushPendingEdit: jest.fn(),
    cancelEdit: jest.fn(),
    addRelationship: jest.fn(() => true),
    updateRelationship: jest.fn(),
    deleteRelationship: jest.fn(),
    deleteClass: jest.fn(),
    handleUndo: jest.fn(),
    handleRedo: jest.fn(),
    ...overrides,
  };
}

function renderInteraction(
  overrides: Partial<InteractionStateOptions> = {},
) {
  const options = makeOptions(overrides);
  const view = renderHook(() => useInteractionState(options));
  return { options, ...view };
}

function perform<T>(callback: () => T): T {
  let result!: T;
  act(() => {
    result = callback();
  });
  return result;
}

function relationshipEvent(detail: number): ReactMouseEvent {
  return {
    detail,
    stopPropagation: jest.fn(),
  } as unknown as ReactMouseEvent;
}

function dispatchKey(
  key: string,
  init: KeyboardEventInit = {},
  target: HTMLElement | typeof globalThis = globalThis,
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

describe('useUmlDiagramInteraction', () => {
  afterEach(() => {
    document.body.replaceChildren();
    jest.restoreAllMocks();
  });

  it('toggles connect mode, arms a source, and connects a target', () => {
    const flushPendingEdit = jest.fn();
    const addRelationship = jest.fn(() => true);
    const { result } = renderInteraction({
      initialConnectSourceId: 'stale-source',
      flushPendingEdit,
      addRelationship,
    });

    act(() => result.current.handleToggleConnect());

    expect(result.current.connectMode).toBe(true);
    expect(result.current.connectSourceId).toBeNull();

    act(() => result.current.handleClassSelect('class-a'));

    expect(flushPendingEdit).toHaveBeenCalledTimes(1);
    expect(result.current.connectSourceId).toBe('class-a');
    expect(result.current.selectedClassId).toBe('class-a');
    expect(result.current.connectMode).toBe(true);

    act(() => result.current.handleClassSelect('class-b'));

    expect(flushPendingEdit).toHaveBeenCalledTimes(2);
    expect(addRelationship).toHaveBeenCalledWith('class-a', 'class-b');
    expect(result.current.selectedClassId).toBe('class-b');
    expect(result.current.connectMode).toBe(false);
    expect(result.current.connectSourceId).toBeNull();
  });

  it('keeps the original source armed when target creation fails', () => {
    const addRelationship = jest.fn(() => false);
    const { result } = renderInteraction({
      initialConnectMode: true,
      initialConnectSourceId: 'class-a',
      addRelationship,
    });

    act(() => result.current.handleClassSelect('class-b'));

    expect(result.current.selectedClassId).toBe('class-b');
    expect(result.current.connectMode).toBe(true);
    expect(result.current.connectSourceId).toBe('class-a');
  });

  it('exits on a second source click without creating a relationship', () => {
    const addRelationship = jest.fn(() => true);
    const { result } = renderInteraction({
      initialConnectMode: true,
      initialConnectSourceId: 'class-a',
      addRelationship,
    });

    act(() => result.current.handleClassSelect('class-a'));

    expect(addRelationship).not.toHaveBeenCalled();
    expect(result.current.selectedClassId).toBe('class-a');
    expect(result.current.connectMode).toBe(false);
    expect(result.current.connectSourceId).toBeNull();
  });

  it('keeps class selection read-only while selecting without cycling a relationship', () => {
    const flushPendingEdit = jest.fn();
    const updateRelationship = jest.fn();
    const event = relationshipEvent(2);
    const { result } = renderInteraction({
      interactive: false,
      initialSelectedClassId: 'class-a',
      flushPendingEdit,
      updateRelationship,
    });

    act(() => result.current.handleClassSelect('class-b'));
    act(() => result.current.handleRelationshipClick('relationship-1', event));

    expect(flushPendingEdit).not.toHaveBeenCalled();
    expect(result.current.selectedClassId).toBe('class-a');
    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
    expect(updateRelationship).not.toHaveBeenCalled();
    expect(result.current.selectedRelationshipId).toBe('relationship-1');
    expect(result.current.relationships[0].type).toBe('association');
  });

  it('cycles live relationship types on interactive double-clicks', () => {
    const updateRelationship = jest.fn();
    const { result } = renderInteraction({ updateRelationship });

    for (const expectedType of [
      'composition',
      'inheritance',
      'association',
    ] as const) {
      act(() => result.current.handleRelationshipClick(
        'relationship-1',
        relationshipEvent(2),
      ));
      expect(result.current.relationships[0].type).toBe(expectedType);
    }

    expect(updateRelationship.mock.calls.map(call => call[1].type)).toEqual([
      'composition',
      'inheritance',
      'association',
    ]);
  });

  it('deletes a relationship first and falls back to the selected class', () => {
    const deleteRelationship = jest.fn();
    const deleteClass = jest.fn();
    const {
      result: relationshipResult,
      unmount: unmountRelationship,
    } = renderInteraction({
      initialSelectedRelationshipId: 'relationship-1',
      initialSelectedClassId: 'class-a',
      deleteRelationship,
      deleteClass,
    });

    act(() => relationshipResult.current.handleDeleteSelected());

    expect(deleteRelationship).toHaveBeenCalledWith('relationship-1');
    expect(deleteClass).not.toHaveBeenCalled();
    unmountRelationship();

    const { result: classResult } = renderInteraction({
      initialSelectedClassId: 'class-a',
      deleteClass,
    });

    act(() => classResult.current.handleDeleteSelected());
    expect(deleteClass).toHaveBeenCalledWith('class-a');
  });

  it('clears exactly one Escape layer in priority order', () => {
    const cancelEdit = jest.fn();
    const { result } = renderInteraction({
      initialConnectMode: true,
      initialConnectSourceId: 'class-a',
      initialEditActive: true,
      initialSelectedRelationshipId: 'relationship-1',
      initialSelectedClassId: 'class-b',
      cancelEdit,
    });

    expect(perform(result.current.tryEscape)).toBe(true);
    expect(result.current.connectMode).toBe(false);
    expect(result.current.connectSourceId).toBeNull();
    expect(result.current.editActive).toBe(true);
    expect(result.current.selectedRelationshipId).toBe('relationship-1');

    expect(perform(result.current.tryEscape)).toBe(true);
    expect(cancelEdit).toHaveBeenCalledTimes(1);
    expect(result.current.selectedRelationshipId).toBe('relationship-1');

    expect(perform(result.current.tryEscape)).toBe(true);
    expect(result.current.selectedRelationshipId).toBeNull();
    expect(result.current.selectedClassId).toBe('class-b');

    expect(perform(result.current.tryEscape)).toBe(true);
    expect(result.current.selectedClassId).toBeNull();
    expect(perform(result.current.tryEscape)).toBe(false);
  });

  it('handles a standalone source before edit and preserves dismissal ordering', () => {
    const calls: string[] = [];
    const { result } = renderInteraction({
      initialConnectSourceId: 'class-a',
      initialEditActive: true,
      initialSelectedClassId: 'class-b',
      flushPendingEdit: () => calls.push('flush'),
      cancelEdit: () => calls.push('cancel'),
    });

    expect(perform(result.current.tryEscape)).toBe(true);
    expect(result.current.connectSourceId).toBeNull();
    expect(result.current.editActive).toBe(true);
    expect(result.current.selectedClassId).toBe('class-b');
    expect(calls).toEqual([]);

    expect(perform(result.current.tryEscape)).toBe(true);
    expect(result.current.editActive).toBe(false);
    expect(result.current.selectedClassId).toBe('class-b');
    expect(calls).toEqual(['cancel']);

    calls.length = 0;
    expect(perform(result.current.tryEscape)).toBe(true);
    expect(calls).toEqual(['flush', 'cancel']);
    expect(result.current.selectedClassId).toBeNull();
  });

  it('accepts empty-canvas double-clicks and dismisses class editing', () => {
    const container = document.createElement('div');
    const flushPendingEdit = jest.fn();
    const cancelEdit = jest.fn();
    const isEmptyCanvasTarget = jest.fn(() => true);
    const { result } = renderInteraction({
      containerRef: { current: container },
      initialSelectedClassId: 'class-a',
      initialEditActive: true,
      flushPendingEdit,
      cancelEdit,
      isEmptyCanvasTarget,
    });
    const event = new MouseEvent('dblclick', {
      bubbles: true,
      cancelable: true,
    });
    const stopPropagation = jest.spyOn(event, 'stopPropagation');

    act(() => container.dispatchEvent(event));

    expect(isEmptyCanvasTarget).toHaveBeenCalledWith(container);
    expect(event.defaultPrevented).toBe(true);
    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(flushPendingEdit).toHaveBeenCalledTimes(1);
    expect(cancelEdit).toHaveBeenCalledTimes(1);
    expect(result.current.selectedClassId).toBeNull();
    expect(result.current.editActive).toBe(false);
  });

  it('rejects protected double-click targets through the shared predicate', () => {
    const container = document.createElement('div');
    const protectedTarget = document.createElement('button');
    container.append(protectedTarget);
    const isEmptyCanvasTarget = jest.fn(() => false);
    const flushPendingEdit = jest.fn();
    renderInteraction({
      containerRef: { current: container },
      isEmptyCanvasTarget,
      flushPendingEdit,
    });
    const event = new MouseEvent('dblclick', {
      bubbles: true,
      cancelable: true,
    });

    act(() => protectedTarget.dispatchEvent(event));

    expect(isEmptyCanvasTarget).toHaveBeenCalledWith(protectedTarget);
    expect(event.defaultPrevented).toBe(false);
    expect(flushPendingEdit).not.toHaveBeenCalled();
  });

  it('removes the exact native double-click listener on cleanup', () => {
    const container = document.createElement('div');
    const addListener = jest.spyOn(container, 'addEventListener');
    const removeListener = jest.spyOn(container, 'removeEventListener');
    const view = renderInteraction({
      containerRef: { current: container },
    });
    const addedListener = addListener.mock.calls.find(
      call => call[0] === 'dblclick',
    )?.[1];

    view.unmount();

    expect(addedListener).toBeDefined();
    expect(removeListener).toHaveBeenCalledWith('dblclick', addedListener);
  });

  it('wires undo and redo through the global listener', () => {
    const handleUndo = jest.fn();
    const handleRedo = jest.fn();
    renderInteraction({ handleUndo, handleRedo });

    const undoEvent = dispatchKey('z', { ctrlKey: true });
    const redoEvent = dispatchKey('Y', { metaKey: true });

    expect(handleUndo).toHaveBeenCalledTimes(1);
    expect(handleRedo).toHaveBeenCalledTimes(1);
    expect(undoEvent.defaultPrevented).toBe(true);
    expect(redoEvent.defaultPrevented).toBe(true);
  });

  it('does not register a global keyboard listener in read-only mode', () => {
    const addListener = jest.spyOn(globalThis, 'addEventListener');

    renderInteraction({ interactive: false });

    expect(addListener.mock.calls.some(call => call[0] === 'keydown'))
      .toBe(false);
  });

  it('removes the exact global keyboard listener on unmount', () => {
    const addListener = jest.spyOn(globalThis, 'addEventListener');
    const removeListener = jest.spyOn(globalThis, 'removeEventListener');
    const view = renderInteraction();
    const addedListener = addListener.mock.calls.find(
      call => call[0] === 'keydown',
    )?.[1];

    view.unmount();

    expect(addedListener).toBeDefined();
    expect(removeListener).toHaveBeenCalledWith('keydown', addedListener);
  });
});
