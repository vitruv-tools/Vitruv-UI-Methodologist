import {
  allowedOrIgnored,
  allowedOrNothing,
  collaborationFlowProps,
  connectionRadiusFor,
  containerSize,
  interactionFlags,
  panOnDragFor,
  zoomLimits,
} from '../../../components/flow/flowCanvasRenderProps';

describe('allowedOrIgnored / allowedOrNothing', () => {
  it('hand out the handler only if it is allowed', () => {
    const handler = vi.fn();

    expect(allowedOrIgnored(true, handler)).toBe(handler);
    expect(allowedOrIgnored(false, handler)).not.toBe(handler);
    expect(() => allowedOrIgnored(false, handler)()).not.toThrow();
    expect(handler).not.toHaveBeenCalled();
    expect(allowedOrNothing(true, handler)).toBe(handler);
    expect(allowedOrNothing(false, handler)).toBeUndefined();
  });
});

describe('zoomLimits', () => {
  it('zooms less far out and further in for the UML view', () => {
    expect(zoomLimits(true)).toEqual({ minZoom: 0.45, maxZoom: 2.5 });
    expect(zoomLimits(false)).toEqual({ minZoom: 0.05, maxZoom: 2 });
  });
});

describe('interactionFlags', () => {
  const base = { umlViewActive: false, readOnly: false, isInteractive: true, editable: true, connecting: false };

  it('lets an editor interact and move boxes, except while connecting', () => {
    expect(interactionFlags(base)).toEqual({ interactionsAllowed: true, nodesMovable: true });
    expect(interactionFlags({ ...base, connecting: true })).toEqual({ interactionsAllowed: true, nodesMovable: false });
  });

  it('lets a viewer move boxes, and a locked canvas do neither', () => {
    expect(interactionFlags({ ...base, readOnly: true, editable: false })).toEqual({ interactionsAllowed: true, nodesMovable: true });
    expect(interactionFlags({ ...base, isInteractive: false, editable: false })).toEqual({ interactionsAllowed: false, nodesMovable: false });
  });

  it('always allows the UML view', () => {
    expect(interactionFlags({ ...base, umlViewActive: true, isInteractive: false, editable: false, connecting: true }))
      .toEqual({ interactionsAllowed: true, nodesMovable: true });
  });
});

describe('small render helpers', () => {
  it('panOnDragFor pans with the middle button only while boxes are selected by dragging', () => {
    expect(panOnDragFor(true, false)).toEqual([1]);
    expect(panOnDragFor(false, true)).toBe(true);
  });

  it('connectionRadiusFor is larger while adding reactions', () => {
    expect(connectionRadiusFor(false)).toBe(28);
    expect(connectionRadiusFor(true)).toBeGreaterThan(0);
  });

  it('containerSize falls back to a default size', () => {
    expect(containerSize(null)).toEqual({ width: 800, height: 600 });
    expect(containerSize({ clientWidth: 300, clientHeight: 200 })).toEqual({ width: 300, height: 200 });
  });

  it('collaborationFlowProps turns the flow library delete key off only with collaboration', () => {
    expect(collaborationFlowProps(undefined)).toEqual({});
    expect(collaborationFlowProps({} as never)).toEqual({ deleteKeyCode: null });
  });
});
