import { act, renderHook, waitFor } from '@testing-library/react';
import type { Edge, Node } from 'reactflow';
import { WebSocket as NodeWebSocket } from 'ws';
import * as Y from 'yjs';
import type { CanvasHandle } from '../../collaboration/canvasPort';
import { createProjectConnection, type ProjectConnectionOptions } from '../../collaboration/projectConnection';
import { useCanvasCollaboration, type UseCanvasCollaborationOptions } from '../../collaboration/useCanvasCollaboration';
import { startFakeCollaborationServer, type FakeCollaborationServer } from './fakeCollaborationServer';
import { buildDocument } from './testDocuments';

const ROOM = 'vsum:12';
let server: FakeCollaborationServer;

beforeEach(async () => {
  server = await startFakeCollaborationServer({
    [ROOM]: buildDocument({ models: [{ id: 1, name: 'Car', x: 10, y: 20 }, { id: 2, name: 'Brake', x: 30, y: 40 }] }),
  });
  localStorage.setItem('auth.access_token', 'token');
  localStorage.setItem('auth.access_expires_at', String(Date.now() + 600_000));
});

afterEach(async () => {
  await server.close();
  localStorage.clear();
});

/** A canvas that records what it is told, and shows boxes it is asked to add. */
function fakeCanvas() {
  const nodes: Node[] = [];
  const added: { fileName: string; meta: any }[] = [];
  const handle: CanvasHandle = {
    getNodes: () => nodes,
    getEdges: () => [] as Edge[],
    getWorkspaceSnapshot: () => ({ metaModelIds: [], metaModelRelationRequests: [] }),
    addEcoreFile: vi.fn((fileName: string, _content: string, meta?: any) => {
      added.push({ fileName, meta });
      nodes.push({ id: `ecore-${meta.metaModelSourceId}`, type: 'ecoreFile', position: meta.position, data: { ...meta, fileName } });
    }),
    removeEcoreFileBySourceId: vi.fn(),
    updateEcoreDisplayName: vi.fn(),
    setEcorePositions: vi.fn(),
    upsertReactionRelation: vi.fn(),
    removeReactionRelation: vi.fn(),
  };
  return { handle, added };
}

function setup(overrides: Partial<UseCanvasCollaborationOptions> = {}, canvas = fakeCanvas()) {
  const options: UseCanvasCollaborationOptions = {
    projectId: 12,
    canvasLoaded: true,
    instanceId: 'tab-1',
    getCanvas: () => canvas.handle,
    resolveMetaModel: async ({ sourceId }) => ({ fileName: `M${sourceId}.ecore`, fileContent: '<x/>', meta: { metaModelSourceId: sourceId, metaModelId: sourceId } }),
    serverUrl: server.url,
    createConnection: (o: ProjectConnectionOptions) =>
      createProjectConnection({ ...o, WebSocketPolyfill: NodeWebSocket as unknown as typeof WebSocket, maxBackoffMs: 20 }),
    unavailableAfterMs: 300,
    ...overrides,
  };
  return { canvas, options, hook: renderHook((props: UseCanvasCollaborationOptions) => useCanvasCollaboration(props), { initialProps: options }) };
}

describe('without a collaboration server', () => {
  it('is off: the canvas is not held, and nothing connects', () => {
    const { hook } = setup({ serverUrl: undefined });

    expect(hook.result.current).toMatchObject({ enabled: false, holding: false, unavailable: false, sync: null, connection: null });
    expect(server.connections).toEqual([]);
  });
});

describe('with a collaboration server', () => {
  it('holds the canvas until the project is shown on it, and then writes its changes into the project', async () => {
    const { hook, canvas } = setup();
    expect(hook.result.current).toMatchObject({ enabled: true, holding: true, sync: null });

    await waitFor(() => expect(hook.result.current.sync).not.toBeNull());

    expect(hook.result.current.holding).toBe(false);
    expect(canvas.added.map((a) => a.meta.metaModelSourceId)).toEqual([1, 2]);
    expect(canvas.added[0].meta).toMatchObject({ position: { x: 10, y: 20 }, exactPosition: true, displayName: 'Car' });
  });

  it('does not start before the project is on the canvas, since the canvas would then be taken away', async () => {
    const { hook, canvas, options } = setup({ canvasLoaded: false });
    await waitFor(() => expect(hook.result.current.connection?.synced).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(hook.result.current.sync).toBeNull();
    expect(canvas.added).toEqual([]);

    hook.rerender({ ...options, canvasLoaded: true });
    await waitFor(() => expect(hook.result.current.sync).not.toBeNull());
  });

  it('writes what the user changes on the canvas into the project, and shows it to others', async () => {
    const { hook, canvas } = setup();
    await waitFor(() => expect(hook.result.current.sync).not.toBeNull());

    // The user moves box 1.
    canvas.handle.getNodes()[0].position = { x: 99, y: 98 };
    act(() => hook.result.current.sync!.pushLocalChanges());

    await waitFor(() => {
      const position = (server.room(ROOM).getMap('layout').get('metaModels') as Y.Map<unknown>).get('1');
      expect(position).toEqual({ x: 99, y: 98 });
    });
  });

  it('keeps following the same project when the connection drops and comes back, without showing it again', async () => {
    const { hook, canvas } = setup();
    await waitFor(() => expect(hook.result.current.sync).not.toBeNull());
    const sync = hook.result.current.sync;

    server.acceptedTokens = new Set();
    server.disconnectAll();
    await waitFor(() => expect(hook.result.current.connection?.synced).toBe(false));
    expect(hook.result.current.sync).toBe(sync);
    expect(hook.result.current.holding).toBe(false);
    server.acceptedTokens = undefined;
    await waitFor(() => expect(hook.result.current.connection?.synced).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(hook.result.current.sync).toBe(sync);
    expect(canvas.added.map((a) => a.meta.metaModelSourceId)).toEqual([1, 2]);
  });

  it('is unavailable if the server cannot be reached in time: the project can be looked at, not changed', async () => {
    const unreachable = await startFakeCollaborationServer();
    const url = unreachable.url;
    await unreachable.close();
    const { hook } = setup({ serverUrl: url });

    expect(hook.result.current.unavailable).toBe(false);
    await waitFor(() => expect(hook.result.current.unavailable).toBe(true));

    expect(hook.result.current.holding).toBe(false);
    expect(hook.result.current.sync).toBeNull();
  });

  it('is not unavailable while the canvas is still loading', async () => {
    const { hook } = setup({ canvasLoaded: false });

    await new Promise((resolve) => setTimeout(resolve, 450));

    expect(hook.result.current.unavailable).toBe(false);
    expect(hook.result.current.holding).toBe(true);
  });

  it('stops following the project when the page is left', async () => {
    const { hook, canvas } = setup();
    await waitFor(() => expect(hook.result.current.sync).not.toBeNull());

    hook.unmount();
    server.room(ROOM).getMap('models').set('3', new Y.Map<unknown>([['name', 'Wheel'], ['softDeleted', false], ['softDeletedVia', null]]));
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(canvas.added.map((a) => a.meta.metaModelSourceId)).toEqual([1, 2]);
  });

  it('holds the canvas again, and shows the project again, when the project is opened in the next tab', async () => {
    const { hook, options } = setup();
    await waitFor(() => expect(hook.result.current.sync).not.toBeNull());
    const first = hook.result.current.sync;

    hook.rerender({ ...options, instanceId: 'tab-2' });
    expect(hook.result.current.holding).toBe(true);
    await waitFor(() => expect(hook.result.current.sync).not.toBeNull());

    expect(hook.result.current.sync).not.toBe(first);
  });
});
