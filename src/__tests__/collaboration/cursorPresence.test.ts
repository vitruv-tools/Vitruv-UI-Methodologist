import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Awareness } from 'y-protocols/awareness';
import { WebSocket as NodeWebSocket } from 'ws';
import * as Y from 'yjs';
import {
  CURSOR_COLORS,
  CursorPresence,
  cursorDisplayName,
  cursorInitials,
  pickCursorColor,
  readRemoteCursors,
} from '../../collaboration/cursorPresence';
import { createProjectConnection, type ProjectConnection } from '../../collaboration/projectConnection';
import { startFakeCollaborationServer, type FakeCollaborationServer } from './fakeCollaborationServer';
import { buildDocument } from './testDocuments';

describe('cursorInitials', () => {
  it.each([
    ['Ahmed Ibrahim', 'AI'],
    ['Ahmed', 'Ah'],
    ['ahmed ibrahim', 'AI'],
    ['Anna Maria Schmidt', 'AS'],
    ['  Ahmed   Ibrahim  ', 'AI'],
    ['A', 'A'],
    ['', '?'],
  ])('turns %j into %j', (name, initials) => {
    expect(cursorInitials(name)).toBe(initials);
  });
});

describe('cursorDisplayName', () => {
  it('joins given and family name', () => {
    expect(cursorDisplayName({ givenName: 'Ahmed', familyName: 'Ibrahim', username: 'ahi' })).toBe('Ahmed Ibrahim');
  });
  it('uses the one name that exists', () => {
    expect(cursorDisplayName({ givenName: 'Ahmed', familyName: '', username: 'ahi' })).toBe('Ahmed');
  });
  it('falls back to the username', () => {
    expect(cursorDisplayName({ givenName: undefined, familyName: ' ', username: 'ahi' })).toBe('ahi');
  });
});

describe('pickCursorColor', () => {
  it('picks a color nobody else has', () => {
    const taken = CURSOR_COLORS.slice(0, 9);
    for (let seed = 0; seed < 20; seed++) {
      expect(pickCursorColor(taken, seed)).toBe(CURSOR_COLORS[9]);
    }
  });
  it('gives users different colors when their seeds differ', () => {
    const colors = new Set(CURSOR_COLORS.map((_, seed) => pickCursorColor([], seed)));
    expect(colors.size).toBe(CURSOR_COLORS.length);
  });
  it("takes the seed's color when all are taken", () => {
    expect(pickCursorColor(CURSOR_COLORS, 3)).toBe(CURSOR_COLORS[3]);
  });
});

describe('CursorPresence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('publishes name and a color, and no cursor yet', () => {
    const mine = new Awareness(new Y.Doc());
    new CursorPresence(mine, { name: 'Ahmed Ibrahim' });
    const state = mine.getLocalState() as any;
    expect(state.user.name).toBe('Ahmed Ibrahim');
    expect(CURSOR_COLORS).toContain(state.user.color);
    expect(state.cursor).toBeNull();
  });

  it('avoids the colors of users who are there', () => {
    const awareness = new Awareness(new Y.Doc());
    const taken = pickCursorColor([], awareness.clientID);
    awareness.states.set(999, { user: { name: 'B', color: taken } });
    new CursorPresence(awareness, { name: 'A' });
    expect((awareness.getLocalState() as any).user.color).not.toBe(taken);
  });

  it('sends the first position at once and throttles the rest, ending with the latest', () => {
    const mine = new Awareness(new Y.Doc());
    const presence = new CursorPresence(mine, { name: 'A', throttleMs: 100 });
    const sent: unknown[] = [];
    mine.on('update', () => sent.push((mine.getLocalState() as any).cursor));

    presence.move({ x: 1, y: 1 });
    presence.move({ x: 2, y: 2 });
    presence.move({ x: 3, y: 3 });
    expect(sent).toEqual([{ x: 1, y: 1 }]);

    vi.advanceTimersByTime(100);
    expect(sent).toEqual([{ x: 1, y: 1 }, { x: 3, y: 3 }]);

    vi.advanceTimersByTime(1000);
    expect(sent).toHaveLength(2);
  });

  it('removes the cursor when the mouse leaves, and drops a position still waiting', () => {
    const mine = new Awareness(new Y.Doc());
    const presence = new CursorPresence(mine, { name: 'A', throttleMs: 100 });
    presence.move({ x: 1, y: 1 });
    presence.move({ x: 2, y: 2 });

    presence.leave();
    vi.advanceTimersByTime(500);

    expect((mine.getLocalState() as any).cursor).toBeNull();
  });

  it('ignores positions that are not numbers', () => {
    const mine = new Awareness(new Y.Doc());
    const presence = new CursorPresence(mine, { name: 'A' });
    presence.move({ x: Number.NaN, y: 1 });
    expect((mine.getLocalState() as any).cursor).toBeNull();
  });
});

describe('readRemoteCursors', () => {
  const remote = (awareness: Awareness, state: unknown) => awareness.states.set(999, state as any);

  it('lists others with a cursor, and never the own one', () => {
    const awareness = new Awareness(new Y.Doc());
    awareness.setLocalState({ user: { name: 'Me Myself', color: '#e6194b' }, cursor: { x: 1, y: 1 } });
    remote(awareness, { user: { name: 'Ahmed Ibrahim', color: '#3cb44b' }, cursor: { x: 10, y: 20 } });

    expect(readRemoteCursors(awareness)).toEqual([
      { clientId: 999, name: 'Ahmed Ibrahim', initials: 'AI', color: '#3cb44b', x: 10, y: 20 },
    ]);
  });

  it('skips users without a cursor, and replaces a color that is not hex', () => {
    const awareness = new Awareness(new Y.Doc());
    remote(awareness, { user: { name: 'A', color: 'red' }, cursor: null });
    expect(readRemoteCursors(awareness)).toEqual([]);

    remote(awareness, { user: { name: 'A', color: 'url(javascript:x)' }, cursor: { x: 1, y: 2 } });
    expect(CURSOR_COLORS).toContain(readRemoteCursors(awareness)[0].color);
  });
});

describe('over the collaboration server', () => {
  const ROOM = 'vsum:12';
  let server: FakeCollaborationServer;
  const connections: ProjectConnection[] = [];

  beforeEach(async () => {
    server = await startFakeCollaborationServer({ [ROOM]: buildDocument({ models: [], epoch: 'e' }) });
  });
  afterEach(async () => {
    for (const connection of connections.splice(0)) connection.destroy();
    await server.close();
  });

  const join = async () => {
    const connection = createProjectConnection({
      serverUrl: server.url,
      projectId: 12,
      getToken: () => 't',
      WebSocketPolyfill: NodeWebSocket as unknown as typeof WebSocket,
    });
    connections.push(connection);
    await vi.waitFor(() => expect(connection.getSnapshot().synced).toBe(true));
    return connection;
  };

  it("shows each user the other's cursor in canvas coordinates, with different colors, and removes it on leave", async () => {
    const alice = await join();
    const bob = await join();
    const aliceAwareness = alice.getSnapshot().awareness;
    const bobAwareness = bob.getSnapshot().awareness;
    const alicePresence = new CursorPresence(aliceAwareness, { name: 'Alice Anders' });
    const bobPresence = new CursorPresence(bobAwareness, { name: 'Bob' });

    alicePresence.move({ x: 120, y: -45 });
    bobPresence.move({ x: 7, y: 8 });

    await vi.waitFor(() => {
      expect(readRemoteCursors(bobAwareness)).toMatchObject([{ name: 'Alice Anders', initials: 'AA', x: 120, y: -45 }]);
      expect(readRemoteCursors(aliceAwareness)).toMatchObject([{ name: 'Bob', initials: 'Bo', x: 7, y: 8 }]);
    });
    expect(readRemoteCursors(bobAwareness)[0].color).not.toBe(readRemoteCursors(aliceAwareness)[0].color);

    // The mouse leaves the canvas.
    alicePresence.leave();
    await vi.waitFor(() => expect(readRemoteCursors(bobAwareness)).toEqual([]));

    // The user comes back, then leaves the project.
    alicePresence.move({ x: 1, y: 1 });
    await vi.waitFor(() => expect(readRemoteCursors(bobAwareness)).toHaveLength(1));
    alice.destroy();
    await vi.waitFor(() => expect([...bobAwareness.getStates().keys()]).toEqual([bobAwareness.clientID]));
    expect(readRemoteCursors(bobAwareness)).toEqual([]);
  });
});
