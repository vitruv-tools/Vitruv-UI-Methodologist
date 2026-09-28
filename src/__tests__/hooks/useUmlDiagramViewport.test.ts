import { act, renderHook } from '@testing-library/react';
import {
  hasSavedUmlLayout,
  loadUmlViewport,
  saveUmlLayout,
  UML_VIEWPORT_KEY,
} from '../../utils/umlLayoutStorage';
import {
  useUmlDiagramViewport,
  type UseUmlDiagramViewportOptions,
} from '../../hooks/useUmlDiagramViewport';
import type { UmlDiagramClass } from '../../components/canvas/umlDiagramTypes';

jest.mock('../../utils/umlLayoutStorage', () => {
  const actual = jest.requireActual('../../utils/umlLayoutStorage');
  return {
    ...actual,
    hasSavedUmlLayout: jest.fn(),
    loadUmlViewport: jest.fn(),
    saveUmlLayout: jest.fn(),
  };
});

const mockedHasSavedUmlLayout = hasSavedUmlLayout as jest.MockedFunction<
  typeof hasSavedUmlLayout
>;
const mockedLoadUmlViewport = loadUmlViewport as jest.MockedFunction<
  typeof loadUmlViewport
>;
const mockedSaveUmlLayout = saveUmlLayout as jest.MockedFunction<
  typeof saveUmlLayout
>;

const CLASS_A: UmlDiagramClass = {
  id: 'A',
  name: 'A',
  isAbstract: false,
  isInterface: false,
  attributes: [],
  operations: [],
  x: 0,
  y: 0,
};

const CLASS_B: UmlDiagramClass = {
  id: 'B',
  name: 'B',
  isAbstract: false,
  isInterface: false,
  attributes: [],
  operations: [],
  x: 300,
  y: 200,
};

function makeOptions(
  overrides: Partial<UseUmlDiagramViewportOptions> = {},
): UseUmlDiagramViewportOptions {
  const classes = overrides.classes ?? [CLASS_A];
  return {
    classes,
    allClasses: overrides.allClasses ?? classes,
    diagramIdentity: 'diagram-a',
    fileName: 'diagram.ecore',
    layoutScopeId: 'scope-1',
    onBeforePan: jest.fn(),
    isPanBlocked: jest.fn(() => false),
    isPanTarget: jest.fn(() => true),
    ...overrides,
  };
}

function renderViewport(
  overrides: Partial<UseUmlDiagramViewportOptions> = {},
) {
  const options = makeOptions(overrides);
  return {
    options,
    ...renderHook(
      (hookOptions: UseUmlDiagramViewportOptions) => (
        useUmlDiagramViewport(hookOptions)
      ),
      { initialProps: options },
    ),
  };
}

function attachContainer(
  containerRef: ReturnType<typeof useUmlDiagramViewport>['containerRef'],
  {
    width = 1000,
    height = 800,
    left = 0,
    top = 0,
  }: {
    width?: number;
    height?: number;
    left?: number;
    top?: number;
  } = {},
): HTMLElement {
  const element = document.createElement('section');
  Object.defineProperties(element, {
    clientWidth: { configurable: true, value: width },
    clientHeight: { configurable: true, value: height },
  });
  element.getBoundingClientRect = () => ({
    x: left,
    y: top,
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    toJSON: () => ({}),
  });
  containerRef.current = element;
  return element;
}

describe('useUmlDiagramViewport', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockedHasSavedUmlLayout.mockReturnValue(true);
    mockedLoadUmlViewport.mockReturnValue(null);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('restores a saved viewport and keeps it when initial fit detects saved layout', () => {
    mockedLoadUmlViewport.mockReturnValue({
      x: 120,
      y: -40,
      scale: 1.5,
    });

    const { result } = renderViewport();

    expect(mockedLoadUmlViewport).toHaveBeenCalledWith(
      'scope-1',
      'diagram.ecore',
    );
    expect(result.current.getCurrentViewport()).toEqual({
      x: 120,
      y: -40,
      scale: 1.5,
    });
    expect(result.current.vx).toBe(120);
    expect(result.current.vy).toBe(-40);
    expect(result.current.vscale).toBe(1.5);

    act(() => {
      jest.advanceTimersByTime(120);
    });

    expect(mockedHasSavedUmlLayout).toHaveBeenCalledWith(
      'scope-1',
      'diagram.ecore',
    );
    expect(result.current.getCurrentViewport()).toEqual({
      x: 120,
      y: -40,
      scale: 1.5,
    });
  });

  it('anchors toolbar zoom at the container center and enforces zoom limits', () => {
    const { result } = renderViewport();
    attachContainer(result.current.containerRef, {
      width: 800,
      height: 600,
    });

    act(() => {
      result.current.restoreViewport({ x: 0, y: 0, scale: 1 });
      result.current.zoomIn();
    });

    expect(result.current.getCurrentViewport()).toEqual({
      x: -120,
      y: -90,
      scale: 1.3,
    });

    act(() => {
      for (let index = 0; index < 20; index += 1) {
        result.current.zoomIn();
      }
    });
    expect(result.current.vscale).toBe(3);

    act(() => {
      for (let index = 0; index < 40; index += 1) {
        result.current.zoomOut();
      }
    });
    expect(result.current.vscale).toBe(0.35);
  });

  it('anchors wheel zoom at the pointer and prevents default scrolling', () => {
    const { result, rerender, options } = renderViewport({
      fileName: undefined,
    });
    const element = attachContainer(result.current.containerRef, {
      width: 800,
      height: 600,
      left: 100,
      top: 50,
    });

    rerender({ ...options, fileName: 'wheel.ecore' });
    act(() => {
      result.current.restoreViewport({ x: 10, y: 20, scale: 1 });
    });

    const wheelEvent = new WheelEvent('wheel', {
      clientX: 300,
      clientY: 250,
      deltaY: -1,
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      element.dispatchEvent(wheelEvent);
    });

    const expectedScale = 1 / 0.88;
    expect(wheelEvent.defaultPrevented).toBe(true);
    expect(result.current.vscale).toBeCloseTo(expectedScale);
    expect(result.current.vx).toBeCloseTo(
      200 - expectedScale * (200 - 10),
    );
    expect(result.current.vy).toBeCloseTo(
      200 - expectedScale * (200 - 20),
    );
  });

  it('updates from the minimap and converts client coordinates', () => {
    const { result } = renderViewport();
    attachContainer(result.current.containerRef, {
      left: 100,
      top: 50,
    });

    act(() => {
      result.current.restoreViewport({ x: 20, y: 30, scale: 2 });
    });
    expect(result.current.clientToDiagram(220, 180)).toEqual({
      x: 50,
      y: 50,
    });

    act(() => {
      result.current.handleMinimapPan(-12, 44);
    });
    expect(result.current.getCurrentViewport()).toEqual({
      x: -12,
      y: 44,
      scale: 2,
    });
  });

  it('fits all classes without applying the manual minimum-scale clamp', () => {
    const distantClass = {
      ...CLASS_B,
      x: 10000,
      y: 8000,
    };
    const classes = [CLASS_A, distantClass];
    const { result } = renderViewport({
      classes,
      allClasses: classes,
      fileName: undefined,
    });
    attachContainer(result.current.containerRef, {
      width: 1000,
      height: 600,
    });

    act(() => {
      result.current.fitToView();
    });

    const { layout } = result.current;
    const contentWidth = layout.maxX - layout.minX + 96;
    const contentHeight = layout.maxY - layout.minY + 96;
    const expectedScale = Math.min(
      904 / contentWidth,
      504 / contentHeight,
      1.15,
    );
    const expectedX = (1000 - contentWidth * expectedScale) / 2
      - (layout.minX - 48 + layout.offsetX) * expectedScale;
    const expectedY = (600 - contentHeight * expectedScale) / 2
      - (layout.minY - 48 + layout.offsetY) * expectedScale;

    expect(result.current.vscale).toBeCloseTo(expectedScale);
    expect(result.current.vscale).toBeLessThan(0.35);
    expect(result.current.vx).toBeCloseTo(expectedX);
    expect(result.current.vy).toBeCloseTo(expectedY);
  });

  it('honors panning guards and tracks the canvas panning lifecycle', () => {
    const onBeforePan = jest.fn();
    const isPanBlocked = jest.fn(() => true);
    const isPanTarget = jest.fn(() => true);
    const { result, rerender, options } = renderViewport({
      fileName: undefined,
      onBeforePan,
      isPanBlocked,
      isPanTarget,
    });
    const element = attachContainer(result.current.containerRef);
    const classes = [CLASS_A, CLASS_B];
    rerender({ ...options, classes, allClasses: classes });

    act(() => {
      element.dispatchEvent(new MouseEvent('mousedown', {
        clientX: 10,
        clientY: 20,
        bubbles: true,
        cancelable: true,
      }));
    });
    expect(onBeforePan).toHaveBeenCalledTimes(1);
    expect(isPanTarget).not.toHaveBeenCalled();
    expect(result.current.panning).toBe(false);

    isPanBlocked.mockReturnValue(false);
    isPanTarget.mockReturnValue(false);
    act(() => {
      element.dispatchEvent(new MouseEvent('mousedown', {
        clientX: 10,
        clientY: 20,
        bubbles: true,
        cancelable: true,
      }));
    });
    expect(result.current.panning).toBe(false);

    isPanTarget.mockReturnValue(true);
    const panStart = new MouseEvent('mousedown', {
      clientX: 10,
      clientY: 20,
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      element.dispatchEvent(panStart);
    });
    expect(panStart.defaultPrevented).toBe(true);
    expect(result.current.panning).toBe(true);

    act(() => {
      globalThis.dispatchEvent(new MouseEvent('mousemove', {
        clientX: 25,
        clientY: 50,
      }));
    });
    expect(result.current.getCurrentViewport()).toEqual({
      x: 15,
      y: 30,
      scale: 1,
    });

    act(() => {
      globalThis.dispatchEvent(new MouseEvent('mouseup'));
    });
    expect(result.current.panning).toBe(false);
  });

  it('debounces layout persistence for 300ms', () => {
    const { result } = renderViewport();
    mockedSaveUmlLayout.mockClear();

    act(() => {
      result.current.scheduleDebouncedLayoutSave();
      result.current.scheduleDebouncedLayoutSave();
      jest.advanceTimersByTime(299);
    });

    expect(mockedSaveUmlLayout).toHaveBeenCalledTimes(1);
    mockedSaveUmlLayout.mockClear();

    act(() => {
      jest.advanceTimersByTime(1);
    });

    expect(mockedSaveUmlLayout).toHaveBeenCalledTimes(1);
    expect(mockedSaveUmlLayout).toHaveBeenCalledWith(
      'scope-1',
      'diagram.ecore',
      expect.objectContaining({
        A: { x: 0, y: 0 },
        [UML_VIEWPORT_KEY]: { x: 0, y: 0, scale: 1 },
      }),
    );
  });

  it('performs the initial fit after 120ms when no layout is saved', () => {
    mockedHasSavedUmlLayout.mockReturnValue(false);
    const { result } = renderViewport();
    attachContainer(result.current.containerRef, {
      width: 1000,
      height: 800,
    });

    act(() => {
      jest.advanceTimersByTime(119);
    });
    expect(result.current.vscale).toBe(1);

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current.vscale).toBe(1.15);
  });

  it('cleans active panning and pending layout timers on unmount', () => {
    const removeEventListenerSpy = jest.spyOn(
      globalThis,
      'removeEventListener',
    );
    const { result, rerender, options, unmount } = renderViewport();
    const element = attachContainer(result.current.containerRef);
    const classes = [CLASS_A, CLASS_B];
    rerender({ ...options, classes, allClasses: classes });

    act(() => {
      element.dispatchEvent(new MouseEvent('mousedown', {
        clientX: 10,
        clientY: 20,
        bubbles: true,
        cancelable: true,
      }));
      result.current.scheduleDebouncedLayoutSave();
      result.current.restoreViewportAfterReload();
    });
    mockedLoadUmlViewport.mockClear();
    mockedSaveUmlLayout.mockClear();

    unmount();
    const loadCallsAfterUnmount = mockedLoadUmlViewport.mock.calls.length;
    const saveCallsAfterUnmount = mockedSaveUmlLayout.mock.calls.length;

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'mousemove',
      expect.any(Function),
    );
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'mouseup',
      expect.any(Function),
    );
    expect(mockedLoadUmlViewport).toHaveBeenCalledTimes(
      loadCallsAfterUnmount,
    );
    expect(mockedSaveUmlLayout).toHaveBeenCalledTimes(
      saveCallsAfterUnmount,
    );
    removeEventListenerSpy.mockRestore();
  });
});
