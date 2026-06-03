import { captureEditorSession, restoreEditorSession } from '../../utils/projectTabSession';
import { ProjectEditorSession } from '../../types/workspace';

describe('projectTabSession', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('captureEditorSession resolves with empty session on timeout', async () => {
    const promise = captureEditorSession();
    jest.advanceTimersByTime(2000);
    const session = await promise;
    expect(session).toEqual({
      nodes: [],
      edges: [],
      expandedMetaModelName: null,
      cachedWorkspaceSnapshot: null,
      documents: [],
      selectedFileBoxId: null,
    });
  });

  it('captureEditorSession resolves when MainLayout responds to the event', async () => {
    jest.useRealTimers();
    const custom: ProjectEditorSession = {
      nodes: [{ id: 'n1' } as any],
      edges: [],
      expandedMetaModelName: 'Pkg',
      cachedWorkspaceSnapshot: null,
      documents: [],
      selectedFileBoxId: 'box-1',
    };

    globalThis.addEventListener(
      'vitruv.captureEditorSession',
      (e: Event) => {
        const detail = (e as CustomEvent).detail as { resolve: (s: ProjectEditorSession) => void };
        detail.resolve(custom);
      },
      { once: true },
    );

    await expect(captureEditorSession()).resolves.toEqual(custom);
    jest.useFakeTimers();
  });

  it('restoreEditorSession dispatches vitruv.restoreEditorSession', () => {
    const handler = jest.fn();
    globalThis.addEventListener('vitruv.restoreEditorSession', handler);
    const session: ProjectEditorSession = {
      nodes: [],
      edges: [],
      expandedMetaModelName: null,
      cachedWorkspaceSnapshot: null,
      documents: [],
      selectedFileBoxId: null,
    };
    restoreEditorSession(session);
    expect(handler).toHaveBeenCalled();
    const event = handler.mock.calls[0][0] as CustomEvent<ProjectEditorSession>;
    expect(event.detail).toEqual(session);
    globalThis.removeEventListener('vitruv.restoreEditorSession', handler);
  });
});
