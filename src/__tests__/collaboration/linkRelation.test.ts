import type { Mock } from 'vitest';
import { WebSocket as NodeWebSocket } from 'ws';
import * as Y from 'yjs';
import { createProjectConnection, type ProjectConnectionOptions } from '../../collaboration/projectConnection';
import { addRelationToSharedProject, waitForRelationInBackend } from '../../collaboration/linkRelation';
import { apiService } from '../../services/api';
import { startFakeCollaborationServer, type FakeCollaborationServer } from './fakeCollaborationServer';
import { buildDocument } from './testDocuments';

vi.mock('../../services/api', () => ({ apiService: { getVsumDetails: vi.fn() } }));

const ROOM = 'vsum:12';
let server: FakeCollaborationServer;

beforeEach(async () => {
  server = await startFakeCollaborationServer({
    [ROOM]: buildDocument({ models: [{ id: 1, name: 'Car', x: 0, y: 0 }, { id: 2, name: 'Brake', x: 5, y: 5 }, { id: 3, name: 'Wheel', x: 9, y: 9 }] }),
  });
  localStorage.setItem('auth.access_token', 'the-token');
  localStorage.setItem('auth.access_expires_at', String(Date.now() + 600_000));
});

afterEach(async () => {
  await server.close();
  localStorage.clear();
});

const createConnection = (options: ProjectConnectionOptions) =>
  createProjectConnection({ ...options, WebSocketPolyfill: NodeWebSocket as unknown as typeof WebSocket, maxBackoffMs: 20 });
const link = (overrides: Partial<Parameters<typeof addRelationToSharedProject>[0]> = {}) =>
  addRelationToSharedProject({ serverUrl: server.url, projectId: 12, sourceId: 1, targetId: 3, reactionFileId: 77, createConnection, timeoutMs: 1000, ...overrides });
const relations = () => [...server.room(ROOM).getMap('relations').values()] as Y.Map<unknown>[];

describe('adding a relation through the shared project', () => {
  it('writes the relation, with its reaction file, into the room of the project', async () => {
    await link();

    await vi.waitFor(() => expect(relations()).toHaveLength(1));
    expect(relations()[0].toJSON()).toMatchObject({ sourceId: 1, targetId: 3, reactionFileId: 77, backendId: null, softDeleted: false });
  });

  it('joins as the user, and leaves again afterwards', async () => {
    await link();

    expect(server.connections).toMatchObject([{ room: ROOM, token: 'the-token', accepted: true }]);
    const stillOpen = new Promise<boolean>((resolve) => setTimeout(() => resolve(server.connections.length === 1), 100));
    await expect(stillOpen).resolves.toBe(true);
  });

  it('writes nothing, and says why, if a metamodel is not part of the project', async () => {
    await expect(link({ targetId: 99 })).rejects.toThrow(/not part of this project/);

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(relations()).toHaveLength(0);
  });

  it('fails, instead of waiting for ever, if the collaboration server cannot be reached', async () => {
    const unreachable = await startFakeCollaborationServer();
    const url = unreachable.url;
    await unreachable.close();

    await expect(link({ serverUrl: url, timeoutMs: 200 })).rejects.toThrow(/collaboration server/);
  });

  it('fails if the server does not take the connection', async () => {
    server.acceptedTokens = new Set(['someone-else']);

    await expect(link({ timeoutMs: 300 })).rejects.toThrow(/collaboration server/);
  });
});

describe('waiting until the backend has the relation', () => {
  const details = (relations: { sourceId: number; targetId: number }[]) => ({ data: { metaModelsRelation: relations } });

  it('resolves true as soon as the backend lists the relation', async () => {
    (apiService.getVsumDetails as Mock)
      .mockResolvedValueOnce(details([]))
      .mockResolvedValueOnce(details([{ sourceId: 1, targetId: 2 }]))
      .mockResolvedValueOnce(details([{ sourceId: 1, targetId: 2 }, { sourceId: 1, targetId: 3 }]));

    await expect(waitForRelationInBackend(12, 1, 3, { intervalMs: 5, timeoutMs: 1000 })).resolves.toBe(true);

    expect(apiService.getVsumDetails).toHaveBeenCalledTimes(3);
  });

  it('resolves false if the backend does not have it in time, and does not fail if the backend does', async () => {
    (apiService.getVsumDetails as Mock).mockRejectedValue(new Error('offline'));

    await expect(waitForRelationInBackend(12, 1, 3, { intervalMs: 5, timeoutMs: 60 })).resolves.toBe(false);
  });
});
