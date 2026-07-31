/* eslint-disable testing-library/no-node-access */

import React from 'react';
import {
  createEvent,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import {
  UMLModelGroupWrappers,
  type UMLModelGroupWrappersProps,
} from '../../../components/canvas/UMLModelGroupWrappers';
import type { UmlModelGroupBounds } from '../../../utils/umlModelGroups';

const PRIMARY_GROUP: UmlModelGroupBounds = {
  name: 'Main',
  color: '#2563eb',
  fill: 'rgba(37,99,235,0.06)',
  minX: 10,
  minY: 20,
  width: 300,
  height: 180,
};

const ADDITIONAL_GROUP: UmlModelGroupBounds = {
  name: 'Additional',
  color: '#dc2626',
  fill: 'rgba(220,38,38,0.06)',
  minX: 410,
  minY: 30,
  width: 280,
  height: 160,
};

const MODEL_GROUPS = [PRIMARY_GROUP, ADDITIONAL_GROUP];

function makeProps(
  overrides: Partial<UMLModelGroupWrappersProps> = {},
): UMLModelGroupWrappersProps {
  return {
    modelGroups: MODEL_GROUPS,
    offsetX: 100,
    offsetY: 200,
    vscale: 1,
    interactive: true,
    removableModelNames: new Set(['Additional']),
    onRemoveAdditionalModel: jest.fn(),
    beginGroupDrag: jest.fn(),
    moveGroupDrag: jest.fn(),
    endGroupDrag: jest.fn(),
    onGroupDragComplete: jest.fn(),
    ...overrides,
  };
}

function renderWrappers(
  overrides: Partial<UMLModelGroupWrappersProps> = {},
) {
  const props = makeProps(overrides);
  return {
    props,
    ...render(<UMLModelGroupWrappers {...props} />),
  };
}

function groupWrapper(groupName: string): HTMLElement {
  const button = screen.getByRole('button', { name: groupName });
  const header = button.closest('[data-wrapper-header]');
  const wrapper = header?.parentElement;
  if (!wrapper) throw new Error(`Missing wrapper for ${groupName}`);
  return wrapper;
}

function groupHeader(groupName: string): HTMLElement {
  const header = screen.getByRole('button', { name: groupName })
    .closest('[data-wrapper-header]');
  if (!header) throw new Error(`Missing header for ${groupName}`);
  return header as HTMLElement;
}

function latestAddedListener(
  addSpy: jest.SpyInstance,
  eventType: string,
): EventListener {
  const call = [...addSpy.mock.calls]
    .reverse()
    .find(([type]) => type === eventType);
  if (!call) throw new Error(`Missing ${eventType} listener`);
  return call[1] as EventListener;
}

describe('UMLModelGroupWrappers', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders wrapper geometry and preserves the existing presentation styles', () => {
    renderWrappers();

    const primary = groupWrapper('Main');
    expect(primary).toHaveStyle({
      position: 'absolute',
      left: '110px',
      top: '220px',
      width: '300px',
      height: '180px',
      border: '2px solid #2563eb',
      borderRadius: '10px',
      background: 'rgba(37, 99, 235, 0.06)',
      pointerEvents: 'none',
      zIndex: '0',
    });

    const additional = groupWrapper('Additional');
    expect(additional).toHaveStyle({
      left: '510px',
      top: '230px',
      width: '280px',
      height: '160px',
      border: '2px solid #dc2626',
      background: 'rgba(220, 38, 38, 0.06)',
    });

    const header = groupHeader('Additional');
    expect(header).toHaveAttribute('data-wrapper-header');
    expect(header).toHaveStyle({
      position: 'absolute',
      top: '0px',
      left: '0px',
      right: '0px',
      height: '22px',
      background: '#dc2626',
      borderRadius: '8px 8px 0 0',
      display: 'flex',
      alignItems: 'center',
      paddingLeft: '8px',
      paddingRight: '4px',
      fontSize: '11px',
      fontWeight: '700',
      color: '#fff',
      letterSpacing: '0.3px',
      pointerEvents: 'auto',
    });
    const nameButton = screen.getByRole('button', { name: 'Additional' });
    expect({
      flex: nameButton.style.flex,
      minWidth: nameButton.style.minWidth,
      height: nameButton.style.height,
      background: nameButton.style.background,
      padding: nameButton.style.padding,
      display: nameButton.style.display,
      alignItems: nameButton.style.alignItems,
      fontSize: nameButton.style.fontSize,
      fontWeight: nameButton.style.fontWeight,
      color: nameButton.style.color,
      letterSpacing: nameButton.style.letterSpacing,
      cursor: nameButton.style.cursor,
      textAlign: nameButton.style.textAlign,
    }).toEqual({
      flex: '1',
      minWidth: '0',
      height: '100%',
      background: 'transparent',
      padding: '0px',
      display: 'flex',
      alignItems: 'center',
      fontSize: '11px',
      fontWeight: '700',
      color: 'rgb(255, 255, 255)',
      letterSpacing: '0.3px',
      cursor: 'grab',
      textAlign: 'left',
    });
    expect(groupHeader('Main')).toHaveStyle({ paddingRight: '8px' });

    const removeButton = screen.getByTitle('Remove Additional');
    expect(removeButton).toHaveTextContent('×');
    expect({
      width: removeButton.style.width,
      height: removeButton.style.height,
      borderRadius: removeButton.style.borderRadius,
      background: removeButton.style.background,
      color: removeButton.style.color,
      cursor: removeButton.style.cursor,
      display: removeButton.style.display,
      alignItems: removeButton.style.alignItems,
      justifyContent: removeButton.style.justifyContent,
      fontSize: removeButton.style.fontSize,
      lineHeight: removeButton.style.lineHeight,
      flexShrink: removeButton.style.flexShrink,
    }).toEqual({
      width: '18px',
      height: '18px',
      borderRadius: '4px',
      background: 'rgba(255, 255, 255, 0.18)',
      color: 'rgb(255, 255, 255)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '14px',
      lineHeight: '1',
      flexShrink: '0',
    });
  });

  it('prevents drag-start propagation and reports scale-correct absolute deltas in order', () => {
    const callbackOrder: string[] = [];
    const parentMouseDown = jest.fn();
    const props = makeProps({
      vscale: 2,
      beginGroupDrag: jest.fn(name => callbackOrder.push(`begin:${name}`)),
      moveGroupDrag: jest.fn((name, dx, dy) => (
        callbackOrder.push(`move:${name}:${dx}:${dy}`)
      )),
      endGroupDrag: jest.fn(() => callbackOrder.push('end')),
      onGroupDragComplete: jest.fn(() => callbackOrder.push('complete')),
    });
    render(
      <div onMouseDown={parentMouseDown}>
        <UMLModelGroupWrappers {...props} />
      </div>,
    );
    const button = screen.getByRole('button', { name: 'Additional' });
    const mouseDown = createEvent.mouseDown(button, {
      bubbles: true,
      cancelable: true,
      clientX: 100,
      clientY: 50,
    });

    fireEvent(button, mouseDown);
    fireEvent.mouseMove(window, { clientX: 140, clientY: 70 });
    fireEvent.mouseMove(window, { clientX: 160, clientY: 90 });
    fireEvent.mouseUp(window);

    expect(mouseDown.defaultPrevented).toBe(true);
    expect(parentMouseDown).not.toHaveBeenCalled();
    expect(callbackOrder).toEqual([
      'begin:Additional',
      'move:Additional:20:10',
      'move:Additional:30:20',
      'end',
      'complete',
    ]);
  });

  it('removes global gesture listeners on mouseup', () => {
    const addSpy = jest.spyOn(globalThis, 'addEventListener');
    const removeSpy = jest.spyOn(globalThis, 'removeEventListener');
    const { props } = renderWrappers();
    addSpy.mockClear();
    removeSpy.mockClear();

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Main' }), {
      clientX: 10,
      clientY: 20,
    });
    const mouseMoveListener = latestAddedListener(addSpy, 'mousemove');
    const mouseUpListener = latestAddedListener(addSpy, 'mouseup');
    fireEvent.mouseUp(window);

    expect(removeSpy).toHaveBeenCalledWith('mousemove', mouseMoveListener);
    expect(removeSpy).toHaveBeenCalledWith('mouseup', mouseUpListener);
    expect(props.endGroupDrag).toHaveBeenCalledTimes(1);
    expect(props.onGroupDragComplete).toHaveBeenCalledTimes(1);
  });

  it('removes gesture listeners even when drag completion throws', () => {
    const addSpy = jest.spyOn(globalThis, 'addEventListener');
    const removeSpy = jest.spyOn(globalThis, 'removeEventListener');
    const onGroupDragComplete = jest.fn(() => {
      throw new Error('save failed');
    });
    const { props, unmount } = renderWrappers({ onGroupDragComplete });
    addSpy.mockClear();
    removeSpy.mockClear();

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Main' }), {
      clientX: 10,
      clientY: 20,
    });
    const mouseMoveListener = latestAddedListener(addSpy, 'mousemove');
    const mouseUpListener = latestAddedListener(addSpy, 'mouseup');

    expect(() => mouseUpListener(new MouseEvent('mouseup'))).toThrow('save failed');
    expect(removeSpy).toHaveBeenCalledWith('mousemove', mouseMoveListener);
    expect(removeSpy).toHaveBeenCalledWith('mouseup', mouseUpListener);
    expect(props.endGroupDrag).toHaveBeenCalledTimes(1);
    expect(onGroupDragComplete).toHaveBeenCalledTimes(1);

    unmount();
    expect(props.endGroupDrag).toHaveBeenCalledTimes(1);
  });

  it('cleans an active gesture on unmount without completing or retaining listeners', () => {
    const addSpy = jest.spyOn(globalThis, 'addEventListener');
    const removeSpy = jest.spyOn(globalThis, 'removeEventListener');
    const { props, unmount } = renderWrappers();
    addSpy.mockClear();
    removeSpy.mockClear();

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Additional' }), {
      clientX: 30,
      clientY: 40,
    });
    const mouseMoveListener = latestAddedListener(addSpy, 'mousemove');
    const mouseUpListener = latestAddedListener(addSpy, 'mouseup');
    unmount();

    expect(removeSpy).toHaveBeenCalledWith('mousemove', mouseMoveListener);
    expect(removeSpy).toHaveBeenCalledWith('mouseup', mouseUpListener);
    expect(props.endGroupDrag).toHaveBeenCalledTimes(1);
    expect(props.onGroupDragComplete).not.toHaveBeenCalled();
    fireEvent.mouseMove(window, { clientX: 100, clientY: 100 });
    fireEvent.mouseUp(window);
    expect(props.moveGroupDrag).not.toHaveBeenCalled();
    expect(props.onGroupDragComplete).not.toHaveBeenCalled();
  });

  it('replaces an active gesture without retaining duplicate global listeners', () => {
    const callbackOrder: string[] = [];
    const { props } = renderWrappers({
      beginGroupDrag: jest.fn(name => callbackOrder.push(`begin:${name}`)),
      moveGroupDrag: jest.fn((name, dx, dy) => (
        callbackOrder.push(`move:${name}:${dx}:${dy}`)
      )),
      endGroupDrag: jest.fn(() => callbackOrder.push('end')),
      onGroupDragComplete: jest.fn(() => callbackOrder.push('complete')),
    });

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Main' }), {
      clientX: 0,
      clientY: 0,
    });
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Additional' }), {
      clientX: 100,
      clientY: 100,
    });
    fireEvent.mouseMove(window, { clientX: 130, clientY: 120 });

    expect(props.beginGroupDrag).toHaveBeenNthCalledWith(1, 'Main');
    expect(props.beginGroupDrag).toHaveBeenNthCalledWith(2, 'Additional');
    expect(props.endGroupDrag).toHaveBeenCalledTimes(1);
    expect(props.moveGroupDrag).toHaveBeenCalledTimes(1);
    expect(props.moveGroupDrag).toHaveBeenCalledWith('Additional', 30, 20);
    expect(props.onGroupDragComplete).not.toHaveBeenCalled();

    fireEvent.mouseUp(window);
    expect(props.endGroupDrag).toHaveBeenCalledTimes(2);
    expect(props.onGroupDragComplete).toHaveBeenCalledTimes(1);
    expect(callbackOrder).toEqual([
      'begin:Main',
      'end',
      'begin:Additional',
      'move:Additional:30:20',
      'end',
      'complete',
    ]);
  });

  it('keeps read-only wrappers visible without registering drag behavior', () => {
    const { props } = renderWrappers({ interactive: false });
    const mainButton = screen.getByRole('button', { name: 'Main' });
    const additionalButton = screen.getByRole('button', { name: 'Additional' });

    expect(groupWrapper('Main')).toBeInTheDocument();
    expect(groupWrapper('Additional')).toBeInTheDocument();
    expect(mainButton).toHaveStyle({ cursor: 'default' });
    expect(additionalButton).toHaveStyle({ cursor: 'default' });
    fireEvent.mouseDown(additionalButton, { clientX: 10, clientY: 10 });
    fireEvent.mouseMove(window, { clientX: 60, clientY: 40 });
    fireEvent.mouseUp(window);

    expect(props.beginGroupDrag).not.toHaveBeenCalled();
    expect(props.moveGroupDrag).not.toHaveBeenCalled();
    expect(props.endGroupDrag).not.toHaveBeenCalled();
    expect(props.onGroupDragComplete).not.toHaveBeenCalled();
    expect(screen.queryByTitle('Remove Additional')).not.toBeInTheDocument();
  });

  it('shows remove controls only for interactive removable groups with a callback', () => {
    const parentClick = jest.fn();
    const onRemoveAdditionalModel = jest.fn();
    const props = makeProps({ onRemoveAdditionalModel });
    const { unmount } = render(
      <div onClick={parentClick}>
        <UMLModelGroupWrappers {...props} />
      </div>,
    );

    expect(screen.queryByTitle('Remove Main')).not.toBeInTheDocument();
    const removeButton = screen.getByTitle('Remove Additional');
    expect(removeButton).toHaveAccessibleName('Remove Additional');
    fireEvent.click(removeButton);
    expect(parentClick).not.toHaveBeenCalled();
    expect(onRemoveAdditionalModel).toHaveBeenCalledTimes(1);
    expect(onRemoveAdditionalModel).toHaveBeenCalledWith('Additional');

    unmount();
    renderWrappers({ onRemoveAdditionalModel: undefined });
    expect(screen.queryByTitle('Remove Additional')).not.toBeInTheDocument();
  });

  it('does not render a remove control for names outside the removable set', () => {
    renderWrappers({ removableModelNames: new Set() });

    expect(screen.queryByTitle('Remove Main')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Remove Additional')).not.toBeInTheDocument();
  });
});
