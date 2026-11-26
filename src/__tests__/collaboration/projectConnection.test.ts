import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebSocket as NodeWebSocket } from 'ws';
import * as Y from 'yjs';
import { EPOCH, STATUS, WRITEBACK_ERROR } from '../../collaboration/document';
import { createProjectConnection, type ProjectConnection, type ProjectConnectionOptions } from '../../collaboration/projectConnection';
import { startFakeCollaborationServer, type FakeCollaborationServer } from './fakeCollaborationServer';
import { buildDocument, copyOf } from './testDocuments';

const ROOM = 'vsum:12';

let server: FakeCollaborationServer;
const connections: ProjectConnection[] = [];

beforeEach(async () => {
  server = await startFakeCollaborationServer({
    [ROOM]: buildDocument({ models: [{ id: 1, name: 'Car', x: 1, y: 2 }, { id: 2, name: 'Brake' }], epoch: 'epoch-1' }),
  });
});

afterEach(async () => {
  for (const connection of connections.splice(0)) connection.destroy();
  await server.close();
});

function connect(options: Partial<ProjectConnectionOptions> = {}): ProjectConnection {
  const connection = createProjectConnection({
    serverUrl: server.url,
    projectId: 12,
    getToken: () => 'token-1',
    WebSocketPolyfill: NodeWebSocket as unknown as typeof WebSocket,
    maxBackoffMs: 20,
    ...options,
  });
  connections.push(connection);
  return connection;
}

const isSynced = (connection: ProjectConnection) => connection.getSnapshot().synced;
/** The connections the server accepted, i.e. those with a token it knows. */
const accepted = () => server.connections.filter((c) => c.accepted);

/** Resolves when the connection is lost; call it before causing that, since it can be back soon. */
function nextDisconnect(connection: ProjectConnection): Promise<void> {
  return new Promise((resolve) => {
    const stop = connection.subscribe(() => {
      if (connection.getSnapshot().status !== 'connected') {
        stop();
        resolve();
      }
    });
  });
}

/** Loses the connection, and refuses new ones until {@link goOnline}: the user's laptop is asleep. */
async function goOffline(connection: ProjectConnection): Promise<void> {
  const lost = nextDisconnect(connection);
  server.acceptedTokens = new Set();
  server.disconnectAll();
  await lost;
}
const goOnline = () => {
  server.acceptedTokens = undefined;
};
const syncedConnection = async (options: Partial<ProjectConnectionOptions> = {}) => {
  const connection = connect(options);
  await vi.waitFor(() => expect(isSynced(connection)).toBe(true));
  return connection;
};

describe('connecting', () => {
  it('joins the room of the project with the token, and gets the project', async () => {
    const connection = await syncedConnection();

    expect(server.connections).toEqual([{ room: ROOM, token: 'token-1', epoch: null, accepted: true }]);
    expect([...connection.getSnapshot().project.read().models.values()]).toEqual([
      { sourceId: 1, name: 'Car', position: { x: 1, y: 2 }, copy: copyOf(1) },
      { sourceId: 2, name: 'Brake', position: null, copy: copyOf(2) },
    ]);
  });

  it('is connecting at first, then connected, and synced once it has the project', async () => {
    const connection = connect();
    const seen: string[] = [];
    const record = () => {
      const { status, synced } = connection.getSnapshot();
      seen.push(`${status}${synced ? '+synced' : ''}`);
    };
    connection.subscribe(record);
    record();

    await vi.waitFor(() => expect(isSynced(connection)).toBe(true));

    expect(seen[0]).toBe('connecting');
    expect(seen.at(-1)).toBe('connected+synced');
    expect(seen).not.toContain('connected+synced+connecting');
  });

  it('keeps the same snapshot until something changes, so that a view can compare it', async () => {
    const connection = await syncedConnection();

    expect(connection.getSnapshot()).toBe(connection.getSnapshot());
  });

  it('does not connect without a token worth sending: the server then answers 401 and it keeps trying', async () => {
    server.acceptedTokens = new Set(['good']);
    const connection = connect({ getToken: () => null });

    await vi.waitFor(() => expect(server.connections.length).toBeGreaterThan(1));

    expect(server.connections.every((c) => c.token === null && !c.accepted)).toBe(true);
    expect(connection.getSnapshot().synced).toBe(false);
  });
});

describe('connecting again', () => {
  it('sends the current token every time, so a renewed token is used', async () => {
    let attempts = 0;
    const connection = await syncedConnection({ getToken: () => `token-${++attempts}` });
    const lost = nextDisconnect(connection);

    server.disconnectAll();
    await lost;
    await vi.waitFor(() => expect(isSynced(connection)).toBe(true));

    const tokens = accepted().map((c) => c.token);
    expect(tokens).toHaveLength(2);
    expect(tokens[0]).toBe('token-1');
    expect(tokens[1]).not.toBe(tokens[0]);
    expect(tokens[1]).toMatch(/^token-\d+$/);
  });

  it('has the token renewed when a connection closes, so the next attempt can use it', async () => {
    const refreshToken = vi.fn().mockResolvedValue(undefined);
    const connection = await syncedConnection({ refreshToken });
    const callsBefore = refreshToken.mock.calls.length;
    const lost = nextDisconnect(connection);

    server.disconnectAll();
    await lost;

    await vi.waitFor(() => expect(refreshToken.mock.calls.length).toBeGreaterThan(callsBefore));
  });

  it('waits for the token to be renewed before the first connection', async () => {
    let renewed = false;
    const refreshToken = () => new Promise<void>((resolve) => setTimeout(() => { renewed = true; resolve(); }, 30));
    const connection = connect({ refreshToken, getToken: () => (renewed ? 'renewed' : 'stale') });

    await vi.waitFor(() => expect(isSynced(connection)).toBe(true));

    expect(server.connections[0].token).toBe('renewed');
  });

  it('still connects if renewing the token fails', async () => {
    const connection = connect({ refreshToken: () => Promise.reject(new Error('offline')) });

    await vi.waitFor(() => expect(isSynced(connection)).toBe(true));
  });

  it('sends the epoch of its document, but not the first time', async () => {
    const connection = await syncedConnection();
    const lost = nextDisconnect(connection);

    server.disconnectAll();
    await lost;
    await vi.waitFor(() => expect(isSynced(connection)).toBe(true));

    expect(accepted().map((c) => c.epoch)).toEqual([null, 'epoch-1']);
  });

  it('keeps the edits made while disconnected, if the room still exists', async () => {
    const connection = await syncedConnection();
    await goOffline(connection);

    connection.getSnapshot().project.renameModel(1, 'Renamed offline');
    goOnline();
    await vi.waitFor(() => expect(isSynced(connection)).toBe(true));

    await vi.waitFor(() =>
      expect((server.room(ROOM).getMap('models').get('1') as Y.Map<unknown>).get('name')).toBe('Renamed offline'),
    );
  });

  it('shows that it is disconnected, and connected again afterwards', async () => {
    const connection = await syncedConnection();
    const seen: string[] = [];
    connection.subscribe(() => seen.push(connection.getSnapshot().status));

    server.disconnectAll();
    await vi.waitFor(() => expect(seen).toContain('disconnected'));
    await vi.waitFor(() => expect(connection.getSnapshot().status).toBe('connected'));
  });
});

describe('a document of an earlier room (close code 4409)', () => {
  /** The server dropped the room and loaded the project again, while the client was away. */
  async function roomCreatedAgain() {
    const connection = await syncedConnection();
    const before = connection.getSnapshot();
    const fresh = buildDocument({ models: [{ id: 1, name: 'Car' }, { id: 3, name: 'Wheel' }], epoch: 'epoch-2' });
    await goOffline(connection);
    server.recreateRoom(ROOM, fresh);
    return { connection, before };
  }

  it('starts again with a new document that has the new room, instead of merging the old one', async () => {
    const { connection, before } = await roomCreatedAgain();
    before.project.renameModel(1, 'Edited offline');
    before.project.removeModel(2);
    goOnline();

    await vi.waitFor(() => expect(connection.getSnapshot().generation).toBe(before.generation + 1));
    await vi.waitFor(() => expect(isSynced(connection)).toBe(true));

    const after = connection.getSnapshot();
    expect(after.project).not.toBe(before.project);
    expect([...after.project.read().models.values()].map((m) => [m.sourceId, m.name])).toEqual([[1, 'Car'], [3, 'Wheel']]);
    expect(accepted().map((c) => c.epoch)).toEqual([null, 'epoch-1', null]);
    // Nothing of the old document reached the room.
    expect(server.room(ROOM).getMap('models').toJSON()).toEqual({
      '1': { name: 'Car', ...copyOf(1), softDeleted: false, softDeletedVia: null },
      '3': { name: 'Wheel', ...copyOf(3), softDeleted: false, softDeletedVia: null },
    });
  });

  it('does not try the old document again', async () => {
    const { connection, before } = await roomCreatedAgain();
    goOnline();

    await vi.waitFor(() => expect(connection.getSnapshot().generation).toBe(before.generation + 1));
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(accepted().filter((c) => c.epoch === 'epoch-1')).toHaveLength(1);
  });

  it('tells the listeners, so that the canvas can be built again', async () => {
    const { connection } = await roomCreatedAgain();
    const generations: number[] = [];
    connection.subscribe(() => generations.push(connection.getSnapshot().generation));
    goOnline();

    await vi.waitFor(() => expect(isSynced(connection) && connection.getSnapshot().generation === 1).toBe(true));

    expect(new Set(generations)).toContain(1);
  });

  it('gives up if the server keeps closing it, instead of connecting in a loop', async () => {
    const connection = await syncedConnection();
    server.forceOutdated = true;
    server.disconnectAll();

    await vi.waitFor(() => expect(connection.getSnapshot().failure).toBe('outdated'));
    const attempts = server.connections.length;
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(server.connections).toHaveLength(attempts);
    expect(connection.getSnapshot().synced).toBe(false);
  });
});

describe('what the server reports', () => {
  it('shows the reason of a failed writeback, and clears it', async () => {
    const connection = await syncedConnection();
    expect(connection.getSnapshot().writebackError).toBeNull();

    server.room(ROOM).getMap(STATUS).set(WRITEBACK_ERROR, 'The changes could not be saved: View name is not unique');
    await vi.waitFor(() =>
      expect(connection.getSnapshot().writebackError).toBe('The changes could not be saved: View name is not unique'),
    );
    server.room(ROOM).getMap(STATUS).set(WRITEBACK_ERROR, null);

    await vi.waitFor(() => expect(connection.getSnapshot().writebackError).toBeNull());
  });

  it('knows the epoch of the room', async () => {
    const connection = await syncedConnection();

    expect(connection.getSnapshot().project.doc.getMap(STATUS).get(EPOCH)).toBe('epoch-1');
  });
});

describe('closing', () => {
  it('stops connecting, and stops telling listeners', async () => {
    const connection = await syncedConnection();
    const listener = vi.fn();
    connection.subscribe(listener);

    connection.destroy();
    server.disconnectAll();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(server.connections).toHaveLength(1);
    expect(listener).not.toHaveBeenCalled();
  });

  it('can be destroyed before it ever connected', async () => {
    const connection = connect({ refreshToken: () => new Promise((resolve) => setTimeout(resolve, 30)) });

    connection.destroy();
    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(server.connections).toHaveLength(0);
  });

  it('gets the project only from the server, not from other tabs of the browser', async () => {
    // A tab the server refuses: with other tabs as a source, it would still get the project from
    // this one, and its outdated document could not be turned away by the epoch.
    server.acceptedTokens = new Set(['good']);
    const mine = await syncedConnection({ getToken: () => 'good' });
    const refused = connect({ getToken: () => 'bad' });

    await vi.waitFor(() => expect(server.connections.some((c) => c.token === 'bad')).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(mine.getSnapshot().project.read().models.size).toBe(2);
    expect(refused.getSnapshot().project.read().models.size).toBe(0);
  });
});
