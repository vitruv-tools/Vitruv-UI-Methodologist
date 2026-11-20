/** Small decisions about what the canvas hands to React Flow and its children, kept out of the component. */

const noop = () => {};
const REACTION_CONNECTION_RADIUS = 10;
const DEFAULT_CONNECTION_RADIUS = 28;
const DEFAULT_CONTAINER = { width: 800, height: 600 };

/** The handler if it is allowed, else one that does nothing. */
export function allowedOrIgnored<A extends unknown[], R>(allowed: boolean, handler: (...args: A) => R): (...args: A) => R | void {
  return allowed ? handler : noop;
}

/** The handler if it is allowed, else nothing, which hides the action in the UI. */
export function allowedOrNothing<T>(allowed: boolean, handler: T): T | undefined {
  return allowed ? handler : undefined;
}

export function zoomLimits(umlViewActive: boolean): { minZoom: number; maxZoom: number } {
  return umlViewActive ? { minZoom: 0.45, maxZoom: 2.5 } : { minZoom: 0.05, maxZoom: 2 };
}

export function connectionRadiusFor(addReactionMode: boolean | undefined): number {
  return addReactionMode ? REACTION_CONNECTION_RADIUS : DEFAULT_CONNECTION_RADIUS;
}

/** With the selection box, left-drag selects; the middle button pans. */
export function panOnDragFor(boxSelectionEnabled: boolean, interactionsAllowed: boolean): boolean | number[] {
  return boxSelectionEnabled ? [1] : interactionsAllowed;
}

export function containerSize(element: { clientWidth: number; clientHeight: number } | null | undefined) {
  return {
    width: element?.clientWidth || DEFAULT_CONTAINER.width,
    height: element?.clientHeight || DEFAULT_CONTAINER.height,
  };
}

/**
 * Whether the canvas reacts to the user, and whether its boxes can be moved. Viewers can move
 * boxes to read a large model; they still cannot create, delete, connect, rename or save anything.
 */
export function interactionFlags(state: {
  umlViewActive: boolean;
  readOnly: boolean;
  isInteractive: boolean;
  editable: boolean;
  connecting: boolean;
}): { interactionsAllowed: boolean; nodesMovable: boolean } {
  const { umlViewActive, readOnly, isInteractive, editable, connecting } = state;
  const viewing = umlViewActive || readOnly;
  return {
    interactionsAllowed: viewing || isInteractive,
    nodesMovable: viewing || (editable && !connecting),
  };
}

/**
 * With collaboration, deleting goes through the canvas's own key handler: it asks first and tells
 * the project. The library's own Backspace would only remove the box here.
 */
export function collaborationFlowProps(collaboration: unknown): { deleteKeyCode?: null } {
  return collaboration ? { deleteKeyCode: null } : {};
}
