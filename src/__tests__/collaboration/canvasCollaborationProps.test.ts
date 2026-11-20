import { canvasCollaborationProps, shownLoadState } from '../../collaboration/canvasCollaborationProps';

const sync = { pushLocalChanges: vi.fn() } as never;
const state = (overrides: object) => ({ enabled: true, connection: null, sync, holding: false, unavailable: false, ...overrides }) as never;
const save = vi.fn();

describe('canvasCollaborationProps', () => {
  it('without collaboration, leaves the canvas as it was', () => {
    expect(canvasCollaborationProps(state({ enabled: false, sync: null }), false, save)).toEqual({
      readOnly: false, collaboration: undefined, disableUndo: false, onSaveChanges: save,
    });
  });

  it('with collaboration, gives the canvas the shared project and takes away saving and undo', () => {
    expect(canvasCollaborationProps(state({}), false, save)).toEqual({
      readOnly: false, collaboration: sync, disableUndo: true, onSaveChanges: undefined,
    });
  });

  it('makes the canvas read-only for a viewer, or when the project can not be joined', () => {
    expect(canvasCollaborationProps(state({}), true, save).readOnly).toBe(true);
    expect(canvasCollaborationProps(state({ sync: null, unavailable: true }), false, save).readOnly).toBe(true);
  });
});

describe('shownLoadState', () => {
  const ready = { status: 'ready' } as never;

  it('shows the project as loading until the canvas shows the shared project too', () => {
    expect(shownLoadState(state({ holding: true }), ready)).toEqual({ status: 'hydrating' });
  });

  it('leaves the load state alone otherwise, e.g. while the project itself is loading', () => {
    const loading = { status: 'loading' } as never;

    expect(shownLoadState(state({ holding: false }), ready)).toBe(ready);
    expect(shownLoadState(state({ holding: true }), loading)).toBe(loading);
  });
});
